"""`uv run snapshot` — the pipeline entry point."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from . import __version__
from .config import DEFAULT_LLM_BASE_URL, DEFAULT_LLM_MODEL, default_roots
from .gitlog import scan_all_repos, scan_repo_branches
from .llm import LlmClient, load_env_file
from .pricing import Pricing
from .rollup import compute_rollups
from .sessions import harvest_counts, harvest_sessions
from .snapshot import build_snapshot, write_outputs
from .sources import extract_entries, finalize_costs, ingest_all, ingest_source, open_entries_connection
# data_pipeline/ is at <repo>/data_pipeline; public/ lives next to it.
_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PUBLIC_DATA = _REPO_ROOT / "public" / "data"
ROLLUP_CACHE_PATH = _REPO_ROOT / "data_pipeline" / "rollup_cache.json"

SCHEMA_COLUMNS = (
    "source",
    "session_id",
    "ts",
    "model",
    "message_id",
    "input_tokens",
    "output_tokens",
    "cache_write_tokens",
    "cache_read_tokens",
    "input_cost",
    "output_cost",
    "cache_write_cost",
    "cache_read_cost",
    "total_cost",
)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="snapshot",
        description=(
            "Build the dev-portfolio data snapshot: ingest Claude/Pi/Codex/OMP "
            "session JSONL + git history, compute 5-range metrics, write "
            "public/data/current.json."
        ),
    )
    parser.add_argument(
        "--public-dir",
        type=Path,
        default=DEFAULT_PUBLIC_DATA,
        help="output directory (default: <repo>/public/data)",
    )
    parser.add_argument(
        "--pricing",
        type=Path,
        default=None,
        help="override LiteLLM pricing JSON path",
    )
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="print schema + 3 sample rows from one real JSONL file, then exit",
    )
    parser.add_argument(
        "--smoke-file",
        type=Path,
        default=None,
        help="JSONL file to use for --smoke (default: first discovered session file)",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser.parse_args(argv)


def _sample_rows(entries: list[dict], limit: int = 3) -> list[dict]:
    """First rows as JSON-safe sample dicts (ts as ISO string)."""
    rows = []
    for e in entries[:limit]:
        row = {k: e[k] for k in SCHEMA_COLUMNS}
        row["ts"] = e["ts"].isoformat()
        rows.append(row)
    return rows


def _smoke(args: argparse.Namespace, pricing: Pricing) -> int:
    from .config import SKIP_SUBDIRS
    from .sources import discover_files

    roots = default_roots()
    sources = [
        ("claude", roots.claude, SKIP_SUBDIRS["claude"]),
        ("pi", roots.pi, SKIP_SUBDIRS["pi"]),
        ("codex", roots.codex, SKIP_SUBDIRS["codex"]),
        ("omp", roots.omp, SKIP_SUBDIRS["omp"]),
    ]
    path = args.smoke_file
    source = None
    if path is None:
        for src, root, skip in sources:
            files = discover_files(root, skip)
            if files:
                path = files[0]
                source = src
                break
    else:
        # Infer the source template from the file's location under a source root.
        resolved = path.resolve()
        for src, root, _skip in sources:
            if resolved.is_relative_to(root.resolve()):
                source = src
                break
    if source is None:
        print("ERROR: --smoke-file is not under any source root (~/.claude, ~/.pi, ~/.codex, ~/.omp)", file=sys.stderr)
        return 1
    if path is None:
        print("ERROR: no JSONL files found under ~/.claude, ~/.pi, ~/.codex, ~/.omp", file=sys.stderr)
        return 1
    con = open_entries_connection()
    ingest_source(con, path.parent, source, (), files=[path])
    entries = extract_entries(con)
    finalize_costs(entries, pricing)
    entries.sort(key=lambda e: e["ts"], reverse=True)

    print(f"SMOKE source: {source}")
    print(f"SMOKE file:   {path}")
    print(f"SMOKE pricing: {pricing.source_path or 'unavailable'}")
    print("SCHEMA: " + ", ".join(SCHEMA_COLUMNS))
    print("SAMPLE ROWS:")
    for row in _sample_rows(entries):
        print("  " + json.dumps(row, default=str))
    print(f"({len(entries)} rows extracted)")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    pricing = Pricing(args.pricing) if args.pricing is not None else Pricing.discover()
    if args.smoke:
        return _smoke(args, pricing)
    roots = default_roots()
    con = open_entries_connection()
    inserted = ingest_all(con, roots)
    entries = extract_entries(con)
    finalize_costs(entries, pricing)

    commits = scan_all_repos(roots.repos)
    # Branch attribution: repo → sha → branch, best-effort.
    branches: dict[str, dict[str, str]] = {}
    if roots.repos.exists():
        for repo_dir in sorted(roots.repos.iterdir()):
            if repo_dir.is_dir() and (repo_dir / ".git").exists():
                branches[repo_dir.name] = scan_repo_branches(repo_dir)

    local_now = datetime.now().astimezone()
    env = load_env_file(_REPO_ROOT / ".env")
    api_key = env.get("LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY", "")
    base_url = env.get("LLM_BASE_URL") or os.environ.get("LLM_BASE_URL") or DEFAULT_LLM_BASE_URL
    model = env.get("LLM_MODEL") or os.environ.get("LLM_MODEL") or DEFAULT_LLM_MODEL
    client = LlmClient(base_url=base_url, api_key=api_key, model=model) if api_key else None

    sessions = harvest_sessions(roots, commits, now=local_now)
    rollups, rollup_errors = compute_rollups(
        sessions,
        window_end=local_now.date(),
        cache_path=ROLLUP_CACHE_PATH,
        client=client,
        now=local_now,
    )

    snapshot = build_snapshot(
        entries,
        commits,
        pricing_available=pricing.available,
        branches=branches,
        now=local_now,
        sessions=sessions,
        rollups=rollups,
        rollup_errors=rollup_errors,
    )
    current_path, archive_path = write_outputs(snapshot, args.public_dir)

    print(f"entries ingested: {inserted} (rows: {len(entries)})")
    print(f"commits scanned:  {len(commits)} across {len(branches)} repos")
    session_counts = harvest_counts(sessions)
    print(
        "sessions harvested: "
        + " ".join(f"{h}={session_counts[h]}" for h in ("omp", "claude", "pi", "codex"))
        + f" (total {len(sessions)})"
    )
    rollup_total = sum(len(v) for v in rollups.values())
    error_total = sum(len(v) for v in rollup_errors.values())
    print(f"rollups computed:  {rollup_total} keys across {len(rollups)} grains (errors: {error_total})")
    if error_total:
        for grain, errs in rollup_errors.items():
            for rh, message in errs.items():
                print(f"  rollup error [{grain} {rh}]: {message}")
    for name, stats in snapshot["ranges"].items():
        burn = stats["tokenBurn"]
        print(
            f"  {name:>4}: tokens={burn['total']:,} "
            f"cost=${stats['cost']['total']} sessions={stats['sessions']['total']} "
            f"loc={stats['locDelta']['net']:+d}"
        )
    print(f"wrote {current_path}")
    print(f"wrote {archive_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
