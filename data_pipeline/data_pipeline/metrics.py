"""Range aggregation into the locked snapshot schema.

Mirrors loc-dock ``usage_store.rs`` serving queries (``query_aggregates``,
``query_token_buckets``, ``query_cost_buckets``, ``count_sessions``,
``query_commit_totals``, ``query_commit_buckets``) and ``data.rs``
``build_one_range``, with the assignment's changes: five ranges
(7d/30d/90d/1y/all), local-timezone daily bucketing (never UTC), LTTB
downsampling to 12–15 points, and ``tokenBurn.changePct`` vs the prior
window of equal length.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone, timedelta, tzinfo
from typing import Sequence

from .config import ACTIVE_SESSION_SECONDS, MAX_ACTIVITY_ITEMS, RANGE_DAYS, SPARKLINE_POINTS
from .gitlog import Commit, extract_prs
from .lttb import lttb, lttb_2d

COST_KEYS = ("input", "output", "cacheWrite", "cacheRead")


def _local_date(dt: datetime, tz: tzinfo | None) -> date:
    if tz is None:
        return dt.astimezone().date()
    return dt.astimezone(tz).date()


def _entry_local_date(entry: dict, tz: tzinfo | None) -> date:
    ts = entry["ts"]
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return _local_date(ts, tz)


def _window_dates(start: date, end: date) -> list[date]:
    days: list[date] = []
    current = start
    while current <= end:
        days.append(current)
        current += timedelta(days=1)
    return days


def _token_total(entry: dict) -> int:
    return (
        entry["input_tokens"]
        + entry["output_tokens"]
        + entry["cache_write_tokens"]
        + entry["cache_read_tokens"]
    )


def _lttb_or_empty(values: Sequence[float]) -> list[float]:
    if not any(v for v in values):
        return []
    return lttb(values, SPARKLINE_POINTS)


def build_ranges(
    entries: list[dict],
    commits: list[Commit],
    *,
    pricing_available: bool,
    tz: tzinfo | None = None,
    now: datetime | None = None,
) -> dict[str, dict]:
    """Aggregate every range into RangeStats-shaped dicts.

    ``tz`` injects a fixed zone for tests; ``None`` uses the machine's local
    timezone (assignment: bucket days by LOCAL timezone, never UTC).
    """
    if now is None:
        now = datetime.now().astimezone()
    now_local = now.astimezone(tz) if tz else now
    today = now_local.date()

    # Global "active sessions" (mirror loc-dock count_sessions: distinct
    # session_ids with a row within the idle-timeout window, range-agnostic).
    active_cutoff = now - timedelta(seconds=ACTIVE_SESSION_SECONDS)
    active_sessions = {e["session_id"] for e in entries if _as_utc(e["ts"]) >= active_cutoff}

    entry_dates = [_entry_local_date(e, tz) for e in entries]
    commit_dates = [_local_date(c.ts, tz) for c in commits]
    all_dates = entry_dates + commit_dates

    ranges: dict[str, dict] = {}
    for name, days in RANGE_DAYS.items():
        if days is None:
            start = min(all_dates) if all_dates else today
        else:
            start = today - timedelta(days=days - 1)
        window = _window_dates(start, today)
        index = {d: i for i, d in enumerate(window)}

        range_entries = [e for e in entries if _entry_local_date(e, tz) in index]
        range_commits = [c for c in commits if _local_date(c.ts, tz) in index]

        ranges[name] = _build_one_range(
            name,
            range_entries,
            range_commits,
            entries,
            window,
            index,
            active_sessions,
            pricing_available,
            tz,
            today,
        )
    return ranges


def _build_one_range(
    name: str,
    range_entries: list[dict],
    range_commits: list[Commit],
    all_entries: list[dict],
    window: list[date],
    index: dict[date, int],
    active_sessions: set,
    pricing_available: bool,
    tz: tzinfo | None,
    today: date,
) -> dict:
    # ── Tokens ────────────────────────────────────────────────────────────
    token_total = sum(_token_total(e) for e in range_entries)
    daily_tokens = [0] * len(window)
    per_model: dict[str, int] = defaultdict(int)
    for e in range_entries:
        daily_tokens[index[_entry_local_date(e, tz)]] += _token_total(e)
        per_model[e["model"] or "(unknown)"] += _token_total(e)

    tokens_by_model = sorted(
        ({"model": m, "tokens": t} for m, t in per_model.items()),
        key=lambda item: (-item["tokens"], item["model"]),
    )

    # ── Cost (per model via LiteLLM; null when pricing unavailable) ───────
    if pricing_available:
        cost_total = round(sum(e["total_cost"] for e in range_entries), 6)
        cost_breakdown = {
            "input": round(sum(e["input_cost"] for e in range_entries), 6),
            "output": round(sum(e["output_cost"] for e in range_entries), 6),
            "cacheWrite": round(sum(e["cache_write_cost"] for e in range_entries), 6),
            "cacheRead": round(sum(e["cache_read_cost"] for e in range_entries), 6),
        }
    else:
        cost_total = None
        cost_breakdown = {"input": 0.0, "output": 0.0, "cacheWrite": 0.0, "cacheRead": 0.0}

    # ── Sessions ──────────────────────────────────────────────────────────
    sessions_total = len({e["session_id"] for e in range_entries})
    sessions_active = len({s for s in active_sessions if s})

    # ── PRs + LOC from commits ─────────────────────────────────────────────
    pr_numbers: set[int] = set()
    repos_with_prs: set[str] = set()
    daily_pr_counts = [0] * len(window)
    daily_loc = [[0, 0] for _ in window]
    loc_added = 0
    loc_removed = 0
    for c in range_commits:
        loc_added += c.added
        loc_removed += c.removed
        daily_loc[index[_local_date(c.ts, tz)]][0] += c.added
        daily_loc[index[_local_date(c.ts, tz)]][1] += c.removed
        refs = extract_prs(c.msg)
        if refs:
            day_prs = set(refs)
            pr_numbers.update(day_prs)
            repos_with_prs.add(c.repo)
            daily_pr_counts[index[_local_date(c.ts, tz)]] += len(day_prs)

    # ── changePct vs the prior window of equal length (null for "all") ────
    change_pct = _change_pct(name, all_entries, tz, today)

    return {
        "tokenBurn": {
            "total": token_total,
            "changePct": change_pct,
            "sparkline": _lttb_or_empty(daily_tokens),
        },
        "tokensByModel": tokens_by_model,
        "cost": {"total": cost_total, "breakdown": cost_breakdown},
        "sessions": {"total": sessions_total, "active": sessions_active},
        "prsReferenced": {
            "count": len(pr_numbers),
            "activeRepos": len(repos_with_prs),
            "sparkline": _lttb_or_empty(daily_pr_counts),
        },
        "locDelta": {
            "net": loc_added - loc_removed,
            "added": loc_added,
            "removed": loc_removed,
            "sparkline": lttb_2d(daily_loc, SPARKLINE_POINTS) if loc_added or loc_removed else [],
        },
    }


def _change_pct(
    name: str,
    all_entries: list[dict],
    tz: tzinfo | None,
    today: date,
) -> float | None:
    days = RANGE_DAYS[name]
    if days is None:
        return None
    prev_start = today - timedelta(days=2 * days - 1)
    prev_end = today - timedelta(days=days)
    prev_dates = set(_window_dates(prev_start, prev_end))
    prev_total = sum(
        _token_total(e) for e in all_entries if _entry_local_date(e, tz) in prev_dates
    )
    if prev_total <= 0:
        return None
    current = sum(
        _token_total(e)
        for e in all_entries
        if prev_end < _entry_local_date(e, tz) <= today
    )
    return round((current - prev_total) / prev_total * 100.0, 1)


def build_recent_activity(
    commits: list[Commit],
    branches: dict[str, dict[str, str]],
    limit: int = MAX_ACTIVITY_ITEMS,
) -> list[dict]:
    """Newest-first activity items (mirror ``build_summary_data`` ordering;
    branch best-effort, null when ambiguous)."""
    items = []
    for c in sorted(commits, key=lambda c: c.ts, reverse=True):
        refs = extract_prs(c.msg)
        branch = branches.get(c.repo, {}).get(c.sha)
        items.append(
            {
                "repo": c.repo,
                "message": c.msg,
                "prRefs": refs,
                "branch": branch,
                "linesAdded": c.added,
                "linesRemoved": c.removed,
                "ts": c.ts.isoformat(timespec="seconds"),
            }
        )
        if len(items) >= limit:
            break
    return items


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
