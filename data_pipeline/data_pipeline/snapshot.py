"""Assemble and write the locked snapshot JSON.

Outputs (assignment): ``public/data/current.json`` plus a dated archive
``public/data/history/YYYY-MM-DD.json``. Every history file is kept.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from .config import MAX_ACTIVITY_ITEMS
from .gitlog import Commit
from .metrics import build_ranges, build_recent_activity


def build_snapshot(
    entries: list[dict],
    commits: list[Commit],
    *,
    pricing_available: bool,
    branches: dict[str, dict[str, str]] | None = None,
    tz=None,
    now: datetime | None = None,
) -> dict:
    """Locked snapshot dict: snapshotDate, generatedAt, ranges, recentActivity."""
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
    }


def write_outputs(snapshot: dict, public_data_dir: Path) -> tuple[Path, Path]:
    """Write ``current.json`` + ``history/YYYY-MM-DD.json``; both fresh."""
    text = json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n"
    history_dir = public_data_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    current_path = public_data_dir / "current.json"
    current_path.write_text(text, encoding="utf-8")
    archive_path = history_dir / f"{snapshot['snapshotDate']}.json"
    archive_path.write_text(text, encoding="utf-8")
    return current_path, archive_path
