# Frontend iteration: snapshot store + hover labels + repo cards

Date: 2026-08-18

## Intent

Remove the stat card lag and make the 3D scene legible: fetch `/data/current.json`
exactly once per page load (shared store), gate krab tooltips behind hover, and
aggregate sessions by repo for ranges above 7d with swipeable repo cards.

## Checkable items

### Data fetching / state review (deliverable: summary in final chat)

- [x] Review current client stack: raw `fetch` + `cache: 'no-store'` called
      independently by StatCard and Scene; range-store already uses the
      idiomatic `useSyncExternalStore` pattern.
- [x] Ground the review in 2026 industry practice (web search: TanStack Query /
      SWR for server state, useState for local, useSyncExternalStore for
      external stores, React `cache()`/`use()` on the server).

### Snapshot store

- [x] `lib/snapshot-store.ts`: fetch-once shared snapshot store with
      `useSnapshot()` (same pub/sub + `useSyncExternalStore` pattern as
      range-store). No new dependencies.
- [x] StatCard and Scene consume `useSnapshot()`; delete their duplicate
      `loadSnapshot()` effects.
- [x] Test: two subscribers share one fetch; subscribers notified on resolve.

### 3D tooltip occlusion

- [x] SessionKrab tooltips hover-gated (invisible hitbox + `Html` only visible
      while hovered via opacity toggle); Canvas enables pointer events.
- [x] Fix found in browser verification: drei `<Html>`'s outer div ignores the
      `pointerEvents` prop and swallowed all canvas events — added
      `wrapperClass="pointer-events-none"` to both scene `<Html>` labels.

### >7d repo aggregation + carousel

- [x] `layout.ts`: `filterWindow` + `aggregateReposByRepo` + `repoTooltipBody`;
      `buildKrabLayout` stays per-session at 7d, `mode: 'repos'` above 7d.
- [x] `RepoCarousel.tsx`: Embla swipeable/scrollable repo cards (BlogCarousel
      pattern), visible only for ranges > 7d; wired into page.tsx.
- [x] Tests: repo grouping/sums/dominant-harness/ordering/overflow; existing
      session-mode tests updated where they used >7d ranges.

### Verify

- [x] `npm test` — 39 pass (8 new repo-aggregation tests, 1 store test)
- [x] `npm run typecheck` and `npm run lint` — clean
- [x] `npm run build` static export — exit 0
- [x] Browser verification on `next dev`: at rest zero krab pills visible (only
      the overflow pill); hovering a krab reveals its pill (session at 7d, repo
      aggregate at 30d); 30d shows 15 repo krabs + RepoCarousel with auto-scroll
      and swipe; repo carousel hidden at 7d.
- [x] Docs: portfolio-plan.md layout section, WATCHDOG.md, lessons.md

## Review section

- Assumption: "the cards … like a carousel" = a glass repo-card panel (Embla,
  swipeable/scrollable), mirroring BlogCarousel; scene krabs stay the visual
  anchor with hover-only labels. If the intent was carousel-inside-tooltip,
  that's a follow-up.
- Assumption: dominant harness = most sessions in repo (tie-break by harness
  order); repo magnitude = total assistant messages (same `sessionScale`).
- Finding: drei `<Html>` needs `wrapperClass="pointer-events-none"` — without it
  invisible tooltips block canvas pointer events (hover dead). Logged in
  WATCHDOG.md and lessons.md.
- No new dependencies added.
