# Lessons

Session-level patterns to review before starting work. Append after any
correction; reference the specific failure mode and the rule that prevents it.

## 2026-08-17 — repo init and 3D review

- **Pattern:** the plan doc described the 3D scene as a "vibe-coded Vite
  project" needing a "significant rewrite" to port into Next.js (Option B).
  The actual scene is already React Three Fiber v8 with clean environment
  components and config objects — a port, not a rewrite.
- **Rule:** before costing an integration, read the actual source. The plan's
  iframe "recommendation" was based on a wrong cost assumption. The real driver
  is the React 18→19 / R3F v8→v9 version gap, not the framework choice.
- **Action:** corrected `portfolio-plan.md`; added `docs/3d-scene-tech-review.md`.

## 2026-08-17 — data source assumption corrected

- **Pattern:** the plan assumed a weekly GitHub Action calling the GitHub API
  for PRs and an unknown token-usage source. The real sources are local
  (`~/.claude` JSONL + `~/repos/*` git logs), already ingested by loc-dock via
  DuckDB + LiteLLM pricing. GitHub Actions runners cannot see local files, so
  the pipeline must run locally and commit snapshots.
- **Rule:** before designing a data pipeline, identify where the source data
  physically lives. A CI-based pipeline is wrong when sources are local-only.
  Reuse existing ingestion logic (loc-dock) rather than re-deriving the schema.
- **Action:** rewrote the "Data process" section of `portfolio-plan.md`;
  PRs are local `#NNN` commit refs; AI summaries deferred to v2; snapshots
  kept forever. Smoke-test fixture: `loc-dock/usage_data_*.zip`.

## 2026-08-17 — data process separated from frontend

- **Pattern:** the data process (Python + DuckDB, local sources) and the
  Next.js static frontend have different runtimes and lifecycles. Coupling
  them (e.g. importing generated JSON at build time, or mixing Python into
  the JS build) couples the data refresh to the build and bloats the bundle.
- **Rule:** keep the generator and the consumer as separate packages sharing
  only an output path. Python writes to `public/data/`; Next.js fetches
  `/data/current.json` at runtime. `public/` is the only dir served verbatim
  at the site root and copied as-is into the static export.
