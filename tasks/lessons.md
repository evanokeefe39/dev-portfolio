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

## 2026-08-17 — data_pipeline build

- **Pattern:** surgical multi-line line-range edits repeatedly clobbered
  adjacent code on this session (5 misfires). Whole-file rewrites with
  `write` were the reliable fix.
- **Rule:** for dense, line-number-sensitive files (SQL-string-heavy modules,
  test data builders), prefer whole-file rewrites over multi-hunk SWAPs.
- **Action:** rewritten `sources.py`, `cli.py`, `test_metrics.py` wholesale.

## 2026-08-17 — Next.js frontend scaffold

- **Pattern:** the Embla auto-scroll plugin package is
  `embla-carousel-auto-scroll` (hyphenated); `embla-carousel-autoscroll` 404s
  ("unpublished"). The plugin registers as `emblaApi.plugins().autoScroll` and
  has a native `stopOnMouseEnter` option (no manual handlers needed).
- **Rule:** verify package names against the registry before writing imports;
  prefer the plugin's built-in options over hand-rolled handlers.

- **Pattern:** `remark-mdx-frontmatter` v5 exports frontmatter as ONE
  `frontmatter` object export, not per-field named exports (`title`/`date`).
  Named imports compile-but-fail with "X is not exported" only at build.
- **Rule:** check the installed plugin's readme for its export shape before
  writing imports; build warnings about missing exports are failures.

- **Pattern:** @next/mdx aliases its provider import source to a root
  `mdx-components.tsx` and falls through to `@mdx-js/react` when absent —
  whose module scope calls `React.createContext`, which React 19's RSC build
  does not export, crashing static generation with a swallowed
  `createContext is not a function` error page.
- **Rule:** every App Router MDX project needs a root `mdx-components.tsx`
  (the documented convention) — not optional once React 19 is in play.

- **Pattern:** template-literal `import(\`@/content/blog/${slug}.mdx\`)`
  bundles nothing through the MDX loader — routes render as `__next_error__`
  shells while the build exits 0. A static slug→module registry of literal
  imports is the reliable pattern (also mandated by ts-no-dynamic-import).
- **Rule:** MDX modules must be imported with literal specifiers; never a
  runtime-composed path.

- **Pattern:** `npm run build | tail` masks the real exit code (the pipe
  returns tail's status) and Next's minified error shells hide the cause;
  root-causing required reproducing via `next dev` + fetch.
- **Rule:** check exit codes and the actual output artifacts (e.g. `out/**`
  HTML content), not just "build ok" text.

## 2026-08-17 — source completeness: "honest zeros" were a missing source

- **Pattern:** the data pipeline read `~/.claude` / `~/.pi` / `~/.codex` and
  reported 7d/30d tokenBurn = 0 as "honest zeros — no sessions in the last
  month." In fact the current harness (Oh My Pi) logs to
  `~/.omp/agent/sessions/**/*.jsonl` with a different schema (top-level vs
  message-nested usage, exact cost in `usage.cost.total`), and that source was
  entirely missing.
- **Rule:** a zero aggregate is a red flag, not a data reality. Before accepting
  "no data," enumerate the actual source paths on disk and confirm each is
  globbed. The active harness's log directory changed (`~/.pi` → `~/.omp`), and
  mirroring an older tool (loc-dock) carried stale paths forward.
- **Action:** added the OMP source with a COALESCE silver template (handles both
  usage layouts) and direct cost; 7d tokenBurn went 0 → 2.17B.
