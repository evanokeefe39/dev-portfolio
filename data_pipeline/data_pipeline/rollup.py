"""Coarse-grain LLM rollups per (repo x harness), cached immutably.

A rollup key is ``"{grain}|{repo}|{harness}|{window_end}"`` where ``window_end``
is the snapshot's local date. The cache entry is ``{"hash", "summary", "ts"}``;
when a key's window content hash is unchanged the cached summary is reused with
zero LLM calls. Failures are recorded as ``rollupError`` per key and retried on
the next run; the snapshot is always written regardless.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .config import (
    LLM_BREAKER_THRESHOLD,
    ROLLUP_CHARS_PER_TOKEN,
    ROLLUP_MAX_INPUT_TOKENS,
)
from .llm import CircuitOpenError, LlmClient, LlmError

logger = logging.getLogger(__name__)

GRAINS: dict[str, int | None] = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": None}


def content_hash(sessions: list[dict]) -> str:
    """sha256 over sorted ``sessionId|summary-or-fallback`` lines (stable)."""
    lines = sorted(
        f"{session['sessionId']}|{session.get('summary') or session.get('fallback')}"
        for session in sessions
        if session.get("summary") or session.get("fallback")
    )
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()


def window_sessions(
    sessions: list[dict],
    *,
    grain_days: int | None,
    window_end: date,
) -> list[dict]:
    """Sessions whose local start day falls within the grain window (inclusive)."""
    if grain_days is None:
        return sessions
    start = window_end - timedelta(days=grain_days - 1)
    return [
        session
        for session in sessions
        if start.isoformat() <= session["day"] <= window_end.isoformat()
    ]

def truncate_to_budget(lines: list[str], max_chars: int) -> list[str]:
    """Keep newest-first lines within ``max_chars`` (incl. newline separators)."""
    kept: list[str] = []
    used = 0
    for line in lines:
        if not line:
            continue
        cost = len(line) + (1 if kept else 0)  # '\n' between lines
        if used + cost <= max_chars:
            kept.append(line)
            used += cost
        else:
            room = max_chars - used - (1 if kept else 0)
            if room > 0:
                kept.append(line[:room])
                used += room + (1 if kept else 0)
            break
    return kept


def build_prompt_input(
    sessions: list[dict],
    *,
    max_chars: int = ROLLUP_MAX_INPUT_TOKENS * ROLLUP_CHARS_PER_TOKEN,
) -> str:
    """User-message lines ``- [harness] repo: summary-or-fallback``, newest-first."""
    ordered = sorted(sessions, key=lambda s: s["startTs"], reverse=True)
    lines = [
        f"- [{session['harness']}] {session['repo']}: "
        f"{session.get('summary') or session.get('fallback')}"
        for session in ordered
        if session.get("summary") or session.get("fallback")
    ]
    return "\n".join(truncate_to_budget(lines, max_chars))


def _load_cache(cache_path: Path) -> dict:
    """Absent/malformed cache file is treated as empty (never crashes)."""
    if not cache_path.exists():
        return {}
    try:
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError) as err:
        logger.warning("rollup cache unreadable (%s); starting empty", err)
        return {}


def _save_cache(cache_path: Path, cache: dict) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps(cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def compute_rollups(
    sessions: list[dict],
    *,
    window_end: date,
    cache_path: Path,
    client: LlmClient | None = None,
    now: datetime | None = None,
    grains: dict[str, int | None] | None = None,
) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    """Compute ``rollups`` + ``rollupErrors`` for every grain.

    Preconditions:
    - ``sessions`` is the harvest output (fields: harness, repo, sessionId, day,
      summary, fallback).
    - ``client`` is None when no API key is configured → every key that needs a
      call records a rollupError and nothing is called.
    - ``grains`` defaults to the five standard grains; injectable for tests.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if grains is None:
        grains = GRAINS
    cache = _load_cache(cache_path)
    rollups: dict[str, dict[str, str]] = {grain: {} for grain in grains}
    rollup_errors: dict[str, dict[str, str]] = {grain: {} for grain in grains}
    consecutive_failures = 0
    changed = False

    for grain, grain_days in grains.items():
        in_window = window_sessions(sessions, grain_days=grain_days, window_end=window_end)
        groups: dict[tuple[str, str], list[dict]] = {}
        for session in in_window:
            if session.get("summary") or session.get("fallback"):
                groups.setdefault((session["repo"], session["harness"]), []).append(session)

        for (repo, harness), group_sessions in sorted(groups.items()):
            key = f"{grain}|{repo}|{harness}|{window_end.isoformat()}"
            digest = content_hash(group_sessions)
            cached = cache.get(key)
            if cached and cached.get("hash") == digest:
                rollups[grain][f"{repo}|{harness}"] = cached["summary"]
                continue

            # No content → no key (empty window contract).
            if client is None:
                rollup_errors[grain][f"{repo}|{harness}"] = (
                    "LLM call failed: LLM_API_KEY not configured"
                )
                continue
            if consecutive_failures >= LLM_BREAKER_THRESHOLD:
                rollup_errors[grain][f"{repo}|{harness}"] = (
                    f"LLM call failed: circuit breaker open after "
                    f"{consecutive_failures} consecutive failures"
                )
                continue

            prompt = build_prompt_input(group_sessions)
            try:
                summary = client.summarize(prompt)
            except (LlmError, CircuitOpenError) as err:
                consecutive_failures += 1
                rollup_errors[grain][f"{repo}|{harness}"] = f"LLM call failed: {err}"
                logger.warning("rollup failed for %s: %s", key, err)
                continue
            consecutive_failures = 0
            rollups[grain][f"{repo}|{harness}"] = summary
            cache[key] = {
                "hash": digest,
                "summary": summary,
                "ts": now.isoformat(timespec="seconds"),
            }
            changed = True

    if changed:
        _save_cache(cache_path, cache)
    return rollups, rollup_errors
