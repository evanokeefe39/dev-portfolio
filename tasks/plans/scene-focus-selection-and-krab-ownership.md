# Scene focus, selection, and krab ownership

Date: 2026-08-18

## Intent

Make the 3D hero explorable and legible. Users can pan/zoom the warehouse; the
stat card becomes the control surface for the scene (hover highlights a krab,
click flies the camera to it and shows its sessions); every krab is a data
anchor, so the desk row is the top-16 repos by magnitude, an out-of-list repo
gets a spotlight krab on the lounge couch, and ambient wandering krabs are
reduced to a few idle ones in the lounge — no more random clipping.

## Context Package

### Relevant existing code

- `components/scene/Scene.tsx` — fixed orthographic camera (`camera` prop +
  `onCreated` lookAt, lines 59-67), no controls; Canvas opts back into pointer
  events via `style={{ pointerEvents: 'auto' }}` (line 58) under a
  `pointer-events-none` wrapper (line 55). Renders `SessionKrab`s from
  `buildKrabLayout` + `SEAT_POSITIONS`, plus `WarehouseEnvironment`.
- `components/scene/layout.ts` — `buildKrabLayout` (per-session at 7d,
  per-repo above; lines 232-272), `aggregateReposByRepo` (sums to counts,
  discards session list; lines 154-213), `RepoAggregate` (lines 125-139),
  `repoTooltipBody`, `sessionScale`, `SEAT_CAPACITY = 16`, `SEAT_POSITIONS`
  (16 seats).
- `components/scene/SessionKrab.tsx` — deterministic voxel krab, hover-gated
  drei `<Html>` tooltip, invisible hitbox.
- `components/scene/environments/warehouse/index.tsx` — renders
  `KrabGeneration count={15} seed={77}` ambient wanderers (line 38);
  `WAREHOUSE_CONFIG` camera/zoom/orbitTarget.
- `components/scene/krabs/generator.tsx`, `traits.ts` (mulberry32,
  `generatePath` = 5-8 random waypoints in a `[-2.2,2.2]` square),
  `KrazyKrab.tsx` (straight-line lerp between waypoints at y=0, no collision —
  the clipping root cause), `ChairKrab.tsx` (seated idle reference).
- `components/scene/environments/warehouse/Furniture.tsx` — `LoungeArea`
  couches: couch 1 against right wall (seat at `[-4.2, 0.18, 5.45]`, spans
  x ≈ -5.2..-3.2), couch 2 against left wall (`x≈-5.5`, along z).
- `lib/snapshot-store.ts`, `lib/range-store.ts` — established pub/sub +
  `useSyncExternalStore` store pattern to mirror for selection state.
- `components/StatCard.tsx` — 4s cycling card; "PRs referenced" face shows
  `prsReferenced.count` + `activeRepos`; persistent range toggle.
- `components/RepoCarousel.tsx` — right-edge repo cards, >7d only; computes
  `aggregateReposByRepo(filterWindow(...))` from the shared snapshot.
- `lib/types.ts` — `SessionEntry` (has `day`, `startTs`, `title`, `summary`,
  `assistantMessages`, `locDelta`, `prRefs`, `branch`), `RepoAggregate`.
- `tests/layout.test.ts`, `tests/data.test.ts` — existing layout tests.
- `package.json` — `@react-three/drei ^10.7.8`; `camera-controls ^3.1.0` is a
  drei dependency (verified in `node_modules/@react-three/drei/package.json`
  line 37) — drei's `<CameraControls>` adds no new dependency.

### Architectural constraints

- Client components only; scene loaded via `dynamic(..., { ssr: false })`.
- TypeScript strict; deterministic, unit-testable pure layout derivation in
  `layout.ts` (no React in the pure layer).
- Snapshot is fetched once via `snapshot-store`; scene and card share it.
- Static export; no new runtime data sources.
- No new npm dependencies (drei's `CameraControls` already ships `camera-controls`).

### Prior decisions

- Ordering is **magnitude** (total `assistantMessages` in the selected window)
  for both the repo list and the desk krabs, at every range (7/30/90/1y/all).
  Recency ordering rejected.
- Desk krabs own the hot-desk row: top-16 repos by magnitude fill the seats.
- Spotlight (option B, user-selected): the lounge couch is **overflow-only** —
  a selected repo outside the top-16 renders there. A selected top-16 repo
  flies to and spotlights its desk krab. No repo duplication.
- Ambient krabs: a few, idle, on the lounge couches only. No wandering paths,
  no clipping by construction. Data krabs own the desks.
- The 3D scene is visual appeal, not complexity — favor the simplest correct
  interaction over elaborate machinery.
- DuckDB for future data analysis (user preference).

### Anti-patterns to avoid

- Free-wandering krab paths over furniture (the current clipping bug).
- Two competing repo control surfaces (card list + RepoCarousel) saying
  different things at different ranges.
- Duplicating a repo as both desk krab and couch krab (option A, rejected).
- Hand-rolled camera tweening when `camera-controls` provides smooth
  `setLookAt`/`fitToBox` for free (no new dep).
- Full free camera rotation: the scene is an isometric cutaway with no skybox;
  orbiting behind walls breaks the illusion (rotation disabled).

## Behavioral Contracts

- **C1 — Explore.** GIVEN the scene is mounted with a loaded snapshot, WHEN
  the user drags on empty scene area, THEN the camera pans (no rotation);
  WHEN the user wheels/pinches, THEN zoom changes within configured
  `minZoom`/`maxZoom` bounds; panning is bounded so the room stays framed.
- **C2 — Repo aggregation at every range.** GIVEN any range (7d included),
  WHEN `buildKrabLayout` runs, THEN items are one krab per repo (mode
  `'repos'`), ordered by magnitude desc, top `SEAT_CAPACITY`, with overflow =
  repos beyond capacity. No per-session mode remains.
- **C3 — Aggregate retains sessions.** GIVEN `aggregateReposByRepo` over a
  window, THEN every `RepoAggregate.sessions` contains exactly that repo's
  window sessions, sorted newest-first (`startTs` desc, tie-break
  harness:sessionId), and all existing sums remain correct.
- **C4 — Desk focus.** GIVEN a selected repo that is in the top-16 desk
  layout, WHEN the repo is selected from the card, THEN the camera flies to
  that repo's desk krab (smooth `setLookAt`, isometric direction preserved),
  the krab shows a highlight ring, and a session panel renders above it
  (replacing the hover tooltip while focused).
- **C5 — Couch spotlight.** GIVEN a selected repo NOT in the top-16, WHEN
  selected, THEN a krab for it appears seated at the couch spotlight
  (`COUCH_SPOTLIGHT_SEAT`), the camera flies to it, highlight ring + session
  panel render above it. No desk krab changes.
- **C6 — Deselect/home.** GIVEN a selection exists, WHEN selection is cleared
  (or a second click toggles it off), THEN the spotlight krab disappears, all
  highlight rings clear, session panels hide, and the camera returns to the
  home isometric view.
- **C7 — Range change.** GIVEN the range toggle changes, WHEN the window's
  repo set is recomputed, THEN desk krabs re-render to the new top-16 and any
  stale selection is cleared (deterministic).
- **C8 — Card hover.** GIVEN the pointer hovers a repo row in the expanded
  card list, THEN the matching krab (desk or couch) highlights and its tooltip
  shows, without moving the camera.
- **C9 — Card list.** GIVEN the card's "more details" expansion is open, THEN
  it shows the full magnitude-ordered repo list for the active range
  (scrollable), pauses the 4s face cycle, and the active range toggle still
  filters it.
- **C10 — Ambient krabs.** GIVEN the scene renders, THEN at most 3 ambient
  krabs exist, all in the lounge (couch 2 / side-table area), none on the
  spotlight couch (couch 1) and none on the desk row; they idle in place
  (seated bounce/leg wiggle) with no horizontal movement, so no clipping.

## Edge Case Inventory

- Snapshot loading / failed fetch / empty window → empty scene, empty card
  list, no selection (existing empty-state behavior preserved).
- Range = `all`: 48 repos → top-16 desks + 32 overflow; couch spotlight serves
  any non-top-16 selection.
- Repo with zero sessions in the new window after a range change → selection
  cleared (C7), cannot be selected (not in list).
- Session panel overflow: a repo with many window sessions (e.g. 100+) →
  capped rows + scroll, not an unbounded Html.
- Selection while the user is mid-drag/pan → `setLookAt` interrupts cleanly
  (camera-controls replaces the in-flight tween); no stuck camera.
- Drag that starts on a krab → pans, does not trigger selection (camera-controls
  movement threshold).
- Focused krab hover → tooltip suppressed while the session panel is showing.
- Mobile/touch: one-finger pan, two-finger pinch zoom via camera-controls;
  card expand + row tap work on touch.
- Ambient krab count and spotlight never occupy the same couch (couch 2 vs
  couch 1) and never spawn on a desk seat.

## Definition of Done

- [ ] `buildKrabLayout` renders repo mode at every range; per-session mode
      and its tests removed; `tests/layout.test.ts` green.
- [ ] `RepoAggregate.sessions` retained + sorted newest-first; existing
      sums unchanged; covered by tests.
- [ ] `lib/selection-store.ts` (mirrors range-store) with `selectedRepo`,
      `hoveredRepo`, `selectRepo`, `clearSelection`, `useSelection`; tested.
- [ ] `CameraControls` in Scene (drei, no new dep): pan/zoom enabled,
      rotation disabled, zoom bounds, pan boundary, home restore; no
      `onCreated` lookAt.
- [ ] Desk focus (C4) and couch spotlight (C5) render correct krab/ring/panel
      and fly the camera; pure `resolveFocus` helper in `layout.ts` tested
      (desk / couch / null).
- [ ] Session panel above focused krab: glass Html, session rows newest-first,
      capped + scroll; hover tooltip suppressed while focused.
- [ ] StatCard PRs face: expandable scrollable repo list (magnitude order,
      active range), hover→highlight, click→select, cycle paused while open.
- [ ] `KrabGeneration count={15}` replaced with ≤3 idle lounge krabs on couch
      2 area; `generatePath` wandering no longer used in the environment;
      no krab clips furniture (visual check).
- [ ] RepoCarousel removed (superseded by the card list) and page.tsx updated
      — OR explicitly kept per human review.
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all
      pass; manual browser pass of C1/C4/C5/C6/C8 (fly-to, spotlight, home
      restore, hover highlight).
- [ ] Docs updated: `portfolio-plan.md` (scene/control-surface sections),
      `WATCHDOG.md` (krab ownership), `lessons.md` if a correction surfaces.
- [ ] Plan review section written; assumption log below.

## Negative Space

What must not change:

- The data pipeline and snapshot schema (no new fields; `sessions` retention
  is client-side only).
- StatCard's other three faces and their metrics; the range toggle behavior.
- The isometric cutaway aesthetic, glass overlay styling, post-processing.
- The R3F stack (no game-engine migration; settled).
- Scene stays `'use client'` + `dynamic(..., { ssr: false })`.
- No new npm dependencies.

What is explicitly out of scope:

- Recency ordering (rejected), per-session krabs at any range, krab
  "take-over" displacement (superseded by spotlight), physics/collision
  layer (unneeded once ambient krabs are stationary).

## Assumptions (to be triaged in review)

1. Rotation disabled on the camera (pan/zoom only) — matches the cutaway
   constraint; reversible via two config booleans.
2. Selection clears on range change (deterministic, avoids stale selections).
3. Ambient count = 2 (couch 2 + side table); trivial to tune.
4. Hover in card = highlight + tooltip only (no camera move); click = fly.
   Matches the user's stated interaction.
5. RepoCarousel removal recommended (superseded by card list) — flagged for
   human confirmation in review.

## Open Questions

- None blocking: assumption 5 (RepoCarousel) is the one item awaiting human
  confirmation before its DoD line is treated as binding.
