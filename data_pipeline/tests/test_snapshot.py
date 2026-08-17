"""End-to-end snapshot tests: locked schema validation + file outputs."""

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from data_pipeline.config import RANGE_DAYS
from data_pipeline.gitlog import Commit
from data_pipeline.pricing import Pricing
from data_pipeline.snapshot import build_snapshot, write_outputs

TZ = ZoneInfo("Europe/Berlin")
NOW = datetime(2026, 8, 17, 20, 0, 0, tzinfo=timezone(timedelta(hours=2)))


def _entry(day_offset, tokens, session="s1", model="claude-opus-4-8"):
    ts = NOW + timedelta(days=-day_offset, hours=-8)
    ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
    return {
        "source": "claude", "session_id": session, "ts": ts, "model": model,
        "input_tokens": tokens, "output_tokens": tokens // 2,
        "cache_write_tokens": tokens // 4, "cache_read_tokens": tokens * 2,
        "input_cost": tokens / 1e6 * 5.0, "output_cost": tokens / 2 / 1e6 * 25.0,
        "cache_write_cost": tokens / 4 / 1e6 * 6.25,
        "cache_read_cost": tokens * 2 / 1e6 * 0.5,
        "total_cost": tokens / 1e6 * (5.0 + 12.5 + 1.5625 + 1.0),
    }


def _commit(day_offset, msg, repo="repo-a", added=40, removed=10):
    ts = NOW + timedelta(days=-day_offset, hours=-5)
    return Commit(repo=repo, sha=f"{day_offset:040x}", ts=ts, msg=msg,
                  added=added, removed=removed)


def _snapshot(tmp_path: Path) -> dict:
    pricing_path = tmp_path / "prices.json"
    pricing_path.write_text(json.dumps({"claude-opus-4-8": {
        "input_cost_per_token": 5e-6, "output_cost_per_token": 2.5e-5,
        "cache_creation_input_token_cost": 6.25e-6, "cache_read_input_token_cost": 5e-7,
    }}), encoding="utf-8")
    pricing = Pricing(pricing_path)
    entries = [_entry(i, 1000, session=f"s{i}") for i in range(0, 40)]
    commits = [
        _commit(0, "docs: update pipeline (#12)", repo="dev-portfolio"),
        _commit(1, "feat: add LTTB (#7)", repo="dev-portfolio"),
        _commit(2, "fix: no refs", repo="other-repo"),
        _commit(60, "old work", repo="old-repo"),
    ]
    branches = {"dev-portfolio": {commits[0].sha: "main", commits[1].sha: "main"}}
    return build_snapshot(entries, commits, pricing_available=pricing.available,
                          branches=branches, tz=TZ, now=NOW)


def test_snapshot_schema_complete():
    snap = _snapshot(Path("."))
    assert set(snap.keys()) == {"snapshotDate", "generatedAt", "ranges", "recentActivity"}
    assert snap["snapshotDate"] == "2026-08-17"
    assert snap["generatedAt"].startswith("2026-08-17T")
    assert set(snap["ranges"].keys()) == set(RANGE_DAYS.keys())


def test_range_stats_schema():
    snap = _snapshot(Path("."))
    for name, stats in snap["ranges"].items():
        assert set(stats.keys()) == {
            "tokenBurn", "tokensByModel", "cost", "sessions",
            "prsReferenced", "locDelta",
        }
        burn = stats["tokenBurn"]
        assert set(burn.keys()) == {"total", "changePct", "sparkline"}
        assert isinstance(burn["total"], int)
        assert isinstance(burn["changePct"], (float, type(None)))
        assert isinstance(burn["sparkline"], list)
        assert all(isinstance(v, (int, float)) for v in burn["sparkline"])

        assert isinstance(stats["tokensByModel"], list)
        for m in stats["tokensByModel"]:
            assert set(m.keys()) == {"model", "tokens"}

        cost = stats["cost"]
        assert set(cost["breakdown"].keys()) == {"input", "output", "cacheWrite", "cacheRead"}
        if cost["total"] is not None:
            # Components and total are rounded independently — allow float noise.
            assert cost["total"] == pytest.approx(
                sum(cost["breakdown"].values()), abs=1e-5
            )

        sessions = stats["sessions"]
        assert set(sessions.keys()) == {"total", "active"}

        prs = stats["prsReferenced"]
        assert set(prs.keys()) == {"count", "activeRepos", "sparkline"}

        loc = stats["locDelta"]
        assert set(loc.keys()) == {"net", "added", "removed", "sparkline"}
        assert loc["net"] == loc["added"] - loc["removed"]


def test_sparkline_point_counts_within_bounds():
    snap = _snapshot(Path("."))
    for name, stats in snap["ranges"].items():
        for key in ("tokenBurn", "prsReferenced"):
            spark = stats[key]["sparkline"]
            if spark:
                assert 1 <= len(spark) <= 15
        loc_spark = stats["locDelta"]["sparkline"]
        if loc_spark:
            assert all(len(pair) == 2 for pair in loc_spark)
            assert 1 <= len(loc_spark) <= 15


def test_token_burn_totals_across_ranges():
    snap = _snapshot(Path("."))
    # 40 entries × 3750 tokens each; windows: 7d → offsets 0..6, 30d → 0..29.
    assert snap["ranges"]["7d"]["tokenBurn"]["total"] == 7 * 3750
    assert snap["ranges"]["30d"]["tokenBurn"]["total"] == 30 * 3750
    assert snap["ranges"]["90d"]["tokenBurn"]["total"] == 40 * 3750
    assert snap["ranges"]["1y"]["tokenBurn"]["total"] == 40 * 3750
    assert snap["ranges"]["all"]["tokenBurn"]["total"] == 40 * 3750

def test_recent_activity_fields_and_order():
    snap = _snapshot(Path("."))
    activity = snap["recentActivity"]
    assert len(activity) <= 20
    assert [a["ts"] for a in activity] == sorted(
        (a["ts"] for a in activity), reverse=True
    )
    first = activity[0]
    assert set(first.keys()) == {
        "repo", "message", "prRefs", "branch", "linesAdded", "linesRemoved", "ts",
    }
    assert first["prRefs"] == [12]
    assert first["branch"] == "main"
    assert first["linesAdded"] == 40
    assert first["linesRemoved"] == 10


def test_write_outputs_writes_current_and_history(tmp_path):
    snap = _snapshot(tmp_path)
    current, archive = write_outputs(snap, tmp_path / "public" / "data")
    assert current == tmp_path / "public" / "data" / "current.json"
    assert archive == tmp_path / "public" / "data" / "history" / "2026-08-17.json"
    parsed = json.loads(current.read_text(encoding="utf-8"))
    assert parsed == snap
    # A second run keeps the existing history file.
    other = json.loads(archive.read_text(encoding="utf-8"))
    assert other == snap
    assert (tmp_path / "public" / "data" / "history").glob("*.json")


def test_json_serializable_no_nan(tmp_path):
    snap = _snapshot(tmp_path)
    text = json.dumps(snap, allow_nan=False)  # raises on NaN/Infinity
    assert isinstance(text, str)
