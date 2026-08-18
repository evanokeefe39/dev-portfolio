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

## 2026-08-18 — frontend iteration: fetch dedup, hover labels, repo aggregation

- **Pattern:** StatCard and the 3D scene each fetched `/data/current.json`
  (~340KB, 565 sessions) independently with `cache: 'no-store'` — double fetch
  + double normalize per mount was the stat-card lag. Server-state libraries
  (TanStack Query/SWR) are overkill for one static file; the fix is a
  module-level cached promise + `useSyncExternalStore`
  (`lib/snapshot-store.ts`), the same pattern range-store already used.
- **Rule:** shared static data goes through one fetch-once store; never call
  `loadSnapshot()` directly from more than one component.
- **Pattern:** always-visible drei `<Html>` labels hid every krab in the scene.
- **Rule:** 3D labels are hover-gated (invisible hitbox covers the pill region;
  `pointerEvents="none"` so the pill never steals hover). Always-visible
  labels on a dense scene are a defect.
- **Pattern:** per-session krabs don't scale past 7d (564/565 sessions at 90d).
- **Rule:** choose scene grain by range — individual sessions at 7d, repo
  aggregates above — keep the derivation pure (tests/layout.test.ts) and drive
  DOM presentation (RepoCarousel) from the same aggregation function.
- **Pattern:** drei `<Html>`'s outer positioning div ignores the
  `pointerEvents` prop — invisible (opacity-0) tooltips still left
  hit-testable boxes over the scene that swallowed every canvas pointer event,
  so hover-gating silently did nothing.
- **Rule:** every drei `<Html>` label in an interactive scene needs
  `wrapperClass="pointer-events-none"` on top of `pointerEvents="none"`; verify
  hover in a real browser, not just by reading the DOM (elementFromPoint is the
  cheap check).

## 2026-08-18 — split snapshot per range: eager 7d, lazy slices

- **Pattern:** one 332KB `current.json` (52KB gzip) shipped every session
  record to every visitor: the 7d view needs 42 sessions, the 90d view 564.
  Aggregate ranges were only 7.8KB — the payload was a session log, not
  aggregates.
- **Rule:** split static JSON by access pattern — `7d.json` (eager, full
  detail, all five range aggregates so the stat card has every range on first
  paint) + `30d/90d/1y/all.json` (lazy, windowed sessions stripped to what
  repo aggregation needs: no summaries/titles/branches/startTs, locDelta
  without net). `loadSnapshot`/`loadRangeSessions` in lib/data.ts;
  `ensureRangeSessions` in the store. No query library needed.
- **Pattern:** when a lazy slice is missing, the scene keeps the 7d layout
  until it lands — the range toggle never shows a blank scene.
- **Rule:** strip at the pipeline write step, not in the client; the frontend
  normalizer tolerates missing fields by design, and the pipeline owns the
  locked session schema.

## 2026-08-18 — scene perf: parallel workstreams, pure walk module, leg mirror

- **Pattern:** extracting KrazyKrab's frame loop into a pure `walk.ts`
  silently dropped the left/right leg mirror (`i < 3 ? sw : -sw`) because the
  apply-loop spec was written "clean." Restored at the apply site; walk.ts
  stays unmirrored (mirroring is a presentation concern).
- **Rule:** when a pure-function extraction rewrites the apply site, the spec
  must enumerate presentation transforms (mirroring, sign flips) or the
  visual output changes without a test catching it.
- **Pattern:** `readPixels` on a `preserveDrawingBuffer: false` WebGL canvas
  returns transparent zeros after compositing — it reads like a blank scene
  but isn't one.
- **Rule:** verify a live render loop with rAF cadence + cross-frame
  screenshot diffs, never readPixels on the default framebuffer.
- **Pattern:** five perf workstreams with disjoint file ownership ran in
  parallel without conflicts; every worker self-verified, and the
  orchestrator re-read every diff before accepting (caught the WS-4 mirror
  and an intermediate WS-3 duplicate component).
- **Rule:** for parallel work, keep per-workstream file ownership disjoint and
  re-read every changed file — never accept a worker's summary on trust.
