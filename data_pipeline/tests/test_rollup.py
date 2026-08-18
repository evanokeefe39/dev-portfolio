"""Rollup tests: immutable content-hash cache, truncation, retry/circuit
breaker, rollupError recording, and the LLM client failure contract.

No network: the LLM client is replaced by a counting mock, and the real
``LlmClient`` HTTP layer is exercised via a monkeypatched ``urlopen``.
"""

from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from data_pipeline.config import (
    LLM_BREAKER_THRESHOLD,
    ROLLUP_CHARS_PER_TOKEN,
    ROLLUP_MAX_INPUT_TOKENS,
)
from data_pipeline.llm import CircuitOpenError, LlmClient, LlmError, load_env_file
from data_pipeline.rollup import (
    build_prompt_input,
    compute_rollups,
    content_hash,
    truncate_to_budget,
    window_sessions,
)

NOW = datetime(2026, 8, 17, 20, 0, 0, tzinfo=timezone(timedelta(hours=2)))
WINDOW_END = date(2026, 8, 17)
MAX_CHARS = ROLLUP_MAX_INPUT_TOKENS * ROLLUP_CHARS_PER_TOKEN
GRAINS7 = {"7d": 7}  # single-grain runs keep call-count assertions exact


class CountingClient:
    """Mock LLM client that records every call and returns canned text."""

    def __init__(self, text: str = "Rolled-up summary.", error: Exception | None = None):
        self.text = text
        self.error = error
        self.calls: list[str] = []

    def summarize(self, text: str) -> str:
        self.calls.append(text)
        if self.error:
            raise self.error
        return self.text


def _session(harness: str, repo: str, sid: str, day: str,
             summary: str | None = None, fallback: str | None = None) -> dict:
    return {
        "harness": harness,
        "repo": repo,
        "sessionId": sid,
        "day": day,
        "startTs": f"{day}T10:00:00Z",
        "summary": summary,
        "summarySlug": None,
        "fallback": fallback,
    }


def _group_sessions(repo: str = "dev-portfolio", harness: str = "omp",
                    n: int = 2, day: str = "2026-08-17", text: str = "Did work.") -> list[dict]:
    return [
        _session(harness, repo, f"s{i}", day, summary=None, fallback=f"{text} {i}")
        for i in range(n)
    ]


# ── Content hash ─────────────────────────────────────────────────────────────

def test_content_hash_stable_and_sensitive():
    a = _group_sessions(text="alpha")
    b = _group_sessions(text="alpha")
    assert content_hash(a) == content_hash(b)
    a[0]["fallback"] = "changed"
    assert content_hash(a) != content_hash(b)


def test_content_hash_ignores_sessions_without_content():
    plain = _group_sessions()
    mixed = plain + [_session("omp", "dev-portfolio", "sX", "2026-08-17")]
    assert content_hash(plain) == content_hash(mixed)  # sX has no content


# ── Window selection ─────────────────────────────────────────────────────────

def test_window_sessions_bounds():
    sessions = [
        _session("omp", "dev-portfolio", "a", "2026-08-11", fallback="a"),
        _session("omp", "dev-portfolio", "b", "2026-08-17", fallback="b"),
        _session("omp", "dev-portfolio", "c", "2026-08-18", fallback="c"),
    ]
    got = window_sessions(sessions, grain_days=7, window_end=WINDOW_END)
    assert [s["sessionId"] for s in got] == ["a", "b"]
    assert window_sessions(sessions, grain_days=None, window_end=WINDOW_END) == sessions


# ── Truncation ───────────────────────────────────────────────────────────────

def test_truncate_to_budget_keeps_newest_lines():
    lines = [f"line-{i}-" + "x" * 20 for i in range(10)]
    got = truncate_to_budget(lines, max_chars=60)
    assert got[0] == lines[0]
    assert sum(len(l) for l in got) <= 60
    assert got == truncate_to_budget(got, max_chars=60)  # idempotent


def test_truncate_single_oversized_line_is_cut():
    lines = ["y" * 1000]
    got = truncate_to_budget(lines, max_chars=100)
    assert len(got) == 1
    assert len(got[0]) == 100


def test_prompt_input_newest_first_and_format():
    sessions = [
        _session("omp", "dev-portfolio", "old", "2026-08-10", fallback="old work"),
        _session("claude", "dev-portfolio", "new", "2026-08-17", fallback="new work"),
    ]
    prompt = build_prompt_input(sessions, max_chars=10_000)
    assert prompt.splitlines()[0] == "- [claude] dev-portfolio: new work"
    assert "- [omp] dev-portfolio: old work" in prompt


def test_over_8k_tokens_truncated_newest_first(tmp_path):
    sessions = _group_sessions(n=200, text="s" * 400)  # ~80K chars total
    client = CountingClient()
    compute_rollups(sessions, window_end=WINDOW_END, cache_path=tmp_path / "cache.json",
                    client=client, grains=GRAINS7)
    assert client.calls, "expected at least one LLM call"
    prompt = client.calls[0]
    assert len(prompt) <= MAX_CHARS
    assert prompt.startswith("- [omp] dev-portfolio: s")  # newest first


# ── Cache immutability + call counts ─────────────────────────────────────────

def test_unchanged_hash_zero_calls(tmp_path):
    cache = tmp_path / "rollup_cache.json"
    sessions = _group_sessions()
    client = CountingClient(text="Summary A.")
    rollups, errors = compute_rollups(sessions, window_end=WINDOW_END,
                                      cache_path=cache, client=client, grains=GRAINS7)
    assert len(client.calls) == 1
    assert rollups["7d"]["dev-portfolio|omp"] == "Summary A."
    assert errors["7d"] == {}

    # Same content hash → cached summary reused, zero new calls.
    client2 = CountingClient(text="Summary A.")
    rollups2, errors2 = compute_rollups(sessions, window_end=WINDOW_END,
                                        cache_path=cache, client=client2, grains=GRAINS7)
    assert client2.calls == []
    assert rollups2["7d"]["dev-portfolio|omp"] == "Summary A."
    assert errors2["7d"] == {}


def test_new_and_changed_hash_exactly_one_call(tmp_path):
    cache = tmp_path / "rollup_cache.json"
    sessions = _group_sessions()
    client = CountingClient(text="A.")
    compute_rollups(sessions, window_end=WINDOW_END, cache_path=cache, client=client,
                    grains=GRAINS7)
    assert len(client.calls) == 1

    # Changed content → exactly one new call, cache updated.
    sessions[0]["fallback"] = "changed text"
    client2 = CountingClient(text="B.")
    rollups, _ = compute_rollups(sessions, window_end=WINDOW_END, cache_path=cache,
                                 client=client2, grains=GRAINS7)
    assert len(client2.calls) == 1
    assert rollups["7d"]["dev-portfolio|omp"] == "B."

    # New key (different harness) → exactly one call.
    client3 = CountingClient(text="C.")
    sessions3 = _group_sessions(harness="claude")
    rollups3, _ = compute_rollups(sessions3, window_end=WINDOW_END, cache_path=cache,
                                  client=client3, grains=GRAINS7)
    assert len(client3.calls) == 1
    assert rollups3["7d"]["dev-portfolio|claude"] == "C."


def test_empty_window_no_key(tmp_path):
    cache = tmp_path / "rollup_cache.json"
    # Sessions all before the 7d window; "all" has content but 7d doesn't.
    sessions = _group_sessions(day="2026-08-01")
    client = CountingClient()
    rollups, errors = compute_rollups(sessions, window_end=WINDOW_END,
                                      cache_path=cache, client=client)
    assert rollups["7d"] == {}
    assert errors["7d"] == {}
    assert "dev-portfolio|omp" in rollups["all"]


def test_window_with_no_content_no_key(tmp_path):
    cache = tmp_path / "rollup_cache.json"
    sessions = [_session("omp", "dev-portfolio", "s1", "2026-08-17")]  # no summary/fallback
    client = CountingClient()
    rollups, errors = compute_rollups(sessions, window_end=WINDOW_END,
                                      cache_path=cache, client=client)
    for grain in rollups:
        assert rollups[grain] == {}
        assert errors[grain] == {}
    assert client.calls == []


def test_failure_records_error_and_retries_next_run(tmp_path):
    cache = tmp_path / "rollup_cache.json"
    sessions = _group_sessions()
    failing = CountingClient(error=LlmError("API returned 500"))
    rollups, errors = compute_rollups(sessions, window_end=WINDOW_END,
                                      cache_path=cache, client=failing, grains=GRAINS7)
    assert rollups["7d"] == {}
    assert errors["7d"]["dev-portfolio|omp"].startswith("LLM call failed:")

    # Failure not cached → a healthy client makes the call next run.
    healthy = CountingClient(text="Recovered.")
    rollups2, errors2 = compute_rollups(sessions, window_end=WINDOW_END,
                                        cache_path=cache, client=healthy, grains=GRAINS7)
    assert len(healthy.calls) == 1
    assert rollups2["7d"]["dev-portfolio|omp"] == "Recovered."
    assert errors2["7d"] == {}


def test_circuit_breaker_skips_remaining_calls(tmp_path):
    cache = tmp_path / "rollup_cache.json"
    # 5 distinct repo|harness groups, all fail.
    sessions = []
    for i in range(5):
        sessions += _group_sessions(repo=f"repo-{i}", harness="omp", text=f"t{i}")
    failing = CountingClient(error=LlmError("boom"))
    rollups, errors = compute_rollups(sessions, window_end=WINDOW_END,
                                      cache_path=cache, client=failing, grains=GRAINS7)
    # Exactly breaker-threshold calls, then the circuit opens for the rest.
    assert len(failing.calls) == LLM_BREAKER_THRESHOLD
    assert rollups["7d"] == {}
    opened = [e for e in errors["7d"].values() if "circuit breaker" in e]
    assert len(opened) == 5 - LLM_BREAKER_THRESHOLD
    assert any("circuit breaker" in e for e in errors["7d"].values())


def test_missing_api_key_per_key_error_zero_calls(tmp_path):
    cache = tmp_path / "rollup_cache.json"
    sessions = _group_sessions()
    rollups, errors = compute_rollups(sessions, window_end=WINDOW_END,
                                      cache_path=cache, client=None, grains=GRAINS7)
    assert rollups["7d"] == {}
    assert errors["7d"]["dev-portfolio|omp"] == "LLM call failed: LLM_API_KEY not configured"


def test_cache_file_written_with_schema(tmp_path):
    import json
    cache = tmp_path / "rollup_cache.json"
    sessions = _group_sessions()
    compute_rollups(sessions, window_end=WINDOW_END, cache_path=cache,
                    client=CountingClient(text="K."), now=NOW, grains=GRAINS7)
    data = json.loads(cache.read_text(encoding="utf-8"))
    key = "7d|dev-portfolio|omp|2026-08-17"
    assert key in data
    entry = data[key]
    assert set(entry) == {"hash", "summary", "ts"}
    assert entry["summary"] == "K."
    assert entry["hash"] == content_hash(sessions)
    assert entry["ts"].startswith("2026-08-17")


def test_absent_cache_treated_as_empty(tmp_path):
    cache = tmp_path / "does_not_exist" / "rollup_cache.json"
    sessions = _group_sessions()
    client = CountingClient(text="Fresh.")
    rollups, errors = compute_rollups(sessions, window_end=WINDOW_END,
                                      cache_path=cache, client=client, grains=GRAINS7)
    assert len(client.calls) == 1
    assert rollups["7d"]["dev-portfolio|omp"] == "Fresh."
    assert errors["7d"] == {}


# ── .env parser ──────────────────────────────────────────────────────────────

def test_load_env_file_parses_and_skips_comments(tmp_path):
    env = tmp_path / ".env"
    env.write_text(
        "# comment\nLLM_BASE_URL=https://api.example.com/v1\n\nLLM_API_KEY=\"sk-abc\"\n"
        "LLM_MODEL=deepseek-v4-flash\n", encoding="utf-8")
    parsed = load_env_file(env)
    assert parsed == {
        "LLM_BASE_URL": "https://api.example.com/v1",
        "LLM_API_KEY": "sk-abc",
        "LLM_MODEL": "deepseek-v4-flash",
    }
    assert load_env_file(tmp_path / "missing.env") == {}


# ── LlmClient failure contract (monkeypatched urlopen, no network) ──────────

class _FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self) -> bytes:
        import json as _json
        return _json.dumps(self.payload).encode("utf-8")


def _client(**kwargs) -> LlmClient:
    kwargs.setdefault("backoff", (0.001, 0.002, 0.004))
    return LlmClient(base_url="https://api.example.com/v1", api_key="sk-test",
                     model="deepseek-v4-flash", **kwargs)


def test_llm_client_success(monkeypatch):
    import data_pipeline.llm as llm_mod
    calls = {}

    def fake_urlopen(req, timeout=30):
        calls["body"] = req.data
        calls["auth"] = req.get_header("Authorization")
        return _FakeResponse({"choices": [{"message": {"content": "Fine."},
                                           "finish_reason": "stop"}]})

    monkeypatch.setattr(llm_mod.urllib.request, "urlopen", fake_urlopen)
    client = _client()
    assert client.summarize("input text") == "Fine."
    assert calls["auth"] == "Bearer sk-test"
    assert b"deepseek-v4-flash" in calls["body"]
    # Regression: without `thinking: {type: "disabled"}` deepseek-v4-flash burns
    # max_tokens on reasoning_content and returns empty content (finish_reason=
    # "length"). Verified against the real API 2026-08-17: thinking disabled ->
    # 0 reasoning tokens, finish_reason="stop". The request body MUST carry it.
    import json as _json
    sent = _json.loads(calls["body"])
    assert sent["thinking"] == {"type": "disabled"}


def test_llm_client_empty_content_is_failure(monkeypatch):
    import data_pipeline.llm as llm_mod

    def fake_urlopen(req, timeout=30):
        return _FakeResponse({"choices": [{"message": {"content": ""},
                                           "finish_reason": "length"}]})

    monkeypatch.setattr(llm_mod.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(LlmError, match="empty content"):
        _client().summarize("x")


def test_llm_client_finish_reason_length_is_failure(monkeypatch):
    import data_pipeline.llm as llm_mod

    def fake_urlopen(req, timeout=30):
        return _FakeResponse({"choices": [{"message": {"content": "partial"},
                                           "finish_reason": "length"}]})

    monkeypatch.setattr(llm_mod.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(LlmError, match="truncated"):
        _client().summarize("x")


def test_llm_client_http_error_is_failure_and_retries(monkeypatch):
    import urllib.error
    import data_pipeline.llm as llm_mod
    attempts = {"n": 0}

    def fake_urlopen(req, timeout=30):
        attempts["n"] += 1
        raise urllib.error.HTTPError(req.full_url, 500, "boom", {}, None)

    monkeypatch.setattr(llm_mod.urllib.request, "urlopen", fake_urlopen)
    client = _client(retries=2)
    with pytest.raises(LlmError, match="failed after 3 attempts"):
        client.summarize("x")
    assert attempts["n"] == 3


def test_llm_client_circuit_breaker_opens_after_threshold(monkeypatch):
    import urllib.error
    import data_pipeline.llm as llm_mod
    attempts = {"n": 0}

    def fake_urlopen(req, timeout=30):
        attempts["n"] += 1
        raise urllib.error.URLError("net down")

    monkeypatch.setattr(llm_mod.urllib.request, "urlopen", fake_urlopen)
    client = _client(retries=0, breaker_threshold=3)
    for _ in range(3):
        with pytest.raises(LlmError):
            client.summarize("x")
    assert attempts["n"] == 3
    with pytest.raises(CircuitOpenError):
        client.summarize("x")
    assert attempts["n"] == 3  # no HTTP call once the breaker is open


def test_llm_client_recovers_after_success(monkeypatch):
    import data_pipeline.llm as llm_mod
    state = {"fail": True}

    def fake_urlopen(req, timeout=30):
        if state["fail"]:
            state["fail"] = False
            raise TimeoutError("slow")
        return _FakeResponse({"choices": [{"message": {"content": "ok"},
                                           "finish_reason": "stop"}]})

    monkeypatch.setattr(llm_mod.urllib.request, "urlopen", fake_urlopen)
    client = _client(retries=2)
    assert client.summarize("x") == "ok"
    assert client.summarize("x") == "ok"  # breaker reset by the success
