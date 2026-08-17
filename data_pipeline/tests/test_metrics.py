"""Aggregation tests: 5 ranges, changePct, sparklines, sessions, PRs, LOC.

All tests pin a fixed timezone and "now" so bucketing is deterministic even
though the pipeline defaults to the machine's local timezone.
"""

from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

import pytest

from data_pipeline.config import SPARKLINE_POINTS
from data_pipeline.gitlog import Commit
from data_pipeline.metrics import build_ranges, build_recent_activity

# Berlin is UTC+2 in August — good for local-vs-UTC bucketing checks.
TZ = ZoneInfo("Europe/Berlin")
NOW = datetime(2026, 8, 17, 20, 0, 0, tzinfo=timezone(timedelta(hours=2)))  # local 08-17 20:00


def _entry(day_offset: int, tokens: int, session: str = "s1", model: str = "claude-opus-4-8",
           hour: int = 12) -> dict:
    """Entry at local date NOW.date() - day_offset, ``hour`` local."""
    ts = NOW + timedelta(days=-day_offset, hours=hour - 20)
    ts = ts.astimezone(timezone.utc).replace(tzinfo=None)  # DuckDB returns naive UTC
    return {
        "source": "claude",
        "session_id": session,
        "ts": ts,
        "model": model,
        "input_tokens": tokens,
        "output_tokens": 0,
        "cache_write_tokens": 0,
        "cache_read_tokens": 0,
        "input_cost": tokens / 1e6 * 5.0,
        "output_cost": 0.0,
        "cache_write_cost": 0.0,
        "cache_read_cost": 0.0,
        "total_cost": tokens / 1e6 * 5.0,
    }


def _commit(day_offset: int, msg: str, repo: str = "repo-a", added: int = 10,
            removed: int = 4, hour: int = 15) -> Commit:
    ts = NOW + timedelta(days=-day_offset, hours=hour - 20)
    return Commit(repo=repo, sha=f"{day_offset:040x}", ts=ts, msg=msg, added=added, removed=removed)


def test_five_ranges_present():
    entries = [_entry(1, 100), _entry(60, 50)]
    commits = [_commit(2, "fix (#1)")]
    ranges = build_ranges(entries, commits, pricing_available=True, tz=TZ, now=NOW)
    assert set(ranges.keys()) == {"7d", "30d", "90d", "1y", "all"}


def test_range_totals_and_windows():
    # 7d window covers local offsets 0..6, 30d → 0..29, 90d → 0..89, 1y → 0..364.
    entries = [_entry(1, 100), _entry(5, 50), _entry(20, 25), _entry(80, 10)]
    commits = [_commit(2, "fix")]
    ranges = build_ranges(entries, commits, pricing_available=True, tz=TZ, now=NOW)
    assert ranges["7d"]["tokenBurn"]["total"] == 150
    assert ranges["30d"]["tokenBurn"]["total"] == 175
    assert ranges["90d"]["tokenBurn"]["total"] == 185
    assert ranges["1y"]["tokenBurn"]["total"] == 185
    assert ranges["all"]["tokenBurn"]["total"] == 185


def test_change_pct_vs_prior_window():
    # 7d window: local offsets 0..6 hold 100 tokens each (700); the prior
    # 7 days (offsets 7..13) hold 200 each (1400) → -50.0%.
    entries = [_entry(i, 100, session=f"s{i}") for i in range(0, 7)]
    entries += [_entry(i, 200, session=f"p{i}") for i in range(7, 14)]
    ranges = build_ranges(entries, [], pricing_available=True, tz=TZ, now=NOW)
    assert ranges["7d"]["tokenBurn"]["total"] == 700
    assert ranges["7d"]["tokenBurn"]["changePct"] == -50.0


def test_change_pct_null_when_no_prior_data():
    entries = [_entry(1, 100)]
    ranges = build_ranges(entries, [], pricing_available=True, tz=TZ, now=NOW)
    assert ranges["7d"]["tokenBurn"]["changePct"] is None
    assert ranges["all"]["tokenBurn"]["changePct"] is None


def test_sparkline_daily_buckets_and_downsample():
    entries = [_entry(i, i * 10, session=f"s{i}") for i in range(0, 30)]
    ranges = build_ranges(entries, [], pricing_available=True, tz=TZ, now=NOW)
    spark = ranges["30d"]["tokenBurn"]["sparkline"]
    # LTTB keeps endpoints and the peak. Buckets run oldest → newest, so the
    # first point is offset 29 (290 tokens) and the last is today (0).
    assert spark[0] == 290
    assert spark[-1] == 0
    assert max(spark) == 290


def test_sparkline_empty_without_data():
    ranges = build_ranges([], [], pricing_available=True, tz=TZ, now=NOW)
    assert ranges["7d"]["tokenBurn"]["sparkline"] == []


def test_tokens_by_model_sorted_desc():
    entries = [
        _entry(1, 300, model="claude-opus-4-8"),
        _entry(2, 900, model="deepseek-v4-flash"),
        _entry(3, 500, model="claude-opus-4-8"),
    ]
    ranges = build_ranges(entries, [], pricing_available=True, tz=TZ, now=NOW)
    by_model = ranges["7d"]["tokensByModel"]
    totals = [m["tokens"] for m in by_model]
    assert totals == sorted(totals, reverse=True)
    assert by_model[0]["model"] == "deepseek-v4-flash"
    assert by_model[0]["tokens"] == 900
    assert by_model[1]["model"] == "claude-opus-4-8"
    assert by_model[1]["tokens"] == 800

def test_cost_breakdown_and_null_when_unavailable():
    entries = [
        _entry(1, 1000),
        _entry(2, 2000, model="claude-sonnet-4-20250514"),
    ]
    ranges = build_ranges(entries, [], pricing_available=True, tz=TZ, now=NOW)
    cost = ranges["7d"]["cost"]
    assert cost["total"] == pytest.approx(sum(e["total_cost"] for e in entries))
    b = cost["breakdown"]
    assert b["input"] + b["output"] + b["cacheWrite"] + b["cacheRead"] == pytest.approx(
        cost["total"]
    )
    # Pricing unavailable → total null, breakdown zeros.
    ranges = build_ranges(entries, [], pricing_available=False, tz=TZ, now=NOW)
    cost = ranges["7d"]["cost"]
    assert cost["total"] is None
    assert cost["breakdown"] == {"input": 0.0, "output": 0.0, "cacheWrite": 0.0, "cacheRead": 0.0}


def test_sessions_total_and_active():
    # s1 seen 1 day ago; s2 seen just now (within the idle timeout).
    entries = [_entry(1, 10, session="s1"), _entry(0, 20, session="s2", hour=20)]
    ranges = build_ranges(entries, [], pricing_available=True, tz=TZ, now=NOW)
    assert ranges["7d"]["sessions"] == {"total": 2, "active": 1}


def test_prs_referenced_and_active_repos():
    commits = [
        _commit(1, "fix auth (#42)", repo="repo-a"),
        _commit(2, "fix auth (#42)", repo="repo-a"),  # duplicate ref
        _commit(3, "add feature (#7)", repo="repo-a"),
        _commit(4, "docs only", repo="repo-b"),
    ]
    ranges = build_ranges([], commits, pricing_available=True, tz=TZ, now=NOW)
    prs = ranges["7d"]["prsReferenced"]
    assert prs["count"] == 2  # distinct {42, 7}
    assert prs["activeRepos"] == 1
    assert len(prs["sparkline"]) == 7


def test_loc_delta_and_sparkline_pairs():
    commits = [_commit(1, "big change", added=120, removed=30)]
    ranges = build_ranges([], commits, pricing_available=True, tz=TZ, now=NOW)
    loc = ranges["7d"]["locDelta"]
    # 7 daily buckets; the commit lands on local 08-16 (index 5).
    assert loc["net"] == 90
    assert loc["added"] == 120
    assert loc["removed"] == 30
    assert loc["sparkline"] == [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [120, 30], [0, 0]]


def test_recent_activity_newest_first_capped():
    commits = [_commit(i, f"commit {i} (#{i})", repo="repo-a") for i in range(30)]
    branches = {"repo-a": {c.sha: "main" for c in commits}}
    activity = build_recent_activity(commits, branches, limit=20)
    assert len(activity) == 20
    timestamps = [a["ts"] for a in activity]
    assert timestamps == sorted(timestamps, reverse=True)
    assert activity[0]["message"] == "commit 0 (#0)"
    assert activity[0]["prRefs"] == [0]
    assert activity[0]["branch"] == "main"
    assert activity[0]["repo"] == "repo-a"


def test_branch_null_when_ambiguous():
    commits = [_commit(1, "merge"), _commit(2, "other")]
    # No branch map entry → None.
    activity = build_recent_activity(commits, {})
    assert activity[0]["branch"] is None
    # A sha present in the map gets its branch; an unmapped sha stays None.
    branches = {"repo-a": {commits[0].sha: "main"}}
    activity = build_recent_activity(commits, branches)
    assert activity[1]["branch"] is None
    assert activity[0]["branch"] == "main"


def test_local_timezone_bucketing_not_utc():
    # 2026-08-17T23:30Z is 2026-08-18 01:30 local in Berlin (UTC+2) — it must
    # NOT count toward the 7d window that ends local 2026-08-17.
    late_utc = datetime(2026, 8, 17, 23, 30, tzinfo=timezone.utc)
    entry = {
        "source": "claude",
        "session_id": "s1",
        "ts": late_utc,
        "model": "m",
        "input_tokens": 500,
        "output_tokens": 0,
        "cache_write_tokens": 0,
        "cache_read_tokens": 0,
        "input_cost": 0.0,
        "output_cost": 0.0,
        "cache_write_cost": 0.0,
        "cache_read_cost": 0.0,
        "total_cost": 0.0,
    }
    ranges = build_ranges([entry], [], pricing_available=True, tz=TZ, now=NOW)
    assert ranges["7d"]["tokenBurn"]["total"] == 0  # local date 08-18 > today
    # Bucketing in UTC lands the same row on 08-17 → inside the window.
    ranges_utc = build_ranges([entry], [], pricing_available=True, tz=timezone.utc, now=NOW)
    assert ranges_utc["7d"]["tokenBurn"]["total"] == 500


def test_all_range_spans_earliest_event():
    entries = [_entry(1, 10), _entry(300, 10)]
    ranges = build_ranges(entries, [], pricing_available=True, tz=TZ, now=NOW)
    assert ranges["all"]["tokenBurn"]["total"] == 20
    assert len(ranges["all"]["tokenBurn"]["sparkline"]) == SPARKLINE_POINTS
