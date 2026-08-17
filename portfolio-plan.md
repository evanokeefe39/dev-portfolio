# Portfolio site plan

## Concept

Single-page dev portfolio for a data engineer / analytics engineer. Full-viewport 3D isometric office cutaway as the hero, with transparent glass UI overlays floating on top. The scene shows voxel-style AI agent characters at desks, replaying real session data (PRs, branches, LOC diffs). Updated weekly — not realtime.

## Layout (z-order, back to front)

1. **3D scene** — full viewport, existing Vite project (warehouse / cozy office toggle, time-of-day slider)
2. **Nav bar** — floating glass pill, top edge. Name (monospace) + links (Blog, About, GitHub)
3. **Stat card** — single glass card, top-left below nav. Cycles through four metric faces on a 4s interval. Has a persistent time range toggle row (7d, 30d, 90d, 1y, all) that filters all faces
4. **Session data labels** — floating glass pills anchored near agent characters in the 3D scene. Show branch name, PR title, LOC +/-. Cycle through recent activity on a timer
5. **Blog carousel** — floating glass card row, bottom edge. Auto-scrolls. Each card shows date + title, links to full MDX post

All overlays use the same glass treatment: `rgba(0,0,0,0.3)` background, `1px solid rgba(255,255,255,0.1)` border, `border-radius: 10px`.

## Stat card — cycling faces

The card cycles through four faces with a fade-slide transition (300ms, vertical):

1. **Token burn** — sparkline + total count + % change vs prior period
2. **Tokens by model** — horizontal bar chart, top models ranked by usage
3. **PRs merged** — sparkline + count + active repo count
4. **LOC delta** — net lines changed + breakdown (added / removed)

Behavior:
- Hover pauses the cycle
- Click advances to next face manually
- Dot indicators (top-right, beside time pills) show current position
- Time range toggle is persistent across all faces — selecting "90d" updates every metric to its 90-day window

## Sparkline downsampling

Sparklines must look visually consistent across time ranges despite very different data point counts. The build script should normalize every sparkline to 12–15 rendered points regardless of the source range:

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
| Sparklines | Raw SVG polylines | No charting library needed — generate paths at build time |
| Bar charts | CSS widths | Percentage of max value, rendered as divs |
| Data | Static JSON | `data/session.json`, `data/usage.json` — rebuilt weekly |
| Deployment | Vercel | Static hosting, auto-deploy on push |

## Data pipeline

Weekly GitHub Action (cron, Sunday night):

1. Call GitHub API → merged PRs from past 7/30/90/365 days + all time
2. Read token usage log (source TBD — API response metadata, LiteLLM gateway, or manual CSV)
3. Compute all metrics at each time scale
4. Run LTTB downsampling on sparkline series
5. Write `data/session.json` and `data/usage.json`
6. Commit + push → Vercel rebuilds

### session.json shape

```json
{
  "lastUpdated": "2026-08-17T00:00:00Z",
  "prs": [
    {
      "title": "Refactor DB layer",
      "number": 247,
      "branch": "fix/api-rate-limit",
      "repo": "my-app",
      "linesAdded": 67,
      "linesRemoved": 12,
      "mergedAt": "2026-08-15T14:30:00Z"
    }
  ]
}
```

### usage.json shape

```json
{
  "7d": {
    "tokenBurn": {
      "total": 1200000,
      "changePct": 18,
      "sparkline": [80000, 95000, 120000, 110000, 150000, 180000, 200000]
    },
    "tokensByModel": [
      { "model": "sonnet", "tokens": 540000 },
      { "model": "opus", "tokens": 380000 },
      { "model": "haiku", "tokens": 180000 }
    ],
    "prsMerged": {
      "count": 14,
      "activeRepos": 3,
      "sparkline": [1, 2, 3, 1, 2, 3, 2]
    },
    "locDelta": {
      "net": 2847,
      "added": 3412,
      "removed": 565
    }
  },
  "30d": { ... },
  "90d": { ... },
  "1y": { ... },
  "all": { ... }
}
```

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
- Use `drei`'s `<Html>` for data labels in 3D space
- Pros: single build, 3D-anchored labels, shared state with overlay UI, one React runtime
- Cons: ~1–2 days of dependency upgrade + import/type fixes (mechanical, not a rewrite)

## Mobile considerations

- Single stat card works at any viewport width — no layout changes needed
- Blog carousel: reduce visible cards, same Embla config with responsive breakpoints
- 3D scene: consider a static fallback image on very small screens or low-power devices
- Nav: collapse links behind a menu icon below ~640px
- Time-of-day slider: hide on mobile or move to a settings gear

## Open questions

- Token usage data source — API logging, LiteLLM, manual CSV?
- Scene toggle (Cozy Office / Warehouse) — keep both or ship one?
- Time-of-day slider — manual or auto-track visitor's local time?
- Blog post routing — `/blog/[slug]` as separate pages or inline expand?
