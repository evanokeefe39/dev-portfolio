"""Harvest one session entry per AI session across the four harness dirs.

Data reality (verified 2026-08-17):
- OMP      ``~/.omp/agent/sessions/<repo-enc>/<ts>_<thread_id>.jsonl`` — a
           ``type:"session"`` line carries ``id``/``timestamp``/``cwd``/``title``;
           sibling dirs ``<ts>_<thread_id>/`` hold subagent/advisor logs and are
           NOT sessions. Summaries: ``~/.omp/agent/memories/<repo-enc>/
           rollout_summaries/<thread_id>-<slug>.md`` (frontmatter
           ``thread_id:``/``updated_at:`` then blank line, then the 2-4 sentence
           body — no ``---`` fence in practice).
- Claude   ``~/.claude/projects/<repo-enc>/*.jsonl`` — count ONLY top-level
           ``<sessionId>.jsonl`` files (subdirs are subagent threads); ids from
           ``mode``/``ai-title``/``custom-title`` lines, title from
           ``aiTitle``/``customTitle``, timestamp from the earliest line
           timestamp (mtime fallback, logged).
- Pi       ``~/.pi/agent/sessions/<repo-enc>/<ts>_<thread_id>.jsonl`` — same
           ``type:"session"`` line as OMP (id/timestamp/cwd).
- Codex    ``~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-<ts>-<uuid>.jsonl`` —
           ``session_meta`` payload (id/timestamp/cwd); title = first user
           message with the ``<environment_context>`` block stripped.

Repo comes from the session ``cwd`` (authoritative); the dir-name encoding is
used only as a fallback (``-repos-<name>`` for omp,
``C--Users-evano-repos-<name>`` for claude/pi).
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .config import GIT_SINCE_DAYS, SKIP_SUBDIRS, SourceRoots
from .gitlog import Commit

logger = logging.getLogger(__name__)

ENV_CONTEXT_RE = re.compile(
    r"<\s*environment_context\b[^>]*>.*?<\s*/\s*environment_context\s*>",
    re.DOTALL,
)

HARNESSES = ("omp", "claude", "pi", "codex")


def _parse_iso(value: str) -> datetime | None:
    """Parse an ISO-8601 timestamp; normalize to aware UTC."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _repo_from_cwd(cwd: str | None) -> str | None:
    """Repo name = basename of the session cwd (authoritative)."""
    if not cwd:
        return None
    normalized = cwd.replace("\\", "/").rstrip("/")
    name = normalized.rsplit("/", 1)[-1]
    return name or None


def _decode_repo_dir(name: str, harness: str) -> str | None:
    """Decode the harness directory encoding into a repo name (fallback)."""
    if harness == "omp":
        prefix = "-repos-"
        if name.startswith(prefix):
            return name[len(prefix):] or None
        return None
    # claude / pi: C--Users-evano-repos-<name>; pi wraps the path in '--'.
    stripped = name.strip("-") if harness == "pi" else name
    prefix = "C--Users-evano-repos-"
    if stripped.startswith(prefix):
        return stripped[len(prefix):] or None
    return None


def _iter_jsonl(path: Path):
    """Yield parsed JSON objects; malformed lines are logged and skipped."""
    try:
        with path.open("r", encoding="utf-8") as fh:
            for lineno, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    logger.warning("skip malformed JSONL line %s:%d", path, lineno)
    except OSError as err:
        logger.warning("skip unreadable session file %s: %s", path, err)


def _split_summary_md(text: str) -> tuple[dict[str, str], str]:
    """Split ``key: value`` frontmatter from the body (blank line or ``---``)."""
    lines = text.splitlines()
    front: dict[str, str] = {}
    idx = 0
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped == "---":
            break
        if ":" not in stripped:
            break
        key, _, value = stripped.partition(":")
        front[key.strip()] = value.strip()
    body = "\n".join(lines[idx + 1:])
    return front, body


def _load_omp_summaries(memories_root: Path) -> dict[str, tuple[str, str]]:
    """thread_id -> (body, slug) from every rollout_summaries/*.md file."""
    summaries: dict[str, tuple[str, str]] = {}
    if not memories_root.exists():
        return summaries
    for path in memories_root.glob("*/rollout_summaries/*.md"):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as err:
            logger.warning("skip unreadable summary %s: %s", path, err)
            continue
        front, body = _split_summary_md(text)
        thread_id = (front.get("thread_id") or "").strip()
        slug = path.stem
        if thread_id and slug.startswith(thread_id):
            slug = slug[len(thread_id):].lstrip("-")
        if thread_id and body.strip():
            summaries[thread_id] = (body.strip(), slug)
    return summaries


def _commit_stats(commits: list[Commit], tz) -> dict[tuple[str, str], tuple[int, int, int]]:
    """(repo, local-day) -> (count, added, removed) across the commit list."""
    stats: dict[tuple[str, str], tuple[int, int, int]] = {}
    for commit in commits:
        day = commit.ts.astimezone(tz).date().isoformat()
        key = (commit.repo, day)
        count, added, removed = stats.get(key, (0, 0, 0))
        stats[key] = (count + 1, added + commit.added, removed + commit.removed)
    return stats


def build_fallback(title: str | None, stats: tuple[int, int, int] | None) -> str | None:
    """Zero-LLM tooltip text: title · commit stats (or variants), else None."""
    if title and stats:
        count, added, removed = stats
        return f"{title} · {count} commits, +{added}/−{removed}"
    if title:
        return title
    if stats:
        count, added, removed = stats
        return f"{count} commits, +{added}/−{removed}"
    return None


# ── Per-harness parsing ──────────────────────────────────────────────────────

def _parse_omp_pi(path: Path, harness: str, enc_name: str) -> dict | None:
    """Parse an OMP/Pi session file; returns raw session fields or None."""
    raw = {"harness": harness, "sessionId": None, "startTs": None, "cwd": None, "title": None}
    for obj in _iter_jsonl(path):
        if not isinstance(obj, dict):
            continue
        if obj.get("type") == "session":
            raw["sessionId"] = obj.get("id")
            raw["startTs"] = _parse_iso(obj.get("timestamp") or "")
            raw["cwd"] = obj.get("cwd")
            # The type:"title" line carries the CURRENT auto title; the session
            # line's title is the initial one — prefer the title line.
            raw["title"] = raw["title"] or obj.get("title")
        elif obj.get("type") == "title" and obj.get("title"):
            raw["title"] = obj["title"]
    if not raw["sessionId"] or raw["startTs"] is None:
        logger.warning("skip %s session file without session line: %s", harness, path)
        return None
    raw["repo"] = _repo_from_cwd(raw["cwd"]) or _decode_repo_dir(enc_name, harness)
    return raw


def _parse_claude(path: Path, enc_name: str) -> dict | None:
    """Parse a Claude top-level session file; ids/titles from meta lines."""
    raw = {
        "harness": "claude",
        "sessionId": None,
        "startTs": None,
        "cwd": None,
        "title": None,
    }
    timestamps: list[datetime] = []
    for obj in _iter_jsonl(path):
        if not isinstance(obj, dict):
            continue
        otype = obj.get("type")
        if otype == "mode" and obj.get("sessionId"):
            raw["sessionId"] = obj["sessionId"]
        elif otype in ("ai-title", "custom-title") and obj.get("sessionId"):
            raw["sessionId"] = obj["sessionId"]
            raw["title"] = raw["title"] or obj.get("aiTitle") or obj.get("customTitle")
        if obj.get("cwd"):
            raw["cwd"] = obj["cwd"]
        for ts in (obj.get("timestamp"), (obj.get("snapshot") or {}).get("timestamp")):
            parsed = _parse_iso(ts or "")
            if parsed:
                timestamps.append(parsed)
    if not raw["sessionId"]:
        raw["sessionId"] = path.stem
    if timestamps:
        raw["startTs"] = min(timestamps)
    else:
        try:
            mtime = path.stat().st_mtime
        except OSError:
            return None
        raw["startTs"] = datetime.fromtimestamp(mtime, tz=timezone.utc)
        logger.info("claude session %s has no timestamp; using file mtime", path.stem)
    raw["repo"] = _repo_from_cwd(raw["cwd"]) or _decode_repo_dir(enc_name, "claude")
    return raw


def _parse_codex(path: Path) -> dict | None:
    """Parse a Codex rollout file; title = first user message minus env context."""
    raw = {"harness": "codex", "sessionId": None, "startTs": None, "cwd": None, "title": None}
    for obj in _iter_jsonl(path):
        if not isinstance(obj, dict):
            continue
        otype = obj.get("type")
        if otype == "session_meta":
            payload = obj.get("payload") or {}
            raw["sessionId"] = payload.get("id")
            raw["startTs"] = _parse_iso(payload.get("timestamp") or obj.get("timestamp") or "")
            raw["cwd"] = payload.get("cwd")
        elif otype == "response_item" and raw["title"] is None:
            payload = obj.get("payload") or {}
            if payload.get("type") == "message" and payload.get("role") == "user":
                text = " ".join(
                    (item.get("text") or "")
                    for item in (payload.get("content") or [])
                    if isinstance(item, dict)
                )
                cleaned = ENV_CONTEXT_RE.sub("", text).strip()
                if cleaned:
                    raw["title"] = cleaned
    if not raw["sessionId"] or raw["startTs"] is None:
        logger.warning("skip codex session file without session_meta: %s", path)
        return None
    raw["repo"] = _repo_from_cwd(raw["cwd"])
    return raw


# ── Discovery ────────────────────────────────────────────────────────────────

def _session_files(root: Path, harness: str) -> list[tuple[Path, str]]:
    """(path, repo-enc-dir-name) pairs for the harness; [] when root missing."""
    if not root.exists():
        return []
    files: list[tuple[Path, str]] = []
    for enc_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        if enc_dir.name in SKIP_SUBDIRS.get(harness, ()):
            continue
        if harness == "codex":
            # codex nests under yyyy/mm/dd — discover recursively.
            for path in sorted(enc_dir.rglob("*.jsonl")):
                if path.is_file():
                    files.append((path, enc_dir.name))
        else:
            for path in sorted(enc_dir.glob("*.jsonl")):
                if path.is_file():
                    files.append((path, enc_dir.name))
    return files


def _raw_sessions(roots: SourceRoots) -> list[dict]:
    """All raw sessions across the four harnesses (pre-window, pre-summary)."""
    raw: list[dict] = []
    for path, enc_name in _session_files(roots.omp, "omp"):
        session = _parse_omp_pi(path, "omp", enc_name)
        if session:
            raw.append(session)
    for path, enc_name in _session_files(roots.claude, "claude"):
        session = _parse_claude(path, enc_name)
        if session:
            raw.append(session)
    for path, enc_name in _session_files(roots.pi, "pi"):
        session = _parse_omp_pi(path, "pi", enc_name)
        if session:
            raw.append(session)
    for path, enc_name in _session_files(roots.codex, "codex"):
        session = _parse_codex(path)
        if session:
            raw.append(session)
    return raw


# ── Public API ───────────────────────────────────────────────────────────────

def harvest_sessions(
    roots: SourceRoots,
    commits: list[Commit],
    *,
    tz=None,
    now: datetime | None = None,
    since_days: int = GIT_SINCE_DAYS,
) -> list[dict]:
    """One entry per session (within ``since_days`` of ``now``), newest first.

    Each entry: ``harness``, ``repo``, ``sessionId``, ``day`` (local start
    date), ``startTs`` (UTC ISO, seconds), ``summary``/``summarySlug``
    (OMP only, else None) and ``fallback`` (built when no summary).
    """
    if now is None:
        now = datetime.now().astimezone()
    tz = tz or now.tzinfo
    cutoff = now - timedelta(days=since_days)

    omp_summaries = _load_omp_summaries(roots.omp.parent / "memories")
    stats = _commit_stats(commits, tz)

    sessions: list[dict] = []
    for raw in _raw_sessions(roots):
        if raw["startTs"] < cutoff:
            continue
        if not raw["repo"]:
            logger.warning("skip %s session %s without a repo", raw["harness"], raw["sessionId"])
            continue
        summary = None
        summary_slug = None
        if raw["harness"] == "omp":
            matched = omp_summaries.get(raw["sessionId"])
            if matched:
                summary, summary_slug = matched
        fallback = None if summary else build_fallback(
            raw["title"], stats.get((raw["repo"], raw["startTs"].astimezone(tz).date().isoformat()))
        )
        sessions.append({
            "harness": raw["harness"],
            "repo": raw["repo"],
            "sessionId": raw["sessionId"],
            "day": raw["startTs"].astimezone(tz).date().isoformat(),
            "startTs": raw["startTs"].astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "summary": summary,
            "summarySlug": summary_slug,
            "fallback": fallback,
        })
    sessions.sort(key=lambda s: s["startTs"], reverse=True)
    return sessions


def harvest_counts(sessions: list[dict]) -> dict[str, int]:
    """Per-harness counts for cli output."""
    counts = {h: 0 for h in HARNESSES}
    for session in sessions:
        counts[session["harness"]] += 1
    return counts
