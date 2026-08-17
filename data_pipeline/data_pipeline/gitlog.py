"""Git commit scan — mirror of loc-dock ``git.rs``.

Per top-level repo dir under ``~/repos`` with a ``.git`` entry:
- ``git log --numstat --date=iso-strict --format=%H|%ad|%s`` bounded to the
  retention window (``config.GIT_SINCE_DAYS``, mirroring loc-dock
  RETENTION_DAYS) — one `GitCommit` per commit with LOC summed across files,
  binary (``-``) files skipped (mirror ``parse_git_commits``);
- ``git log --source --branches --format=%H|%S`` — best-effort branch
  attribution; a commit's branch is the single distinct source ref, else
  ``None`` when ambiguous (assignment).

PR refs are extracted from commit messages with regex ``#(\\d+)``
(assignment; loc-dock uses ``(#\\d+)`` with a PR- prefix, ours are ints).
"""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .config import BRANCH_SCAN_LIMIT, GIT_SINCE_DAYS

PR_RE = re.compile(r"#(\d+)")

# Header line: `<sha>|<ts>|<subject>` — sha is ≥ 7 hex chars.
_HEADER_RE = re.compile(r"^([0-9a-fA-F]{7,40})\|(.+?)\|(.*)$")

_WINDOWS_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


@dataclass(frozen=True)
class Commit:
    repo: str
    sha: str
    ts: datetime  # aware
    msg: str
    added: int
    removed: int


def _run_git(repo_dir: Path, args: list[str], timeout: int = 300) -> str | None:
    cmd = ["git", *args]
    kwargs: dict = {"cwd": str(repo_dir), "capture_output": True, "text": True, "timeout": timeout}
    if _WINDOWS_CREATE_NO_WINDOW:
        kwargs["creationflags"] = _WINDOWS_CREATE_NO_WINDOW
    try:
        proc = subprocess.run(cmd, **kwargs)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


def parse_git_commits(stdout: str, repo: str) -> list[Commit]:
    """Parse `git log --numstat --format=%H|%ad|%s` output (mirror
    ``git.rs::parse_git_commits``)."""
    commits: list[Commit] = []
    sha: str | None = None
    ts: datetime | None = None
    msg: str | None = None
    added = 0
    removed = 0
    for raw_line in stdout.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        # Numstat line: `<added>\t<removed>\t<path>` — starts with a digit,
        # contains a tab; binary files report `-`.
        if line[0].isdigit() and "\t" in line:
            fields = line.split("\t")
            if len(fields) >= 2 and fields[0] != "-" and fields[1] != "-":
                try:
                    added += int(fields[0])
                    removed += int(fields[1])
                except ValueError:
                    pass
            continue
        match = _HEADER_RE.match(line)
        if match is None:
            continue
        # Finalize the previous commit.
        if sha is not None and ts is not None and msg is not None:
            commits.append(
                Commit(repo=repo, sha=sha, ts=ts, msg=msg, added=added, removed=removed)
            )
        sha = match.group(1)
        ts = _parse_ts(match.group(2))
        msg = match.group(3)
        added = 0
        removed = 0
    if sha is not None and ts is not None and msg is not None:
        commits.append(Commit(repo=repo, sha=sha, ts=ts, msg=msg, added=added, removed=removed))
    return commits


def _parse_ts(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def scan_repo_commits(repo_dir: Path, since_days: int = GIT_SINCE_DAYS) -> list[Commit]:
    """Full numstat scan for one repo (mirror ``scan_one_repo``)."""
    if not (repo_dir / ".git").exists():
        return []
    since_iso = _since_iso(since_days)
    stdout = _run_git(
        repo_dir,
        ["log", f"--since={since_iso}", "--numstat", "--date=iso-strict", "--format=%H|%ad|%s"],
    )
    if stdout is None:
        return []
    return parse_git_commits(stdout, repo_dir.name)


def scan_repo_branches(repo_dir: Path) -> dict[str, str]:
    """sha → best-effort branch for one repo via `git log --source`.

    A commit may be reachable via several refs (git prints it once per ref);
    when the distinct non-HEAD refs collapse to exactly one branch name that
    is the answer, otherwise the branch is ambiguous → omitted (None)."""
    if not (repo_dir / ".git").exists():
        return {}
    stdout = _run_git(
        repo_dir,
        [
            "log",
            "--source",
            "--branches",
            f"-n {BRANCH_SCAN_LIMIT}",
            "--format=%H|%S",
        ],
    )
    if stdout is None:
        return {}
    refs_by_sha: dict[str, set[str]] = {}
    for raw_line in stdout.splitlines():
        line = raw_line.strip()
        if not line or "|" not in line:
            continue
        sha, _, ref = line.partition("|")
        if len(sha) < 7 or not ref:
            continue
        refs_by_sha.setdefault(sha, set()).add(ref)
    branches: dict[str, str] = {}
    for sha, refs in refs_by_sha.items():
        candidates = {r for r in refs if r and r != "HEAD"}
        if len(candidates) == 1:
            branches[sha] = next(iter(candidates))
    return branches


def scan_all_repos(repos_root: Path, since_days: int = GIT_SINCE_DAYS) -> list[Commit]:
    """Scan every top-level repo dir under ``repos_root`` (mirror
    ``collect_new_commits``; no incremental registry — single-run recompute)."""
    if not repos_root.exists():
        return []
    commits: list[Commit] = []
    for entry in sorted(repos_root.iterdir()):
        if not entry.is_dir() or not (entry / ".git").exists():
            continue
        commits.extend(scan_repo_commits(entry, since_days))
    return commits


def extract_prs(message: str) -> list[int]:
    """All distinct `#NNN` refs in a commit message, in order of appearance."""
    seen: set[int] = set()
    prs: list[int] = []
    for match in PR_RE.finditer(message):
        pr = int(match.group(1))
        if pr not in seen:
            seen.add(pr)
            prs.append(pr)
    return prs


def _since_iso(days: int) -> str:
    from datetime import timedelta

    return (datetime.now().astimezone() - timedelta(days=days)).isoformat(timespec="seconds")
