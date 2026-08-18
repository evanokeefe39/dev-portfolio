# Portfolio site plan

## Concept

Single-page dev portfolio for a data engineer / analytics engineer. Full-viewport 3D isometric office cutaway as the hero, with transparent glass UI overlays floating on top. The scene shows voxel-style AI agent characters at desks, replaying real session data (PRs, branches, LOC diffs). Data is refreshed by a local snapshot script run on the developer's machine; snapshots are committed to the repo and served statically. Not realtime.

## Layout (z-order, back to front)

1. **3D scene** — full viewport, the warehouse environment from `3d-scene-test` (Cozy Office dropped for v1). Time-of-day auto-tracks the visitor's local time; no manual slider
2. **Nav bar** — floating glass pill, top edge. Name (monospace) + links (Blog, About, GitHub)
3. **Stat card** — single glass card, top-left below nav. Cycles through four metric faces on a 4s interval. Has a persistent time range toggle row (7d, 30d, 90d, 1y, all) that filters all faces
4. **Scene labels** — hover-gated glass pills anchored to the krabs: at 7d one pill per session (repo · harness, day, msgs, LOC, PRs, branch, summary); above 7d the scene aggregates by repo and pills show per-repo stats. Invisible at rest so the krabs stay visible
5. **Repo carousel** — glass card row, right edge below the nav, visible for ranges above 7d. One swipeable/scrollable card per repo (Embla auto-scroll, pauses on hover): repo name, harness dots, sessions/days/msgs, LOC and PR refs
6. **Blog carousel** — floating glass card row, bottom edge. Auto-scrolls. Each card shows date + title, links to full MDX post

All overlays use the same glass treatment: `rgba(0,0,0,0.3)` background, `1px solid rgba(255,255,255,0.1)` border, `border-radius: 10px`.

## Stat card — cycling faces

The card cycles through four faces with a fade-slide transition (300ms, vertical):

1. **Token burn** — sparkline + total count + % change vs prior period
2. **Tokens by model** — horizontal bar chart, top models ranked by usage
3. **PRs referenced** — sparkline + count of `#NNN` commit refs + active repo count (local, no GitHub API)
4. **LOC delta** — net lines changed + breakdown (added / removed)

Behavior:
- Hover pauses the cycle
- Click advances to next face manually
- Dot indicators (top-right, beside time pills) show current position
- Time range toggle is persistent across all faces — selecting "90d" updates every metric to its 90-day window

> `cost` and `sessions` are also captured in the snapshot (from loc-dock's model) and are available for future faces or tooltips, even though v1 ships four faces.

## Sparkline downsampling

Sparklines must look visually consistent across time ranges despite very different data point counts. The snapshot script normalizes every sparkline to 12–15 rendered points regardless of the source range:

- **7d**: 7 raw points (daily) → use all 7, pad to 12 with interpolation if needed, or keep as-is since 7 points still reads fine
- **30d**: 30 raw points → downsample to ~15 by taking every other day
- **90d**: 90 raw points → downsample to ~15 by bucketing into ~6-day windows and averaging
- **1y**: 365 raw points → downsample to ~15 by bucketing into ~24-day (monthly-ish) windows
- **all**: variable → bucket into 12–15 evenly spaced windows regardless of total span

Use LTTB (Largest Triangle Three Buckets) algorithm for downsampling — it preserves visual shape better than simple averaging or uniform sampling. Available as an npm package (`downsample` or `lttb`).

## Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js (App Router) | Static export via `output: 'export'`. Vercel-native |
| 3D scene | React Three Fiber v9 (port of `3d-scene-test`) | See `docs/3d-scene-tech-review.md` for the port decision |
| Overlay UI | React + Framer Motion | Glass cards, transitions, carousel |
| Blog content | MDX via `@next/mdx` | Posts in `/content/blog/*.mdx` with frontmatter |
| Blog carousel | Embla Carousel | Lightweight (~3KB), auto-play, infinite loop |
| Styling | Tailwind CSS | Purged in production |
| Sparklines | Raw SVG polylines | No charting library needed — paths generated from committed JSON |
| Bar charts | CSS widths | Percentage of max value, rendered as divs |
| Data | Committed JSON snapshots | `public/data/current.json` + `public/data/history/` — served statically, included in the static export |
| Data process | Python + DuckDB, standalone `data_pipeline/` pkg | `uv run snapshot`; reads OMP/Claude/Pi/Codex JSONL + `git log`. Cost: OMP direct, others via LiteLLM. Separate from the Next.js app |
| Deployment | Vercel | Static hosting, auto-deploy on push |

## Data process (local snapshot)

A standalone Python package at `data_pipeline/` (own `pyproject.toml`, `.venv` managed by `uv`) reads the same sources [loc-dock](../../loc-dock) uses and writes aggregate JSON into the Next.js `public/data/` directory. The frontend fetches `/data/current.json` at runtime; the Python process and the Next.js app share no code. Vercel builds the static site from the committed JSON — no runtime data access, no tokens in CI.

**Why local and Python:** the sources (`~/.claude` JSONL, local git repos) live on the developer's machine; GitHub Actions runners cannot see them. Python + DuckDB is the mature stack (matches loc-dock's spikes) and Python is guaranteed present locally. The process runs on-demand (`uv run snapshot`) and commits the result; cadence is manual for v1, with optional local cron later. `public/` is the only directory served verbatim at the site root and copied as-is into the static `out/` export.

### Sources (mirror loc-dock)

- **Session JSONL** — Oh My Pi `~/.omp/agent/sessions/**/*.jsonl` (current harness, primary), Claude `~/.claude/projects/**/*.jsonl`, Pi `~/.pi/agent/sessions/*.jsonl`, Codex `~/.codex/sessions/**/*.jsonl`. Ingested via DuckDB `read_ndjson_objects` (the robust path — `read_ndjson_auto` OOM-crashes on heterogeneous logs, per loc-dock's findings).
- **Git** — `git log --numstat` across `~/repos/*`, incremental by `MAX(ts)`.
- **Pricing** — LiteLLM community pricing JSON (2,800+ models) for cost.
- **PRs** — regex-extracted `#123` refs from commit messages (local, no GitHub API, no token).

### Pipeline

1. Ingest changed JSONL → `entries` (bronze→silver, deduped by `(source, session_id, ts)`).
2. Scan git incrementally → `commit_stats` (per-commit added/deleted/msg/repo).
3. For each range (7d, 30d, 90d, 1y, all): aggregate tokens (by model), cost, sessions, LOC delta, PR-ref count, active repos.
4. Compute `% change vs prior period` (e.g., this 7d vs the previous 7d).
5. LTTB-downsample every sparkline to 12–15 points.
6. Write `public/data/current.json` + archive `public/data/history/YYYY-MM-DD.json`.
7. Commit the updated `public/data/` (the `data_pipeline/` package is committed once; only its JSON output is regenerated).

### Smoke-test gate (before writing aggregation logic)

Per the Data Reality Check gate, the script is built against real data first:

- Smoke-test against a real JSONL file (e.g. `~/.claude/projects/C--Users-evano-repos-loc-dock/*.jsonl`), not synthetic data. The OpenRouter CSV in `loc-dock/usage_data_*.zip` is a diagnostic artifact and is NOT a data source.
- Read one real JSONL file; print its schema and 3 sample rows.
- Confirm `read_ndjson_objects` parses it; confirm `git log --numstat` output shape.
- Reconcile a hand-computed total against the script's output before trusting it.

### Snapshot schema (`public/data/current.json`)

```json
{
  "snapshotDate": "2026-08-17",
  "generatedAt": "2026-08-17T22:00:00Z",
  "ranges": {
    "7d": {
      "tokenBurn":     { "total": 1200000, "changePct": 18, "sparkline": [80000, 95000, 120000, 110000, 150000, 180000, 200000] },
      "tokensByModel": [{ "model": "sonnet", "tokens": 540000 }, { "model": "opus", "tokens": 380000 }],
      "cost":          { "total": 4.21, "breakdown": { "input": 1.10, "output": 2.00, "cacheWrite": 0.60, "cacheRead": 0.51 } },
      "sessions":      { "total": 42, "active": 3 },
      "prsReferenced": { "count": 8, "activeRepos": 3, "sparkline": [1, 2, 3, 1, 2, 3, 2] },
      "locDelta":      { "net": 2847, "added": 3412, "removed": 565, "sparkline": [[67, 12], [120, 30]] }
    },
    "30d": { "..." },
    "90d": { "..." },
    "1y":  { "..." },
    "all": { "..." }
  },
  "recentActivity": [
    {
      "repo": "dev-portfolio",
      "message": "Refactor DB layer (#247)",
      "prRefs": [247],
      "branch": "fix/api-rate-limit",
      "linesAdded": 67,
      "linesRemoved": 12,
      "ts": "2026-08-15T14:30:00Z"
    }
  ]
}
```

- `prsReferenced` (not "merged") — counts `#NNN` refs in commit messages, local.
- `branch` is best-effort via `git log --source`; nullable when ambiguous.
- `locDelta.sparkline` is a `[added, removed][]` series (stacked bar), downsampled.
- `cost` and `sessions` are bonus fields from loc-dock's model, available for future faces/tooltips.

### History & retention

- Each run archives a dated copy to `public/data/history/YYYY-MM-DD.json`.
- **All snapshots are kept forever** (decided). Aggregate JSON is ~5–20 KB each; a year of daily snapshots is a few MB — the repo stays cloneable.
- The site reads `public/data/current.json` only; history is an audit trail and a future "trend of trends" data source.

### Deferred to v2

- **AI summaries** — per-range period narratives (and/or per-repo SHA highlights, loc-dock style). Deferred for v1; the v1 snapshot reserves no field for them. When added, summaries are snapshotted per range and archived alongside the aggregates.

## 3D scene — performance notes

Existing scene is a React Three Fiber v8 app on Vite (React 18). Porting it into Next.js is a dependency upgrade (R3F v8→v9, React 19), not a rewrite — see `docs/3d-scene-tech-review.md`. Performance fixes to audit:

- Merge static geometry with `BufferGeometryUtils.mergeGeometries` — reduce draw calls
- Use `InstancedMesh` for repeated elements (desks, chairs, pillars)
- Ensure textures are power-of-two and compressed
- Consider baking lighting if not already done
- Profile with Chrome DevTools Performance tab and `renderer.info` for draw call count
- Consider `drei`'s `<Stats>` component during development

## 3D scene integration options

**Option A: iframe embed** (fastest v1)
- Keep Vite project as-is, build separately
- Embed in Next.js page via iframe, full viewport
- All overlay UI is Next.js components positioned absolutely over the iframe
- Pros: no scene code change, independent rendering contexts
- Cons: cross-frame communication for data labels needs `postMessage`; two builds; two React runtimes

**Option B: R3F port into Next.js** (target)
- Move the existing `environments/*` / `components/*` / `krabs/*` modules into the Next app as client components (`'use client'`, `dynamic(..., { ssr: false })`)
- Upgrade `@react-three/fiber` 8→9, `drei` 9→10, `@react-three/postprocessing` 2→3 (React 19)
- Use `drei`'s `<Html>` for hover-gated data labels in 3D space (visible only while the pointer is over a krab)
- Pros: single build, 3D-anchored labels, shared state with overlay UI, one React runtime
- Cons: ~1–2 days of dependency upgrade + import/type fixes (mechanical, not a rewrite)

## Mobile considerations

- Single stat card works at any viewport width — no layout changes needed
- Blog carousel: reduce visible cards, same Embla config with responsive breakpoints
- 3D scene: consider a static fallback image on very small screens or low-power devices
- Nav: collapse links behind a menu icon below ~640px
- Time-of-day: auto-tracks visitor local time on all viewports (no manual slider)

## Decided

- **3D scene:** ship the warehouse environment only; Cozy Office dropped for v1.
- **Time-of-day:** auto-tracks the visitor's local time (no manual slider).
- **Blog routing:** `/blog/[slug]` as separate pages.
- **Data process:** Python + DuckDB in a standalone `data_pipeline/` package, `.venv` via `uv`, output to `public/data/`. Separate from the Next.js frontend.

## Open questions

- Branch attribution — best-effort via `git log --source`; refine in v2 if it reads poorly.
- Snapshot cadence — manual `uv run snapshot` for v1; add local cron if a daily refresh is wanted.
