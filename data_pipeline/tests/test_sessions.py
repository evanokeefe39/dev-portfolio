"""Session harvest tests: four harnesses, repo from cwd, omp summary mapping,
fallback construction, retention window, malformed-file and edge cases.

Fixture trees mirror the verified on-disk layouts:
- omp: ``omp/<repo-enc>/<ts>_<thread_id>.jsonl`` + sibling subdir
- memories: ``memories/<repo-enc>/rollout_summaries/<thread_id>-<slug>.md``
- claude: ``claude/<repo-enc>/<sessionId>.jsonl`` (subdirs ignored)
- pi: ``pi/<repo-enc>/<ts>_<thread_id>.jsonl``
- codex: ``codex/<yyyy>/<mm>/<dd>/rollout-*.jsonl``
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from data_pipeline.config import SourceRoots
from data_pipeline.gitlog import Commit
from data_pipeline.sessions import (
    build_fallback,
    harvest_counts,
    harvest_sessions,
)

TZ = ZoneInfo("Europe/Berlin")
NOW = datetime(2026, 8, 17, 20, 0, 0, tzinfo=timezone(timedelta(hours=2)))  # local 08-17 20:00


def _roots(tmp_path: Path) -> SourceRoots:
    return SourceRoots(
        claude=tmp_path / "claude",
        pi=tmp_path / "pi",
        codex=tmp_path / "codex",
        omp=tmp_path / "omp_sessions",
        repos=tmp_path / "repos",
    )


def _commit(day_offset: int, repo: str = "dev-portfolio", msg: str = "m",
            added: int = 10, removed: int = 4) -> Commit:
    ts = NOW + timedelta(days=-day_offset, hours=-5)
    return Commit(repo=repo, sha=f"{day_offset:040x}", ts=ts, msg=msg,
                  added=added, removed=removed)


def _write_omp_session(root: Path, enc: str, thread_id: str, *,
                       ts: str = "2026-08-17T10:00:00.000Z",
                       cwd: str = "C:\\Users\\evano\\repos\\dev-portfolio",
                       title: str = "Fix the pipeline",
                       subagent: bool = False) -> Path:
    """Write an OMP-style session jsonl; optionally a sibling subagent dir."""
    import json as _json

    enc_dir = root / enc
    enc_dir.mkdir(parents=True, exist_ok=True)
    file_ts = ts.replace(":", "-").replace(".", "-")
    path = enc_dir / f"{file_ts}_{thread_id}.jsonl"
    lines = [
        _json.dumps({"type": "title", "v": 1, "title": title, "source": "auto"}),
        _json.dumps({"type": "session", "version": 3, "id": thread_id,
                     "timestamp": ts, "cwd": cwd, "title": title}),
        _json.dumps({"type": "message", "id": "x",
                     "message": {"role": "user", "content": []}}),
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    if subagent:
        sub = enc_dir / f"{file_ts}_{thread_id}" / "subagent.jsonl"
        sub.parent.mkdir(parents=True, exist_ok=True)
        sub.write_text(
            _json.dumps({"type": "session", "version": 3, "id": "OTHER",
                         "timestamp": ts, "cwd": cwd}) + "\n",
            encoding="utf-8")
    return path

def _write_summary(memories_root: Path, enc: str, thread_id: str, slug: str,
                   body: str = "Did the thing. Then did the other thing. All good.") -> Path:
    path = memories_root / enc / "rollout_summaries" / f"{thread_id}-{slug}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"thread_id: {thread_id}\nupdated_at: 1786900000\n\n{body}\n",
                    encoding="utf-8")
    return path


def test_omp_harvests_session_with_summary_and_slug(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00001-0000-7000-0000-000000000001"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread,
                       title="Fix the pipeline")
    _write_summary(tmp_path / "memories", "--C--Users-evano-repos-dev-portfolio--",
                   thread, "pipeline_fix")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1
    s = sessions[0]
    assert s["harness"] == "omp"
    assert s["repo"] == "dev-portfolio"
    assert s["sessionId"] == thread
    assert s["day"] == "2026-08-17"
    assert s["startTs"] == "2026-08-17T10:00:00Z"
    assert s["summary"] == "Did the thing. Then did the other thing. All good."
    assert s["summarySlug"] == "pipeline_fix"
    assert s["fallback"] is None


def test_omp_no_summary_builds_fallback_with_commits(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00002-0000-7000-0000-000000000002"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread,
                       title="Separate data pipeline from Next.js app")
    # Three commits summing to +120/−40 (fallback aggregates the day's stats).
    commits = [
        _commit(0, repo="dev-portfolio", added=40, removed=14),
        _commit(0, repo="dev-portfolio", added=40, removed=13),
        _commit(0, repo="dev-portfolio", added=40, removed=13),
    ]
    sessions = harvest_sessions(roots, commits, tz=TZ, now=NOW)
    assert len(sessions) == 1
    assert sessions[0]["summary"] is None
    assert sessions[0]["summarySlug"] is None
    assert sessions[0]["fallback"] == "Separate data pipeline from Next.js app · 3 commits, +120/−40"


def test_omp_fallback_title_only_variant(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00003-0000-7000-0000-000000000003"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread, title="Just a title")
    # No commits for this repo/day.
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["fallback"] == "Just a title"


def test_omp_fallback_commit_stats_only_and_none(tmp_path):
    roots = _roots(tmp_path)
    # Pi-style session: no title anywhere → commit stats only.
    pi_dir = roots.pi / "--C--Users-evano-repos-dev-portfolio--"
    pi_dir.mkdir(parents=True, exist_ok=True)
    pi_dir.joinpath("2026-08-17T10-00-00-000Z_01a00009-0000-7000-0000-000000000009.jsonl").write_text(
        '{"type":"session","version":3,"id":"01a00009-0000-7000-0000-000000000009",'
        '"timestamp":"2026-08-17T10:00:00.000Z","cwd":"C:\\\\Users\\\\evano\\\\repos\\\\dev-portfolio"}\n',
        encoding="utf-8")
    commits = [_commit(0, repo="dev-portfolio", added=5, removed=2)]
    sessions = harvest_sessions(roots, commits, tz=TZ, now=NOW)
    assert sessions[0]["harness"] == "pi"
    assert sessions[0]["fallback"] == "1 commits, +5/−2"

    # Neither title nor commits → fallback None.
    thread = "01a00004-0000-7000-0000-000000000004"
    _write_omp_session(roots.omp, "-repos-other", thread, title=None, cwd="C:\\Users\\evano\\repos\\other")
    sessions2 = harvest_sessions(roots, [], tz=TZ, now=NOW)
    other = [s for s in sessions2 if s["repo"] == "other"][0]
    assert other["fallback"] is None


def test_pi_harvests_repo_from_cwd_and_skips_subdirs(tmp_path):
    roots = _roots(tmp_path)
    pi_dir = roots.pi / "--C--Users-evano-repos-loc-dock--"
    pi_dir.mkdir(parents=True, exist_ok=True)
    (pi_dir / "2026-08-16T12-00-00-000Z_01a00010-0000-7000-0000-000000000010.jsonl").write_text(
        '{"type":"session","version":3,"id":"01a00010-0000-7000-0000-000000000010",'
        '"timestamp":"2026-08-16T12:00:00.000Z","cwd":"C:\\\\Users\\\\evano\\\\repos\\\\loc-dock"}\n',
        encoding="utf-8")
    # subagent-artifacts / permission-forwarding must not produce sessions.
    (roots.pi / "subagent-artifacts" / "2026-08-16T12-00-00-000Z_01a00011-0000-7000-0000-000000000011.jsonl").parent.mkdir(parents=True, exist_ok=True)
    (roots.pi / "subagent-artifacts" / "2026-08-16T12-00-00-000Z_01a00011-0000-7000-0000-000000000011.jsonl").write_text(
        '{"type":"session","version":3,"id":"01a00011","timestamp":"2026-08-16T12:00:00.000Z","cwd":"x"}\n',
        encoding="utf-8")
    (roots.pi / "permission-forwarding" / "2026-08-16T12-00-00-000Z_01a00012-0000-7000-0000-000000000012.jsonl").parent.mkdir(parents=True, exist_ok=True)
    (roots.pi / "permission-forwarding" / "2026-08-16T12-00-00-000Z_01a00012-0000-7000-0000-000000000012.jsonl").write_text(
        '{"type":"session","version":3,"id":"01a00012","timestamp":"2026-08-16T12:00:00.000Z","cwd":"x"}\n',
        encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1
    assert sessions[0]["repo"] == "loc-dock"
    assert sessions[0]["harness"] == "pi"


def test_claude_repo_from_dir_encoding_and_title(tmp_path):
    roots = _roots(tmp_path)
    proj = roots.claude / "C--Users-evano-repos-loc-dock"
    proj.mkdir(parents=True, exist_ok=True)
    (proj / "abc-123.jsonl").write_text(
        '{"type":"mode","mode":"normal","sessionId":"abc-123"}\n'
        '{"type":"ai-title","aiTitle":"Debug the dock","sessionId":"abc-123"}\n'
        '{"type":"file-history-snapshot","snapshot":{"timestamp":"2026-08-10T08:00:00.000Z"}}\n',
        encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1
    s = sessions[0]
    assert s["harness"] == "claude"
    assert s["repo"] == "loc-dock"
    assert s["sessionId"] == "abc-123"
    assert s["day"] == "2026-08-10"
    assert s["summary"] is None
    # Title present → fallback is title-only (no commits).
    assert s["fallback"] == "Debug the dock"


def test_claude_counts_only_top_level_session_files(tmp_path):
    roots = _roots(tmp_path)
    proj = roots.claude / "C--Users-evano-repos-loc-dock"
    proj.mkdir(parents=True, exist_ok=True)
    (proj / "top-1.jsonl").write_text(
        '{"type":"mode","mode":"normal","sessionId":"top-1"}\n'
        '{"timestamp":"2026-08-10T08:00:00.000Z"}\n', encoding="utf-8")
    # Subagent thread under a session subdir must NOT count.
    sub = proj / "sub-1" / "rollout.jsonl"
    sub.parent.mkdir(parents=True, exist_ok=True)
    sub.write_text('{"type":"mode","mode":"normal","sessionId":"sub-1"}\n'
                   '{"timestamp":"2026-08-10T08:00:00.000Z"}\n', encoding="utf-8")
    # memory/ dir must not count.
    mem = proj / "memory" / "sess.jsonl"
    mem.parent.mkdir(parents=True, exist_ok=True)
    mem.write_text('{"type":"mode","mode":"normal","sessionId":"mem-1"}\n'
                   '{"timestamp":"2026-08-10T08:00:00.000Z"}\n', encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert [s["sessionId"] for s in sessions] == ["top-1"]


def test_claude_mtime_fallback_when_no_timestamp(tmp_path, caplog):
    roots = _roots(tmp_path)
    proj = roots.claude / "C--Users-evano-repos-loc-dock"
    proj.mkdir(parents=True, exist_ok=True)
    path = proj / "abc-456.jsonl"
    path.write_text('{"type":"mode","mode":"normal","sessionId":"abc-456"}\n', encoding="utf-8")
    import os
    os.utime(path, (1786000000, 1786000000))  # 2026-08-05-ish UTC
    import logging
    with caplog.at_level(logging.INFO):
        sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["sessionId"] == "abc-456"
    assert sessions[0]["startTs"] == "2026-08-06T07:06:40Z"
    assert any("using file mtime" in r.message for r in caplog.records)


def test_codex_harvests_meta_and_first_user_message(tmp_path):
    roots = _roots(tmp_path)
    codex_dir = roots.codex / "2026" / "09" / "20"
    codex_dir.mkdir(parents=True, exist_ok=True)
    (codex_dir / "rollout-2026-09-20T18-10-54-019967e4-8702-7e71-8d65-0ee1ce207ff4.jsonl").write_text(
        '{"timestamp":"2026-09-20T16:10:54.226Z","type":"session_meta",'
        '"payload":{"id":"019967e4-8702-7e71-8d65-0ee1ce207ff4","timestamp":"2026-09-20T16:10:54.082Z",'
        '"cwd":"c:\\\\Users\\\\evano\\\\repos\\\\dataplatform-mini"}}\n'
        '{"timestamp":"2026-09-20T16:10:54.226Z","type":"response_item",'
        '"payload":{"type":"message","role":"user","content":[{"type":"input_text",'
        '"text":"<environment_context>\\n  <cwd>c:\\\\Users\\\\evano\\\\repos\\\\dataplatform-mini</cwd>\\n</environment_context>"}]}}\n'
        '{"timestamp":"2026-09-20T16:10:54.226Z","type":"response_item",'
        '"payload":{"type":"message","role":"user","content":[{"type":"input_text",'
        '"text":"initialize a sql mesh project that uses duckdb python and docker"}]}}\n',
        encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1
    s = sessions[0]
    assert s["harness"] == "codex"
    assert s["repo"] == "dataplatform-mini"
    assert s["sessionId"] == "019967e4-8702-7e71-8d65-0ee1ce207ff4"
    assert s["day"] == "2026-09-20"
    assert s["fallback"] == "initialize a sql mesh project that uses duckdb python and docker"


def test_retention_window_filters_old_sessions(tmp_path):
    roots = _roots(tmp_path)
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a00005-0000-7000-0000-000000000005",
                       ts="2024-01-01T10:00:00.000Z")  # way outside 400d
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions == []


def test_malformed_jsonl_skipped_without_crash(tmp_path, caplog):
    roots = _roots(tmp_path)
    enc_dir = roots.omp / "-repos-dev-portfolio"
    enc_dir.mkdir(parents=True, exist_ok=True)
    path = enc_dir / "2026-08-17T10-00-00-000Z_01a00006-0000-7000-0000-000000000006.jsonl"
    path.write_text('{"type":"session","version":3,"id":"01a00006-0000-7000-0000-000000000006",'
                    '"timestamp":"2026-08-17T10:00:00.000Z","cwd":"C:\\\\Users\\\\evano\\\\repos\\\\dev-portfolio"}\n'
                    'NOT JSON AT ALL\n', encoding="utf-8")
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a00007-0000-7000-0000-000000000007",
                       ts="2026-08-16T10:00:00.000Z")
    import logging
    with caplog.at_level(logging.WARNING):
        sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 2
    assert any("malformed" in r.message for r in caplog.records)


def test_session_spanning_midnight_uses_local_start_day(tmp_path):
    roots = _roots(tmp_path)
    # 23:30 UTC on 08-16 → 01:30 local on 08-17 in Berlin (+2).
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a00008-0000-7000-0000-000000000008",
                       ts="2026-08-16T23:30:00.000Z")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["day"] == "2026-08-17"
    assert sessions[0]["startTs"] == "2026-08-16T23:30:00Z"


def test_harvest_counts_per_harness(tmp_path):
    roots = _roots(tmp_path)
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a0000a-0000-7000-0000-00000000000a")
    proj = roots.claude / "C--Users-evano-repos-loc-dock"
    proj.mkdir(parents=True, exist_ok=True)
    (proj / "c1.jsonl").write_text('{"type":"mode","mode":"normal","sessionId":"c1"}\n'
                                   '{"timestamp":"2026-08-10T08:00:00.000Z"}\n', encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert harvest_counts(sessions) == {"omp": 1, "claude": 1, "pi": 0, "codex": 0}


def test_build_fallback_variants():
    assert build_fallback("T", (3, 120, 40)) == "T · 3 commits, +120/−40"
    assert build_fallback("T", None) == "T"
    assert build_fallback(None, (3, 120, 40)) == "3 commits, +120/−40"
    assert build_fallback(None, None) is None


def test_omp_subagent_sibling_dir_not_counted(tmp_path):
    roots = _roots(tmp_path)
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a0000b-0000-7000-0000-00000000000b",
                       subagent=True)
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1  # subagent jsonl inside sibling dir ignored
