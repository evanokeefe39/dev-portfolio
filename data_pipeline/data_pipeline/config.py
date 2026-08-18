"""Pipeline configuration and constants.

All knobs mirror the loc-dock implementation (see
``~/repos/loc-dock/docs/DATA_FLOWS.md``): retention depth, ingest batch
size, object-size cap, session idle timeout, sparkline target width.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# ── Time ranges (days). "all" spans the full ingested window. ──────────────
RANGE_DAYS: dict[str, int | None] = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
    "all": None,
}

# Sparklines are daily-bucketed then LTTB-downsampled to this many points
# (locked schema: 12-15).
SPARKLINE_POINTS = 14

# Mirror loc-dock RETENTION_DAYS = 400: the git scan reaches back this far,
# covering 1y (365d) plus margin. Overridable for testing.
GIT_SINCE_DAYS = int(os.environ.get("SNAPSHOT_GIT_SINCE_DAYS", "400"))

# Mirror loc-dock config.rs `session_idle_timeout` default (300 s): a session
# counts as "active" when it has a usage row within this window.
ACTIVE_SESSION_SECONDS = int(os.environ.get("SNAPSHOT_ACTIVE_SECONDS", "300"))

# read_ndjson_objects object-size cap (mirror loc-dock MAX_OBJECT_SIZE = 64 MB).
MAX_OBJECT_SIZE = 64 * 1024 * 1024

# JSONL files per read_ndjson_objects call (mirror loc-dock INGEST_BATCH_FILES = 8).
INGEST_BATCH_FILES = 8

# recentActivity cap (locked schema: max 20).
MAX_ACTIVITY_ITEMS = 20

# Cap for the `git log --source` branch-attribution pass per repo.
BRANCH_SCAN_LIMIT = 300


# ── Source roots (assignment). ──────────────────────────────────────────────
@dataclass(frozen=True)
class SourceRoots:
    claude: Path
    pi: Path
    codex: Path
    omp: Path
    repos: Path


def default_roots() -> SourceRoots:
    home = Path.home()
    return SourceRoots(
        claude=home / ".claude" / "projects",
        pi=home / ".pi" / "agent" / "sessions",
        codex=home / ".codex" / "sessions",
        omp=home / ".omp" / "agent" / "sessions",
        repos=home / "repos",
    )


SKIP_SUBDIRS: dict[str, tuple[str, ...]] = {
    "claude": ("subagents", "memory"),
    "pi": ("subagent-artifacts", "permission-forwarding"),
    "codex": (),
    "omp": (),  # sibling subagent/advisor logs are real usage — keep all files
}

# ── LLM rollup config (mirror loc-dock summary.rs; stdlib urllib only). ─────
DEFAULT_LLM_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_LLM_MODEL = "deepseek-v4-flash"
# deepseek-v4-flash burns output budget on `reasoning_content` before writing
# content — an empty-content / finish_reason="length" response is a FAILURE.
# Measured on 2026-08-17 with the real API: 2-item rollup probe consumed 161
# reasoning + 245 content tokens (~406 total). The request also sends
# `thinking: {type: disabled}` (harness `:off` semantics), but the cap stays
# above typical reasoning spend so a provider that ignores the param still
# completes within budget. 2000 is still a hard bound on per-call spend.
LLM_MAX_TOKENS = 2000
LLM_TIMEOUT_SECONDS = 30.0
LLM_RETRIES = 3
LLM_BACKOFF_SECONDS = (1.0, 2.0, 4.0)
LLM_BREAKER_THRESHOLD = 3

# Rollup input budget: 8K tokens at ~4 chars/token heuristic.
ROLLUP_MAX_INPUT_TOKENS = 8_000
ROLLUP_CHARS_PER_TOKEN = 4
ROLLUP_MAX_WORDS = 150
