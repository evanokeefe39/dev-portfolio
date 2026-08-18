"""Session harvest tests: four harnesses, deterministic per-session stats.

Covers (pivot spec, 2026-08-18):
- title extraction per harness (omp title/session lines, claude ai-title /
  custom-title, codex first user message minus environment_context)
- assistantMessages counting for all four harnesses, including the codex
  regression (counting must be a loop-top-level sibling ``if _is_assistant``,
  never nested inside the title branch — that bug zeroed codex counts)
- locDelta / prRefs / branch mapping from fixture commits + a branches dict
  (_commit_stats signature is (commits, branches, tz))
- harvest window (since_days), omp summary mapping by thread_id,
  malformed-file skip, cwd-over-dir-encoding, local start day.

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
from data_pipeline.sessions import harvest_counts, harvest_sessions

TZ = ZoneInfo("Europe/Berlin")
NOW = datetime(2026, 8, 17, 20, 0, 0, tzinfo=timezone(timedelta(hours=2)))  # local 08-17 20:00

SESSION_KEYS = {
    "harness", "repo", "sessionId", "day", "startTs", "title", "summary",
    "summarySlug", "assistantMessages", "locDelta", "prRefs", "branch",
}


def _roots(tmp_path: Path) -> SourceRoots:
    return SourceRoots(
        claude=tmp_path / "claude",
        pi=tmp_path / "pi",
        codex=tmp_path / "codex",
        omp=tmp_path / "omp_sessions",
        repos=tmp_path / "repos",
    )


def _commit(day_offset: int, repo: str = "dev-portfolio", msg: str = "m",
            added: int = 10, removed: int = 4, sha: str | None = None) -> Commit:
    ts = NOW + timedelta(days=-day_offset, hours=-5)
    return Commit(repo=repo, sha=sha or f"{day_offset:040x}", ts=ts, msg=msg,
                  added=added, removed=removed)


def _write_omp_session(root: Path, enc: str, thread_id: str, *,
                       ts: str = "2026-08-17T10:00:00.000Z",
                       cwd: str | None = "C:\\Users\\evano\\repos\\dev-portfolio",
                       title: str | None = "Fix the pipeline",
                       session_title: str | None = None,
                       extra_lines: list[dict] | None = None,
                       subagent: bool = False) -> Path:
    """Write an OMP/Pi-style session jsonl; optionally a sibling subdir."""
    import json as _json

    enc_dir = root / enc
    enc_dir.mkdir(parents=True, exist_ok=True)
    file_ts = ts.replace(":", "-").replace(".", "-")
    path = enc_dir / f"{file_ts}_{thread_id}.jsonl"
    lines: list[dict] = []
    if title is not None:
        lines.append({"type": "title", "v": 1, "title": title, "source": "auto"})
    lines.append({"type": "session", "version": 3, "id": thread_id,
                  "timestamp": ts, "cwd": cwd,
                  "title": session_title if session_title is not None else title})
    lines.append({"type": "message", "id": "x",
                  "message": {"role": "user", "content": []}})
    if extra_lines:
        lines.extend(extra_lines)
    path.write_text("\n".join(_json.dumps(line) for line in lines) + "\n", encoding="utf-8")
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
    assert set(s.keys()) == SESSION_KEYS  # locked session schema
    assert s["harness"] == "omp"
    assert s["repo"] == "dev-portfolio"
    assert s["sessionId"] == thread
    assert s["day"] == "2026-08-17"
    assert s["startTs"] == "2026-08-17T10:00:00Z"
    assert s["title"] == "Fix the pipeline"
    assert s["summary"] == "Did the thing. Then did the other thing. All good."
    assert s["summarySlug"] == "pipeline_fix"
    assert s["assistantMessages"] == 0
    assert s["locDelta"] is None
    assert s["prRefs"] == []
    assert s["branch"] is None


def test_omp_summary_only_maps_matching_thread_id(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00002-0000-7000-0000-000000000002"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread)
    # Summary for a DIFFERENT thread must not attach to this session.
    _write_summary(tmp_path / "memories", "--C--Users-evano-repos-dev-portfolio--",
                   "01a0ffff-0000-7000-0000-00000000ffff", "other_slug")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["summary"] is None
    assert sessions[0]["summarySlug"] is None


def test_omp_title_prefers_title_line_over_session_line(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00003-0000-7000-0000-000000000003"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread,
                       title="Auto title", session_title="Initial title")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["title"] == "Auto title"


def test_omp_title_from_session_line_when_no_title_line(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00004-0000-7000-0000-000000000004"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread,
                       title=None, session_title="Session line title")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["title"] == "Session line title"


def test_omp_title_none_when_no_title_anywhere(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00005-0000-7000-0000-000000000005"
    _write_omp_session(roots.omp, "-repos-other", thread, title=None,
                       cwd="C:\\Users\\evano\\repos\\other")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["title"] is None


def test_assistant_counts_for_omp_and_pi(tmp_path):
    roots = _roots(tmp_path)
    extra = [
        {"type": "message", "id": "a1", "message": {"role": "assistant", "content": []}},
        {"type": "message", "id": "a2", "message": {"role": "assistant", "content": []}},
        # Old OMP layout: top-level role, no nested message dict.
        {"type": "message", "id": "a3", "role": "assistant", "content": []},
        {"type": "message", "id": "u1", "message": {"role": "user", "content": []}},
    ]
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a00006-0000-7000-0000-000000000006", extra_lines=extra)
    _write_omp_session(roots.pi, "--C--Users-evano-repos-loc-dock--",
                       "01a00007-0000-7000-0000-000000000007",
                       cwd="C:\\Users\\evano\\repos\\loc-dock", extra_lines=extra[:1])
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    by_id = {s["sessionId"]: s for s in sessions}
    assert by_id["01a00006-0000-7000-0000-000000000006"]["assistantMessages"] == 3
    assert by_id["01a00007-0000-7000-0000-000000000007"]["assistantMessages"] == 1


def test_claude_counts_assistant_messages(tmp_path):
    roots = _roots(tmp_path)
    proj = roots.claude / "C--Users-evano-repos-loc-dock"
    proj.mkdir(parents=True, exist_ok=True)
    (proj / "abc-123.jsonl").write_text(
        '{"type":"mode","mode":"normal","sessionId":"abc-123"}\n'
        '{"timestamp":"2026-08-10T08:00:00.000Z"}\n'
        '{"type":"assistant","message":{"id":"msg_1"},"sessionId":"abc-123"}\n'
        '{"type":"user","message":{"id":"usr_1"},"sessionId":"abc-123"}\n'
        '{"type":"assistant","message":{"id":"msg_2"},"sessionId":"abc-123"}\n',
        encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1
    assert sessions[0]["assistantMessages"] == 2


def test_codex_counts_assistant_messages_after_title_set(tmp_path):
    """Regression: the assistant count must be a loop-top-level sibling of the
    title branch — a count nested inside the title branch is zeroed once the
    title is set (the bug that zeroed codex counts)."""
    roots = _roots(tmp_path)
    codex_dir = roots.codex / "2026" / "09" / "20"
    codex_dir.mkdir(parents=True, exist_ok=True)
    sid = "019967e4-8702-7e71-8d65-0ee1ce207ff4"
    (codex_dir / f"rollout-2026-09-20T18-10-54-{sid}.jsonl").write_text(
        '{"timestamp":"2026-09-20T16:10:54.226Z","type":"session_meta",'
        '"payload":{"id":"' + sid + '","timestamp":"2026-09-20T16:10:54.082Z",'
        '"cwd":"c:\\\\Users\\\\evano\\\\repos\\\\dataplatform-mini"}}\n'
        '{"timestamp":"2026-09-20T16:10:54.300Z","type":"response_item",'
        '"payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"build the thing"}]}}\n'
        '{"timestamp":"2026-09-20T16:10:55.000Z","type":"response_item",'
        '"payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"ok"}]}}\n'
        '{"timestamp":"2026-09-20T16:10:56.000Z","type":"response_item",'
        '"payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"done"}]}}\n',
        encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1
    s = sessions[0]
    assert s["title"] == "build the thing"
    assert s["assistantMessages"] == 2  # would be 0 under the nested-branch bug


def test_loc_delta_prs_branch_mapped_from_commits(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00008-0000-7000-0000-000000000008"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread, title="Add pipeline")
    commits = [
        _commit(0, msg="feat: add pipeline (#15)", added=40, removed=14, sha="a" * 40),
        _commit(0, msg="fix: bug in ingest (#16)", added=30, removed=10, sha="b" * 40),
        _commit(0, msg="chore: no ref", added=5, removed=2, sha="c" * 40),
    ]
    branches = {"dev-portfolio": {"a" * 40: "main", "b" * 40: "main", "c" * 40: "feature"}}
    sessions = harvest_sessions(roots, commits, branches=branches, tz=TZ, now=NOW)
    assert len(sessions) == 1
    s = sessions[0]
    assert s["locDelta"] == {"added": 75, "removed": 26, "net": 49}
    assert s["prRefs"] == [15, 16]
    assert s["branch"] == "main"  # most frequent attributed branch


def test_loc_delta_null_without_commits_that_day(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a00009-0000-7000-0000-000000000009"
    _write_omp_session(roots.omp, "-repos-other", thread,
                       cwd="C:\\Users\\evano\\repos\\other")
    commits = [_commit(0)]  # dev-portfolio only — no commits for "other"
    sessions = harvest_sessions(roots, commits, branches={}, tz=TZ, now=NOW)
    s = sessions[0]
    assert s["locDelta"] is None
    assert s["prRefs"] == []
    assert s["branch"] is None


def test_branch_none_when_no_branch_attribution(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a0000a-0000-7000-0000-00000000000a"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread)
    commits = [_commit(0, msg="feat: wire it (#42)", added=10, removed=2)]
    sessions = harvest_sessions(roots, commits, branches={}, tz=TZ, now=NOW)
    s = sessions[0]
    assert s["locDelta"] == {"added": 10, "removed": 2, "net": 8}
    assert s["prRefs"] == [42]
    assert s["branch"] is None


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
    assert s["repo"] == "loc-dock"  # dir-encoding fallback (no cwd field)
    assert s["sessionId"] == "abc-123"
    assert s["day"] == "2026-08-10"
    assert s["summary"] is None
    assert s["title"] == "Debug the dock"


def test_claude_title_ai_and_custom(tmp_path):
    roots = _roots(tmp_path)
    proj = roots.claude / "C--Users-evano-repos-loc-dock"
    proj.mkdir(parents=True, exist_ok=True)
    (proj / "abc-1.jsonl").write_text(
        '{"type":"mode","mode":"normal","sessionId":"abc-1"}\n'
        '{"type":"ai-title","aiTitle":"Debug the dock","sessionId":"abc-1"}\n'
        '{"type":"file-history-snapshot","snapshot":{"timestamp":"2026-08-10T08:00:00.000Z"}}\n',
        encoding="utf-8")
    (proj / "abc-2.jsonl").write_text(
        '{"type":"mode","mode":"normal","sessionId":"abc-2"}\n'
        '{"type":"custom-title","customTitle":"Rename me","sessionId":"abc-2"}\n'
        '{"type":"file-history-snapshot","snapshot":{"timestamp":"2026-08-10T08:00:00.000Z"}}\n',
        encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    by_id = {s["sessionId"]: s for s in sessions}
    assert by_id["abc-1"]["title"] == "Debug the dock"
    assert by_id["abc-2"]["title"] == "Rename me"


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
    # env-context-only first message is skipped; second user message is the title.
    assert s["title"] == "initialize a sql mesh project that uses duckdb python and docker"
    assert s["assistantMessages"] == 0


def test_codex_title_strips_environment_context_inline(tmp_path):
    roots = _roots(tmp_path)
    codex_dir = roots.codex / "2026" / "09" / "21"
    codex_dir.mkdir(parents=True, exist_ok=True)
    sid = "019967e4-8702-7e71-8d65-0ee1ce207ff5"
    (codex_dir / f"rollout-2026-09-21T18-10-54-{sid}.jsonl").write_text(
        '{"timestamp":"2026-09-21T16:10:54.226Z","type":"session_meta",'
        '"payload":{"id":"' + sid + '","timestamp":"2026-09-21T16:10:54.082Z",'
        '"cwd":"c:\\\\Users\\\\evano\\\\repos\\\\dataplatform-mini"}}\n'
        '{"timestamp":"2026-09-21T16:10:54.300Z","type":"response_item",'
        '"payload":{"type":"message","role":"user","content":[{"type":"input_text",'
        '"text":"<environment_context>\\n  <cwd>c:\\\\Users\\\\evano\\\\repos\\\\dataplatform-mini</cwd>\\n</environment_context>initialize a sql mesh project that uses duckdb python and docker"}]}}\n',
        encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1
    assert sessions[0]["title"] == "initialize a sql mesh project that uses duckdb python and docker"


def test_cwd_over_dir_encoding(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a0000b-0000-7000-0000-00000000000b"
    # File sits under the dev-portfolio dir but cwd says other-repo → cwd wins.
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread,
                       cwd="C:\\Users\\evano\\repos\\other-repo")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["repo"] == "other-repo"


def test_dir_encoding_fallback_when_no_cwd(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a0000c-0000-7000-0000-00000000000c"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread, cwd=None)
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["repo"] == "dev-portfolio"


def test_retention_window_filters_old_sessions(tmp_path):
    roots = _roots(tmp_path)
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a0000d-0000-7000-0000-00000000000d",
                       ts="2024-01-01T10:00:00.000Z")  # way outside 400d
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions == []


def test_since_days_window(tmp_path):
    roots = _roots(tmp_path)
    thread = "01a0000e-0000-7000-0000-00000000000e"
    _write_omp_session(roots.omp, "-repos-dev-portfolio", thread,
                       ts="2026-08-15T10:00:00.000Z")  # ~2.3 days before NOW
    assert harvest_sessions(roots, [], tz=TZ, now=NOW, since_days=1) == []
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW, since_days=3)
    assert [s["sessionId"] for s in sessions] == [thread]


def test_malformed_jsonl_skipped_without_crash(tmp_path, caplog):
    roots = _roots(tmp_path)
    enc_dir = roots.omp / "-repos-dev-portfolio"
    enc_dir.mkdir(parents=True, exist_ok=True)
    path = enc_dir / "2026-08-17T10-00-00-000Z_01a0000f-0000-7000-0000-00000000000f.jsonl"
    path.write_text('{"type":"session","version":3,"id":"01a0000f-0000-7000-0000-00000000000f",'
                    '"timestamp":"2026-08-17T10:00:00.000Z","cwd":"C:\\\\Users\\\\evano\\\\repos\\\\dev-portfolio"}\n'
                    'NOT JSON AT ALL\n', encoding="utf-8")
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a00010-0000-7000-0000-000000000010",
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
                       "01a00011-0000-7000-0000-000000000011",
                       ts="2026-08-16T23:30:00.000Z")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert sessions[0]["day"] == "2026-08-17"
    assert sessions[0]["startTs"] == "2026-08-16T23:30:00Z"


def test_harvest_counts_per_harness(tmp_path):
    roots = _roots(tmp_path)
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a00012-0000-7000-0000-000000000012")
    proj = roots.claude / "C--Users-evano-repos-loc-dock"
    proj.mkdir(parents=True, exist_ok=True)
    (proj / "c1.jsonl").write_text('{"type":"mode","mode":"normal","sessionId":"c1"}\n'
                                   '{"timestamp":"2026-08-10T08:00:00.000Z"}\n', encoding="utf-8")
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert harvest_counts(sessions) == {"omp": 1, "claude": 1, "pi": 0, "codex": 0}


def test_omp_subagent_sibling_dir_not_counted(tmp_path):
    roots = _roots(tmp_path)
    _write_omp_session(roots.omp, "-repos-dev-portfolio",
                       "01a00013-0000-7000-0000-000000000013",
                       subagent=True)
    sessions = harvest_sessions(roots, [], tz=TZ, now=NOW)
    assert len(sessions) == 1  # subagent jsonl inside sibling dir ignored
