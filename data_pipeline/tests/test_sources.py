"""Bronze→silver ingestion tests: DuckDB read_ndjson_objects parsing.

Synthetic JSONL written to tmp dirs exercises the real extraction SQL: role
filtering, usage mapping (snake_case claude / camelCase pi), session-id
derivation, dedup, skip-subdir discovery, and per-model cost.
"""

import json
from datetime import datetime

import pytest

from data_pipeline.pricing import Pricing
from data_pipeline.sources import (
    discover_files,
    extract_entries,
    finalize_costs,
    ingest_source,
    open_entries_connection,
)


def _write(tmp_path, name, lines):
    p = tmp_path / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join(json.dumps(o) for o in lines) + "\n", encoding="utf-8")
    return p


def test_claude_extracts_assistant_rows_with_usage(tmp_path):
    session = "abc-123"
    p = _write(
        tmp_path,
        "session.jsonl",
        [
            {"type": "user", "sessionId": session, "timestamp": "2026-08-01T10:00:00Z",
             "message": {"role": "user", "content": "hi"}},
            {"type": "assistant", "sessionId": session, "timestamp": "2026-08-01T10:00:05Z",
             "message": {"role": "assistant", "model": "claude-opus-4-8", "usage": None}},
            {"type": "assistant", "sessionId": session, "timestamp": "2026-08-01T10:00:10Z",
             "message": {"role": "assistant", "model": "claude-opus-4-8", "usage": {}}},
            {"type": "assistant", "sessionId": session, "timestamp": "2026-08-01T10:00:15Z",
             "message": {"role": "assistant", "model": "claude-opus-4-8",
                         "usage": {"input_tokens": 10, "output_tokens": 5,
                                   "cache_creation_input_tokens": 3, "cache_read_input_tokens": 7}}},
        ],
    )
    con = open_entries_connection()
    # Mirror of loc-dock claude-silver.sql: only assistant rows with a
    # message.usage field; user rows and usage-less rows are excluded.
    # (DuckDB's `json_extract(...) IS NOT NULL` counts a JSON null as
    # present — loc-dock behaves identically — so the usage:null row is
    # kept as a zero-token row.)
    assert ingest_source(con, tmp_path, "claude", (), files=[p]) == 3
    rows = extract_entries(con)
    assert len(rows) == 3
    by_ts = {r["ts"].strftime("%H:%M:%S"): r for r in rows}
    assert by_ts["10:00:05"]["input_tokens"] == 0
    real = by_ts["10:00:15"]
    assert real["session_id"] == session
    assert real["model"] == "claude-opus-4-8"
    assert (real["input_tokens"], real["output_tokens"],
            real["cache_write_tokens"], real["cache_read_tokens"]) == (10, 5, 3, 7)
    assert real["ts"].date().isoformat() == "2026-08-01"
def test_claude_session_id_falls_back_to_filename(tmp_path):
    p = _write(
        tmp_path,
        "sess.jsonl",
        [{"type": "assistant", "timestamp": "2026-08-01T10:00:15Z",
          "message": {"role": "assistant", "model": "m",
                      "usage": {"input_tokens": 1}}},
         {"type": "assistant", "timestamp": "2026-08-01T10:00:16Z",
          "message": {"role": "assistant", "model": "m", "usage": {"input_tokens": 1}}}],
    )
    con = open_entries_connection()
    ingest_source(con, tmp_path, "claude", (), files=[p])
    rows = extract_entries(con)
    assert len(rows) == 2
    assert {r["session_id"] for r in rows} == {"sess"}


def test_dedup_on_source_session_ts(tmp_path):
    line = {"type": "assistant", "sessionId": "s", "timestamp": "2026-08-01T10:00:15Z",
            "message": {"role": "assistant", "model": "m", "usage": {"input_tokens": 5}}}
    p = _write(tmp_path, "dup.jsonl", [line, line])
    con = open_entries_connection()
    assert ingest_source(con, tmp_path, "claude", (), files=[p]) == 1
    assert len(extract_entries(con)) == 1


def test_pi_camelcase_mapping_and_cost_carry(tmp_path):
    p = _write(
        tmp_path,
        "2026-08-01T10-00-00-000Z_sess-1.jsonl",
        [
            {"type": "session", "id": "sess-1"},
            {"type": "model_change", "modelId": "deepseek-v4-flash", "provider": "deepseek"},
            {"type": "message", "timestamp": "2026-08-01T10:00:00Z",
             "message": {"role": "user", "content": "hi"}},
            {"type": "message", "timestamp": "2026-08-01T10:00:05Z",
             "message": {"role": "assistant", "model": "deepseek-v4-flash",
                         "usage": {"input": 100, "output": 20,
                                   "cacheWrite": 5, "cacheRead": 30,
                                   "cost": {"input": 0, "output": 0,
                                            "cacheWrite": 0, "cacheRead": 0, "total": 0}}}},
        ],
    )
    con = open_entries_connection()
    assert ingest_source(con, tmp_path, "pi", (), files=[p]) == 1
    rows = extract_entries(con)
    assert len(rows) == 1
    row = rows[0]
    assert row["session_id"] == "sess-1"
    assert row["model"] == "deepseek-v4-flash"
    assert (row["input_tokens"], row["output_tokens"],
            row["cache_write_tokens"], row["cache_read_tokens"]) == (100, 20, 5, 30)
    # Provider cost total was 0 → per-model pricing applies.
    finalize_costs(rows, Pricing(None))
    assert rows[0]["total_cost"] > 0


def test_pi_keeps_provider_cost_when_nonzero(tmp_path):
    p = _write(
        tmp_path,
        "2026-08-01T10-00-00-000Z_sess-2.jsonl",
        [{"type": "message", "timestamp": "2026-08-01T10:00:05Z",
          "message": {"role": "assistant", "model": "m",
                      "usage": {"input": 100, "output": 20,
                                "cacheWrite": 0, "cacheRead": 0,
                                "cost": {"input": 0.001, "output": 0.002,
                                         "cacheWrite": 0, "cacheRead": 0, "total": 0.003}}}}],
    )
    con = open_entries_connection()
    ingest_source(con, tmp_path, "pi", (), files=[p])
    rows = extract_entries(con)
    finalize_costs(rows, Pricing(None))
    assert rows[0]["total_cost"] == pytest.approx(0.003)


def test_codex_best_effort_extraction(tmp_path):
    p = _write(
        tmp_path,
        "rollout-2025-09-20T18-10-54-019967e4-8702-7e71-8d65-0ee1ce207ff4.jsonl",
        [
            {"timestamp": "2025-09-20T18:10:54Z", "type": "session_meta",
             "payload": {"id": "019967e4-8702-7e71-8d65-0ee1ce207ff4"}},
            {"timestamp": "2025-09-20T18:11:00Z", "type": "response_item",
             "payload": {"type": "message", "role": "assistant", "model": "gpt-5",
                         "usage": {"input_tokens": 50, "output_tokens": 10,
                                   "cache_creation_input_tokens": 0,
                                   "cache_read_input_tokens": 0}}},
            {"timestamp": "2025-09-20T18:11:01Z", "type": "response_item",
             "payload": {"type": "message", "role": "user", "content": "hi"}},
        ],
    )
    con = open_entries_connection()
    assert ingest_source(con, tmp_path, "codex", (), files=[p]) == 1
    rows = extract_entries(con)
    assert len(rows) == 1
    assert rows[0]["session_id"] == "019967e4-8702-7e71-8d65-0ee1ce207ff4"
    assert rows[0]["input_tokens"] == 50


def test_discovery_skips_subagent_and_memory_dirs(tmp_path):
    kept = _write(tmp_path, "ok/session.jsonl",
                  [{"type": "assistant", "timestamp": "2026-08-01T10:00:15Z",
                    "message": {"role": "assistant", "model": "m", "usage": {"input_tokens": 1}}}])
    _write(tmp_path, "subagents/agent-x.jsonl",
           [{"type": "assistant", "timestamp": "2026-08-01T10:00:15Z",
             "message": {"role": "assistant", "model": "m", "usage": {"input_tokens": 1}}}])
    _write(tmp_path, "memory/notes.jsonl",
           [{"type": "assistant", "timestamp": "2026-08-01T10:00:15Z",
             "message": {"role": "assistant", "model": "m", "usage": {"input_tokens": 1}}}])
    files = discover_files(tmp_path, ("subagents", "memory"))
    assert files == [kept]


def test_per_model_pricing_uses_litellm(tmp_path):
    pricing_path = tmp_path / "prices.json"
    pricing_path.write_text(
        json.dumps({"my-model": {
            "input_cost_per_token": 3e-6,     # $3 / MTok
            "output_cost_per_token": 15e-6,   # $15 / MTok
            "cache_creation_input_token_cost": 3.75e-6,
            "cache_read_input_token_cost": 3e-7,
        }}),
        encoding="utf-8",
    )
    pricing = Pricing(pricing_path)
    assert pricing.available
    cost = pricing.cost_for_model("my-model")
    in_c, out_c, cw_c, cr_c, total_c = cost.cost_of(1_000_000, 2_000_000, 500_000, 1_000_000)
    assert in_c == pytest.approx(3.0)
    assert out_c == pytest.approx(30.0)
    assert cw_c == pytest.approx(1.875)
    assert cr_c == pytest.approx(0.3)
    assert total_c == pytest.approx(35.175)


def test_unknown_model_falls_back_to_gpt4o_mini(tmp_path):
    pricing_path = tmp_path / "prices.json"
    pricing_path.write_text(json.dumps({"gpt-4o-mini": {
        "input_cost_per_token": 1.5e-7,
        "output_cost_per_token": 6e-7,
        "cache_creation_input_token_cost": 1.5e-7,
        "cache_read_input_token_cost": 7.5e-8,
    }}), encoding="utf-8")
    pricing = Pricing(pricing_path)
    cost = pricing.cost_for_model("no-such-model")
    assert cost.input_price == pytest.approx(0.15)
    assert cost.output_price == pytest.approx(0.60)

def test_omp_extracts_assistant_rows_with_direct_cost(tmp_path):
    """Top-level usage layout (assignment schema): tokens map camelCase→
    snake_case and cost is the provider's exact USD total, never LiteLLM."""
    session = "01a01037-f3b8-7000-8480-a87e884de7e3"
    p = _write(
        tmp_path,
        "2026-08-17T14-54-57-465Z_01a01037-f3b8-7000-8480-a87e884de7e3.jsonl",
        [
            {"type": "session", "id": session, "timestamp": "2026-08-17T14:54:57.465Z",
             "cwd": "C:\\Users\\evano\\repos\\dev-portfolio"},
            {"type": "message", "id": "bf756db2", "timestamp": "2026-08-17T15:02:06Z",
             "message": {"role": "user", "content": [{"type": "text", "text": "hi"}]}},
            {"type": "message", "id": "dca7ea0b", "timestamp": "2026-08-17T15:02:18Z",
             "message": {"role": "assistant", "content": [{"type": "toolCall"}]},
             "api": "openai-completions", "provider": "deepseek", "model": "deepseek-v4-pro",
             "usage": {"input": 368, "output": 75, "cacheRead": 30976, "cacheWrite": 0,
                       "totalTokens": 31419,
                       "cost": {"input": 0.00016008, "output": 0.00006525,
                                "cacheRead": 0.000112288, "cacheWrite": 0,
                                "total": 0.000337618}}},
        ],
    )
    con = open_entries_connection()
    assert ingest_source(con, tmp_path, "omp", (), files=[p]) == 1
    rows = extract_entries(con)
    assert len(rows) == 1
    row = rows[0]
    assert row["source"] == "omp"
    assert row["session_id"] == session
    assert row["model"] == "deepseek-v4-pro"
    assert (row["input_tokens"], row["output_tokens"],
            row["cache_write_tokens"], row["cache_read_tokens"]) == (368, 75, 0, 30976)
    finalize_costs(rows, Pricing(None))
    assert rows[0]["total_cost"] == pytest.approx(0.000337618)


def test_omp_skips_non_assistant_rows(tmp_path):
    """user/toolResult/session/model_change/thinking lines are not counted."""
    session = "01a01037-f3b8-7000-8480-a87e884de7e3"
    p = _write(
        tmp_path,
        "s.jsonl",
        [
            {"type": "session", "id": session, "timestamp": "2026-08-17T14:54:57Z",
             "cwd": "C:\\Users\\evano"},
            {"type": "model_change", "id": "adf43984", "timestamp": "2026-08-17T14:54:58Z",
             "model": "deepseek/deepseek-v4-pro"},
            {"type": "message", "id": "u1", "timestamp": "2026-08-17T15:02:06Z",
             "message": {"role": "user", "content": [{"type": "text", "text": "hi"}]}},
            {"type": "message", "id": "t1", "timestamp": "2026-08-17T15:02:08Z",
             "message": {"role": "toolResult", "content": []}},
            {"type": "message", "id": "a1", "timestamp": "2026-08-17T15:02:10Z",
             "message": {"role": "assistant", "content": [{"type": "thinking", "thinking": "..."}]}},
            {"type": "custom_message", "id": "c1", "timestamp": "2026-08-17T15:02:11Z"},
        ],
    )
    con = open_entries_connection()
    assert ingest_source(con, tmp_path, "omp", (), files=[p]) == 0
    assert extract_entries(con) == []


def test_omp_model_prefix_normalized(tmp_path):
    p = _write(
        tmp_path,
        "2026-08-17T14-54-57-465Z_01a01037-f3b8-7000-8480-a87e884de7e3.jsonl",
        [
            {"type": "session", "id": "01a01037-f3b8-7000-8480-a87e884de7e3",
             "timestamp": "2026-08-17T14:54:57Z"},
            {"type": "message", "id": "m1", "timestamp": "2026-08-17T15:02:18Z",
             "message": {"role": "assistant", "content": [{"type": "toolCall"}]},
             "model": "deepseek/deepseek-v4-pro",
             "usage": {"input": 1, "output": 1, "cacheRead": 0, "cacheWrite": 0,
                       "totalTokens": 2, "cost": {"total": 0.001}}},
        ],
    )
    con = open_entries_connection()
    ingest_source(con, tmp_path, "omp", (), files=[p])
    assert extract_entries(con)[0]["model"] == "deepseek-v4-pro"


def test_omp_session_id_from_session_line_or_filename(tmp_path):
    """session id comes from the type:"session" line; sibling subagent files
    (no ULID in the filename) still get it, and bare files fall back to the
    filename ULID segment."""
    session = "01a01065-f94d-7001-8739-4881a0db9664"
    sub = _write(
        tmp_path,
        "sess-1/data-pipeline.jsonl",
        [
            {"type": "session", "id": session, "timestamp": "2026-08-17T15:45:13Z"},
            {"type": "message", "id": "m1", "timestamp": "2026-08-17T15:45:16Z",
             "message": {"role": "assistant", "content": []},
             "model": "deepseek-v4-flash",
             "usage": {"input": 5, "output": 5, "cacheRead": 0, "cacheWrite": 0,
                       "totalTokens": 10, "cost": {"total": 0.002}}},
        ],
    )
    fallback = _write(
        tmp_path,
        "2026-08-17T16-00-00-000Z_01a01099-1111-7000-aaaa-bbbbccccdddd.jsonl",
        [
            {"type": "message", "id": "m2", "timestamp": "2026-08-17T16:00:05Z",
             "message": {"role": "assistant", "content": []},
             "model": "deepseek-v4-flash",
             "usage": {"input": 1, "output": 1, "cacheRead": 0, "cacheWrite": 0,
                       "totalTokens": 2, "cost": {"total": 0.0001}}},
        ],
    )
    con = open_entries_connection()
    ingest_source(con, tmp_path, "omp", (), files=[sub, fallback])
    rows = extract_entries(con)
    assert len(rows) == 2
    assert {r["session_id"] for r in rows} == {session, "01a01099-1111-7000-aaaa-bbbbccccdddd"}


def test_omp_message_usage_layout(tmp_path):
    """The harness moved usage/model inside `message` (verified on disk);
    the template must ingest that layout too."""
    session = "01a01037-f3b8-7000-8480-a87e884de7e3"
    p = _write(
        tmp_path,
        "2026-08-17T14-54-57-465Z_01a01037-f3b8-7000-8480-a87e884de7e3.jsonl",
        [
            {"type": "session", "id": session, "timestamp": "2026-08-17T14:54:57Z"},
            {"type": "message", "id": "dca7ea0b", "timestamp": "2026-08-17T15:02:18Z",
             "message": {"role": "assistant", "content": [{"type": "toolCall"}],
                         "api": "openai-completions", "provider": "deepseek",
                         "model": "deepseek-v4-flash",
                         "usage": {"input": 14772, "output": 226,
                                   "cacheRead": 3584, "cacheWrite": 0,
                                   "totalTokens": 18582,
                                   "cost": {"input": 0.00206808, "output": 0.00003164,
                                            "cacheRead": 0.0000100352, "cacheWrite": 0,
                                            "total": 0.0021097552}}}},
        ],
    )
    con = open_entries_connection()
    assert ingest_source(con, tmp_path, "omp", (), files=[p]) == 1
    row = extract_entries(con)[0]
    assert row["session_id"] == session
    assert row["model"] == "deepseek-v4-flash"
    assert (row["input_tokens"], row["output_tokens"],
            row["cache_write_tokens"], row["cache_read_tokens"]) == (14772, 226, 0, 3584)
    finalize_costs([row], Pricing(None))
    assert row["total_cost"] == pytest.approx(0.0021097552)


def test_omp_dedup_on_message_id(tmp_path):
    """Re-ingesting the same file must not double-count (UNIQUE key includes
    the OMP message id); distinct messages with the same timestamp both stay."""
    p = _write(
        tmp_path,
        "2026-08-17T14-54-57-465Z_01a01037-f3b8-7000-8480-a87e884de7e3.jsonl",
        [
            {"type": "session", "id": "01a01037-f3b8-7000-8480-a87e884de7e3",
             "timestamp": "2026-08-17T14:54:57Z"},
            {"type": "message", "id": "msg-a", "timestamp": "2026-08-17T15:02:18Z",
             "message": {"role": "assistant", "content": []}, "model": "m",
             "usage": {"input": 10, "output": 10, "cacheRead": 0, "cacheWrite": 0,
                       "totalTokens": 20, "cost": {"total": 0.001}}},
            {"type": "message", "id": "msg-b", "timestamp": "2026-08-17T15:02:18Z",
             "message": {"role": "assistant", "content": []}, "model": "m",
             "usage": {"input": 5, "output": 5, "cacheRead": 0, "cacheWrite": 0,
                       "totalTokens": 10, "cost": {"total": 0.0005}}},
        ],
    )
    con = open_entries_connection()
    assert ingest_source(con, tmp_path, "omp", (), files=[p]) == 2
    # Re-run the same ingestion (simulates a second pipeline pass) — no dupes.
    assert ingest_source(con, tmp_path, "omp", (), files=[p]) == 0
    rows = extract_entries(con)
    assert len(rows) == 2
    assert {r["message_id"] for r in rows} == {"msg-a", "msg-b"}

