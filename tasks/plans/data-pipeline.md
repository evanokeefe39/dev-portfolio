# Plan: data_pipeline snapshot generator

## Intent

Standalone `data_pipeline/` Python package (uv-managed) that ingests local
Claude/Pi/Codex session JSONL + `~/repos/*` git history, computes developer
metrics over 5 ranges (7d/30d/90d/1y/all), LTTB-downsamples sparklines, and
writes a committed JSON snapshot to `public/data/`. Logic mirrors
`~/repos/loc-dock` (Rust): DATA_FLOWS.md, source_adapter.rs, usage_store.rs,
pricing.rs, git.rs. Schema is the locked snapshot schema in the assignment —
single source of truth for both the pipeline and the Next.js frontend.

## Context Package

### Relevant existing code
- `~/repos/loc-dock/docs/DATA_FLOWS.md` — end-to-end flow, SQL templates
- `~/repos/loc-dock/.../source_adapter.rs` — glob discovery, skip subdirs
- `~/repos/loc-dock/.../usage_store.rs` — silver extraction, bucket SQL,
  query_aggregates / query_cost_buckets / query_token_buckets / count_sessions
  / query_commit_buckets / query_commit_totals
- `~/repos/loc-dock/.../pricing.rs` — LiteLLM JSON, per-token → per-million
  conversion, gpt-4o-mini default fallback
- `~/repos/loc-dock/.../git.rs` — `git log --numstat` parsing
- `~/repos/loc-dock/.../sql/claude-silver.sql`, `pi-silver.sql`,
  `codex-silver.sql` — JSON-path extraction
- `portfolio-plan.md` — data process section, smoke-test gate, schema example

### Architectural constraints
- DuckDB `read_ndjson_objects` for JSONL (NEVER `read_ndjson_auto`)
- Local-timezone daily bucketing (not UTC)
- Sparklines: daily buckets → LTTB → 12–15 points
- Cost per model via LiteLLM community pricing JSON; unavailable → cost.total
  null, breakdown zeros
- Pipeline touches nothing outside `data_pipeline/` except `public/data/`
- PR refs via regex `#(\d+)`; branch best-effort via `git log --source`,
  null when ambiguous
- `read_ndjson_objects` per source kind; dedupe on (source, session_id, ts)

### Prior decisions
- Python + DuckDB (plan doc), separate from Next.js app
- History snapshots kept forever
- `git log --source` for branch attribution
- Snapshots committed by the human; script only writes files

### Anti-patterns to avoid
- No `read_ndjson_auto` (OOM-crashes on heterogeneous logs)
- No Python JSON parsing of JSONL — DuckDB parses
- No incremental registry needed: single-run recompute (snapshot is rebuilt
  from scratch each run; git scan bounded with `--since=400.days` mirroring
  loc-dock RETENTION_DAYS)
- No UTC bucketing

## Behavioral Contracts (GIVEN/WHEN/THEN)

1. GIVEN real JSONL under `~/.claude/projects/**/*.jsonl` (skipping
   `subagents/`) WHEN `uv run snapshot` runs THEN `public/data/current.json`
   is valid JSON matching the locked schema and token/cost numbers aggregate
   assistant rows with `message.usage`.
2. GIVEN `git log --numstat` output WHEN parsed THEN per-commit
   added/removed sums match the numstat columns, binary (`-`) files skipped.
3. GIVEN a pricing JSON with per-token prices WHEN a model is looked up THEN
   cost is priced per million tokens; unknown models fall back to
   `gpt-4o-mini`; missing file → `cost.total = null`, breakdown zeros.
4. GIVEN daily-bucketed sparkline arrays WHEN longer than 14 points THEN LTTB
   downsample returns exactly 14 points keeping first/last.
5. GIVEN a 7-day window WHEN aggregating THEN tokenBurn/changePct compare
   against the prior 7 days (null when prior total is 0).
6. GIVEN commits across repos WHEN building recentActivity THEN newest-first,
   capped at 20, prRefs from `#(\d+)`, branch null when ambiguous.

## Edge Case Inventory
- Empty/missing source dirs (codex absent) → zero contribution, no crash
- Unparseable JSONL lines → `ignore_errors = true`
- No pricing file → null cost
- No data in a range → totals 0, sparkline `[]`, changePct null
- Same (source, session_id, ts) duplicates → deduped
- DST/offset changes → local-date bucketing via `astimezone()`
- Pi rows with provider-supplied cost → keep; else price per model
- Binary files in numstat → skipped
- Repos with no `.git` or no commits → skipped
- Future-dated events → excluded from windows, never crash

## Definition of Done
- [ ] `data_pipeline/pyproject.toml` + `uv` venv; `uv run snapshot` runs
- [ ] Smoke test prints schema + 3 sample rows from one real JSONL
- [ ] `public/data/current.json` valid + schema-correct after a run
- [ ] pytest passes (LTTB test, 5-range aggregation test, source parse,
      snapshot schema)

## Negative Space
- No AI summaries (v2)
- No incremental/registry logic (single-run recompute)
- Script never runs `git commit`; snapshot is committed by the human
- No changes to frontend code (nextjs-scaffold owns that)

## Open Questions
- None — assignment + loc-dock mirror + plan doc cover all decisions.

## Review (2026-08-17)

- All DoD items met: `uv run snapshot` runs (42,939 entries from 1,446 JSONL
  files, 8,474 commits across 124 repos); smoke test prints schema + 3 sample
  rows from a real Claude file; `public/data/current.json` schema-validated
  against the locked schema; 42/42 pytest tests pass.
- Real-data finding: session entries span 2026-05-23 → 06-29 only; 7d/30d
  token/session windows are legitimately zero. Git activity is current
  (7d loc +20,748). Not a pipeline bug — sources have no newer sessions.
- Corrections during build: DuckDB `json_extract(...) IS NOT NULL` treats a
  JSON `null` as present (loc-dock behaves identically — mirrored); LTTB
  keeps endpoints, so sparkline[0] is the oldest bucket.
