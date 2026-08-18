"""Assemble and write the locked snapshot JSON.

Outputs (assignment): ``public/data/7d.json`` (eager, full shape, sessions
windowed to 7d with summaries kept), the lazy per-range slices
``public/data/{30d,90d,1y,all}.json`` (sessions stripped to what repo
aggregation needs), plus a dated archive ``public/data/history/YYYY-MM-DD.json``
(the full snapshot). ``public/data/current.json`` is removed. Every history
file is kept.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

from .config import MAX_ACTIVITY_ITEMS, RANGE_DAYS
from .gitlog import Commit
from .metrics import build_ranges, build_recent_activity

# Lazy slices: windowed sessions stripped to these keys (locked schema).
_LAZY_RANGES = ("30d", "90d", "1y", "all")
_STRIPPED_KEYS = ("harness", "repo", "sessionId", "day", "assistantMessages", "locDelta", "prRefs")


def build_snapshot(
    entries: list[dict],
    commits: list[Commit],
    *,
    pricing_available: bool,
    branches: dict[str, dict[str, str]] | None = None,
    tz=None,
    now: datetime | None = None,
    sessions: list[dict] | None = None,
) -> dict:
    """Locked snapshot dict: snapshotDate, generatedAt, ranges, recentActivity.

    ``sessions`` is additive and defaults to empty so the schema stays stable.
    """
    if now is None:
        now = datetime.now().astimezone()
    local_now = now.astimezone(tz) if tz else now
    ranges = build_ranges(
        entries, commits, pricing_available=pricing_available, tz=tz, now=now
    )
    activity = build_recent_activity(commits, branches or {})
    return {
        "snapshotDate": local_now.date().isoformat(),
        "generatedAt": local_now.isoformat(timespec="seconds"),
        "ranges": ranges,
        "recentActivity": activity[:MAX_ACTIVITY_ITEMS],
        "sessions": sessions or [],
    }


def _window_sessions(
    sessions: list[dict], days: int | None, snapshot_date: str
) -> list[dict]:
    """Sessions whose ``day`` falls in the inclusive window
    ``[snapshot_date - (days - 1), snapshot_date]``.

    ``days`` None ('all') → everything; sessions with an empty ``day`` are
    excluded from windowed ranges. Order is preserved.
    """
    if days is None:
        return list(sessions)
    start = (date.fromisoformat(snapshot_date) - timedelta(days=days - 1)).isoformat()
    return [s for s in sessions if s.get("day") and start <= s["day"] <= snapshot_date]


def _strip_sessions(sessions: list[dict]) -> list[dict]:
    """Reduce each session to the lazy-slice keys (exactly).

    ``locDelta`` is copied as ``{added, removed}`` only — no ``net`` — and
    stays ``None`` when the session has no repo-day git stats.
    """
    stripped: list[dict] = []
    for s in sessions:
        loc_delta = s["locDelta"]
        if isinstance(loc_delta, dict):
            loc_delta = {"added": loc_delta["added"], "removed": loc_delta["removed"]}
        stripped.append({
            "harness": s["harness"],
            "repo": s["repo"],
            "sessionId": s["sessionId"],
            "day": s["day"],
            "assistantMessages": s["assistantMessages"],
            "locDelta": loc_delta,
            "prRefs": s["prRefs"],
        })
    return stripped


def write_outputs(snapshot: dict, public_data_dir: Path) -> list[Path]:
    """Write ``7d.json``, the four lazy slices, and ``history/YYYY-MM-DD.json``;
    unlink ``current.json`` (missing_ok). Returns every written path.
    """
    text = json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n"
    history_dir = public_data_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    snapshot_date = snapshot["snapshotDate"]
    sessions = snapshot["sessions"]
    paths: list[Path] = []

    # Eager 7d: full snapshot shape, sessions windowed to 7d, summaries kept.
    eager = dict(snapshot)
    eager["sessions"] = _window_sessions(sessions, RANGE_DAYS["7d"], snapshot_date)
    eager_path = public_data_dir / "7d.json"
    eager_path.write_text(
        json.dumps(eager, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    paths.append(eager_path)

    # Lazy slices: one range per file, sessions stripped.
    for name in _LAZY_RANGES:
        slice_path = public_data_dir / f"{name}.json"
        windowed = _window_sessions(sessions, RANGE_DAYS[name], snapshot_date)
        slice_snapshot = {
            "snapshotDate": snapshot_date,
            "generatedAt": snapshot["generatedAt"],
            "range": name,
            "sessions": _strip_sessions(windowed),
        }
        slice_path.write_text(
            json.dumps(slice_snapshot, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        paths.append(slice_path)

    # Dated archive: the full snapshot, unchanged.
    archive_path = history_dir / f"{snapshot_date}.json"
    archive_path.write_text(text, encoding="utf-8")
    paths.append(archive_path)

    # current.json is gone.
    (public_data_dir / "current.json").unlink(missing_ok=True)
    return paths
