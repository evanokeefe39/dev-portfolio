# Scene focus, selection, and krab ownership — parallel execution plan

Date: 2026-08-18

## Intent

Make the 3D hero explorable and legible. Users can pan/zoom/rotate the
warehouse; the stat card becomes the control surface for the scene (hover
highlights a krab, click flies the camera to it and shows its sessions); every
krab is a data anchor, so the desk row is the top-16 repos by magnitude, an
out-of-list repo gets a spotlight krab on the lounge couch, and ambient
wandering krabs are reduced to a few idle ones in the lounge — no more random
clipping.

## Context Package

### Relevant existing code

- `components/scene/Scene.tsx` — fixed orthographic camera (`camera` prop +
  `onCreated` lookAt, lines 59-67), no controls; Canvas opts back into pointer
  events via `style={{ pointerEvents: 'auto' }}` (line 58) under a
  `pointer-events-none` wrapper (line 55). Renders `SessionKrab`s from
  `buildKrabLayout` + `SEAT_POSITIONS`; imports `useSnapshot` from
  `lib/snapshot-store`.
- `components/scene/layout.ts` — `buildKrabLayout` (per-session at 7d,
  per-repo above; lines 232-272), `aggregateReposByRepo` (sums to counts,
  discards session list; lines 154-213), `RepoAggregate` (lines 125-139),
  `repoTooltipBody`, `sessionScale`, `SEAT_CAPACITY = 16`, `SEAT_POSITIONS`.
- `components/scene/SessionKrab.tsx` — deterministic voxel krab, hover-gated
  drei `<Html>` tooltip, invisible hitbox, memoized.
- `components/scene/environments/warehouse/index.tsx` — renders
  `KrabGeneration count={15} seed={77}` ambient wanderers (line 38);
  `WAREHOUSE_CONFIG` = `{ background, camera: { position: [12,12,12], zoom: 35 }, orbitTarget: [0,1,0] }`.
- `components/scene/krabs/` — `generator.tsx` (`KrabGeneration`/`GeneratedKrab`,
  imported only by warehouse/index.tsx), `traits.ts` (mulberry32,
  `generateTraits(seed)` → flat `KrabConfig` mapping + `generatePath`),
  `KrazyKrab.tsx` (`useFrame` straight-line path lerp at y=0, no collision),
  `ChairKrab.tsx` (seated idle reference).
- `components/scene/environments/warehouse/Furniture.tsx` — `LoungeArea`
  couches: couch 1 against right wall (base at `[-4.2, 0.18, 5.45]`, spans
  x ≈ -5.2..-3.2, seat top y = 0.54, backrest at z≈5.7), couch 2 against left
  wall (base at `[-5.45, 0.18, 4.0]`, spans z ≈ 3.0..5.0, seat top y = 0.54).
- `lib/snapshot-store.ts`, `lib/range-store.ts` — established pub/sub +
  `useSyncExternalStore` pattern to mirror for selection state.
- `components/StatCard.tsx` — 4s cycling card (4 faces incl. "PRs referenced"
  showing `prsReferenced.count` + `activeRepos`), persistent range toggle.
- `components/RepoCarousel.tsx` — right-edge repo cards (>7d only);
  computes `aggregateReposByRepo(filterWindow(...))`. **To be removed.**
- `lib/types.ts` — `SessionEntry` (`day`, `startTs`, `title`, `summary`,
  `assistantMessages`, `locDelta`, `prRefs`, `branch`); `Harness`, `RangeKey`.
- `tests/layout.test.ts` — existing layout tests (includes per-session 7d
  cases that will be removed).
- `package.json` — `@react-three/drei ^10.7.8`; `camera-controls ^3.1.0` is a
  drei dependency (verified in `node_modules/@react-three/drei/package.json`
  line 37) — drei's `<CameraControls>` adds **zero** new dependencies.

### Architectural constraints

- Client components only; scene via `dynamic(..., { ssr: false })`.
- TypeScript strict; layout derivation stays pure + unit-testable (no React).
- Snapshot fetched once via `snapshot-store`; scene and card share it.
- Static export; no new runtime data sources; **no new npm dependencies**.
- Whole-project `npm run typecheck`/`lint` are valid ONLY while the tree is
  internally consistent — see the wave rules below.

### Prior decisions (locked, do not relitigate)

- Ordering is **magnitude** (total `assistantMessages` in the selected
  window) for both the repo list and the desk krabs, at every range
  (7/30/90/1y/all). Recency ordering rejected.
- Desk row = top-16 repos by magnitude (16 seats, `SEAT_POSITIONS`).
- Spotlight is **overflow-only** (option B): a selected repo outside the
  top-16 renders a krab on the lounge couch; a selected top-16 repo flies to
  and spotlights its desk krab. No repo duplication.
- **Camera rotation is enabled** (user-confirmed) with polar clamps.
- RepoCarousel is **removed** (superseded by the card repo list; user-confirmed).
- Ambient krabs: ≤3, idle, lounge couch 2 only. No wandering paths, no
  clipping by construction. Data krabs own the desks.
- Selection clears on range change (deterministic, avoids stale focus).
- Card hover = highlight + tooltip (no camera move); card click = fly-to.
- The 3D scene is visual appeal, not complexity — simplest correct wins.
- DuckDB for future data analysis (user preference, outside this plan).

### Anti-patterns to avoid

- Free-wandering krab paths over furniture (the current clipping bug).
- Two competing repo control surfaces (card list + RepoCarousel).
- Duplicating a repo as both desk krab and couch krab (option A, rejected).
- Hand-rolled camera tweening when `camera-controls` `setLookAt`/`fitToBox`
  exists (already a drei dependency).
- Two agents editing the same file (see ownership matrix — zero overlap).

## Execution model (waves)

Wave 0 — **independent foundation, all three run in parallel, no shared
files.** Each agent's verification runs against the current tree (the only
changes are its own). All three must land green before Wave 1 starts.

Wave 1 — **feature layer, runs in parallel after Wave 0 merged.** Both agents
code against the locked interface contracts (§Interface contracts); they never
read each other's files.

Wave 2 — **integration + verification, orchestrator only.** Merge-check,
RepoCarousel removal, full suite, browser pass, docs, plan review.

Per-agent retry budget: **max 3 attempts, then escalate to the orchestrator.**
An agent that finds an interface contract wrong must STOP and escalate — it
may not change the contract itself (contract drift breaks the other agents).

## Interface contracts (stable API surface)

Wave 1 codes against these EXACT signatures. Wave 0 implements them. Any
deviation is an escalation, not a local fix.

### From WS-0a (`components/scene/layout.ts`)

```ts
// Repo mode only — the 'sessions' mode and per-session branch are REMOVED.
export type KrabLayout =
  | { mode: 'empty'; items: [] }
  | { mode: 'repos'; items: KrabItem[]; overflow: number }

// KrabItem unchanged: { key, harness, repo, tooltipTitle, tooltipBody,
// seatIndex, scale } (existing fields, same semantics).

// Resolved contract (was ambiguous in v1 of this plan; ws-0a escalated,
// orchestrator confirmed): `sessions` IS the retained list. Session count
// = `sessions.length`. The old `sessions: number` count field is REMOVED —
// `repoTooltipBody` and any count consumers use `.length`.
export interface RepoAggregate {
  repo: string
  daysActive: number
  sessions: SessionEntry[] // window sessions for this repo,
  // sorted newest-first (startTs desc, tie-break `${harness}:${sessionId}`).
  assistantMessages: number
  locAdded: number
  locRemoved: number
  prRefs: number
  harnesses: RepoHarnessCount[]
  harness: Harness
}

export function aggregateReposByRepo(sessions: SessionEntry[]): RepoAggregate[]
// Same signature; now retains + sorts `sessions` per repo. Output still
// sorted by magnitude desc (byRepoMagnitudeDesc), ties by repo name.

export function buildKrabLayout(args: BuildKrabLayoutArgs): KrabLayout
// Same signature; repo mode at ALL ranges (7d included). Empty window → mode 'empty'.

export type FocusTarget =
  | { kind: 'desk'; item: KrabItem }
  | { kind: 'couch'; repo: RepoAggregate }
  | null

export function resolveFocus(
  items: KrabItem[],
  repos: RepoAggregate[],
  selectedRepo: string | null,
): FocusTarget
// desk when selectedRepo is a desk item; couch when it is in repos but not
// on a desk; null when null/unknown.

export const COUCH_SPOTLIGHT_SEAT: [number, number, number] = [-4.2, 0.54, 5.25]
// Couch 1 seat top, facing +x (into the room) → krab rotation.y = -Math.PI/2.

export function sessionRow(s: SessionEntry): string
// One-line session summary for the focus panel:
// `${day} · ${assistantMessages} msgs · +${added}/−${removed} LOC` with
// ` · #NN` PR suffix and ` · <title>` suffix when present; no-commit → no LOC clause.

// Unchanged exports (must keep signatures): SEAT_POSITIONS, SEAT_CAPACITY,
// sessionScale, filterWindow, repoTooltipBody, KrabItem, RepoHarnessCount,
// BuildKrabLayoutArgs.
// REMOVED exports: tooltipBody(session), byMagnitudeDesc, sessions mode.
```

### From WS-0b (`lib/selection-store.ts`, new file)

```ts
// Mirror lib/range-store.ts pub/sub + useSyncExternalStore pattern exactly.

export interface SelectionState {
  selectedRepo: string | null
  hoveredRepo: string | null
}
export function useSelection(): SelectionState
export function getSelection(): SelectionState
export function subscribeSelection(fn: () => void): () => void
export function selectRepo(repo: string | null): void    // no-op if unchanged
export function setHoveredRepo(repo: string | null): void // no-op if unchanged
export function clearSelection(): void                    // both → null
```

### From WS-0c (ambient krabs)

```ts
// KrazyKrab.tsx gains one optional prop (non-idle behavior byte-identical):
export interface KrabConfig {
  // ...existing fields...
  idle?: boolean // NEW — true: no path-following, no horizontal movement;
  // keep leg wiggle + claw snap; gentle vertical bob (±0.02).
}

// New file components/scene/krabs/AmbientCouchKrabs.tsx (no props):
export function AmbientCouchKrabs(): React.JSX.Element
// Exactly 2 krabs, perched on couch 2, facing +x, idle.
// Positions (defaults, tune within couch 2 footprint x∈[-5.35,-5.15],
// z∈[3.2,4.8], y=0.54): [-5.25, 0.54, 3.6] and [-5.25, 0.54, 4.7].
```

### Owned by WS-1a (Scene + SessionKrab — Wave 1 reads these)

```ts
// SessionKrab.tsx gains optional props (existing props/behavior unchanged):
interface SessionKrabProps {
  // ...existing: harness, position, scale, title, body...
  focused?: boolean    // ring + session panel; hover tooltip suppressed
  highlighted?: boolean // ring + hover tooltip forced (external highlight)
  sessions?: SessionEntry[] // rows for the focus panel (already newest-first)
}
// Panel: drei <Html> at [0, 1.9, 0], glass style (match existing tooltip),
// header (title) + ≤8 sessionRow() rows + "+N more" line. pointer-events-none.
// Ring: ringGeometry [0.45, 0.6, 48], rotation-x -π/2 at [0, 0.05, 0],
// color = harness body color, opacity pulsing 0.4–0.9 (useFrame).
```

### Owned by WS-1b (StatCard — Wave 1 reads these)

```ts
// StatCard PRs face gains a "more details" expand:
// - list = aggregateReposByRepo(filterWindow(snapshot.sessions, range,
//   snapshot.snapshotDate)) via useSnapshot() + useRange() — shown at ALL
//   ranges (7d included); empty list → no expansion content.
// - row hover → setHoveredRepo(repo); row leave → setHoveredRepo(null);
//   row click → selectRepo(selected === repo ? null : repo) (toggle).
// - 4s face cycle paused while expanded or while hovering the list.
// - hoveredRepo cleared on collapse and on face switch (cleanup effect).
// - selected row visually distinct (border/bg). Range toggle unchanged.
```

## File ownership matrix (zero overlap — hard rule)

| File | Owner | Action |
|---|---|---|
| `components/scene/layout.ts` | WS-0a | modify (repo-mode, sessions retention, resolveFocus, sessionRow, COUCH_SPOTLIGHT_SEAT) |
| `tests/layout.test.ts` | WS-0a | modify (drop per-session cases; add new) |
| `lib/selection-store.ts` | WS-0b | create |
| `tests/selection-store.test.ts` | WS-0b | create |
| `components/scene/krabs/KrazyKrab.tsx` | WS-0c | modify (idle prop) |
| `components/scene/krabs/AmbientCouchKrabs.tsx` | WS-0c | create |
| `components/scene/environments/warehouse/index.tsx` | WS-0c | modify (swap KrabGeneration → AmbientCouchKrabs) |
| `components/scene/krabs/generator.tsx` | WS-0c | delete if unreferenced after the swap (verify with grep) |
| `components/scene/Scene.tsx` | WS-1a | modify (CameraControls, focus plumbing, couch krab) |
| `components/scene/SessionKrab.tsx` | WS-1a | modify (focused/highlighted/sessions) |
| `components/StatCard.tsx` | WS-1b | modify (repo list expansion) |
| `app/page.tsx` | WS-2 | modify (remove RepoCarousel import) |
| `components/RepoCarousel.tsx` | WS-2 | delete |
| `portfolio-plan.md`, `WATCHDOG.md`, `tasks/lessons.md`, this plan | WS-2 | modify (docs) |

`lib/types.ts` is READ-ONLY for all workstreams (`SessionEntry` etc. unchanged).

## Workstream specs

### WS-0a — layout foundation (Wave 0)

**User story:** as the scene consumer, I need repo aggregation at every range
with the session list retained, a deterministic focus resolver, and the couch
seat constant, so the scene and card can render focus without re-deriving it.

**Acceptance criteria:**
1. `buildKrabLayout` returns `mode: 'repos'` for 7d/30d/90d/1y/all; `'sessions'`
   mode is gone from the type and the branch is deleted.
2. `RepoAggregate.sessions` contains exactly the repo's window sessions,
   newest-first (startTs desc, tie-break harness:sessionId); all sums match
   the old behavior (existing tests still pass where applicable).
3. `resolveFocus` returns desk / couch / null for in-list, out-of-list,
   and null-or-unknown selections.
4. `sessionRow` output matches the spec (LOC clause, PR suffix, title suffix,
   no-commit case).
5. `COUCH_SPOTLIGHT_SEAT` exported as `[-4.2, 0.54, 5.25]`.
6. Dead exports removed (`tooltipBody`, `byMagnitudeDesc`); no dangling
   references anywhere (grep).

**DoD:** acceptance criteria above, `tests/layout.test.ts` green,
`npm run typecheck` + `npm run lint` green, no new deps, plan contract
section unchanged.

### WS-0b — selection store (Wave 0)

**User story:** as the scene and the stat card, I need shared selection state
(selected + hovered repo) with the same pub/sub reliability as range-store.

**Acceptance criteria:**
1. `useSelection` returns `{ selectedRepo, hoveredRepo }`; updates notify
   subscribers exactly once per change; no-op setters don't notify.
2. `selectRepo`, `setHoveredRepo`, `clearSelection`, `getSelection`,
   `subscribeSelection` behave per contract; `clearSelection` resets both.
3. Mirror of the snapshot-store test pattern (subscribe → mutate → notified;
   unsubscribe stops notifications).

**DoD:** acceptance criteria above, `tests/selection-store.test.ts` green,
typecheck + lint green, no new deps.

### WS-0c — ambient couch krabs (Wave 0)

**User story:** as a visitor, I want a few idle krabs on the lounge couch
instead of fifteen wanderers clipping through desks, so the scene reads alive
without breaking the diorama.

**Acceptance criteria:**
1. Exactly 2 ambient krabs, idle, perched on couch 2 facing +x; none on
   couch 1 (spotlight), none on the desk row, none moving horizontally.
2. `KrazyKrab` with `idle: true` skips path-following but keeps leg wiggle +
   claw snap + gentle bob; `idle: false` behavior byte-identical to today
   (existing path tests/render unaffected).
3. `WarehouseEnvironment` renders `<AmbientCouchKrabs />`; no
   `KrabGeneration count={15}` anywhere.
4. `generator.tsx` deleted if grep shows zero remaining importers.
5. Krabs use `generateTraits(seed)` variety (palette/shell/scale ×0.65).

**DoD:** acceptance criteria above, typecheck + lint green, visual check
deferred to Wave 2 (clipping must be impossible by construction: no
horizontal movement), no new deps.

### WS-1a — scene camera + focus (Wave 1)

**User story:** as a visitor, I can pan/zoom/rotate the warehouse, and
selecting a repo from the card flies me to its krab — desk krab or couch
spotlight — with a highlight ring and a session panel above it; deselecting
returns me home.

**Acceptance criteria:**
1. drei `<CameraControls>` inside Canvas: pan/zoom/rotate enabled; polar
   clamped (min ≈ 0.4 rad, max ≈ 1.35 rad); `minZoom` 15 / `maxZoom` 90;
   boundary `Box3` generously around the room; `smoothTime` ≈ 0.6 for fly-to;
   `dampingFactor` ≈ 0.08 for inertia. `onCreated` lookAt removed;
   `target={WAREHOUSE_CONFIG.orbitTarget}`; initial view static at home
   (no mount-time animation; guard the focus effect's first run).
2. Desk focus (C4): selection of a top-16 repo → `fitToBox` on a Box3 around
   the seat (size ≈ [2.5, 2, 2.5] with padding), ring + session panel on that
   krab; hover tooltip suppressed while focused.
3. Couch focus (C5): selection of an out-of-list repo → krab rendered at
   `COUCH_SPOTLIGHT_SEAT`, `rotation.y = -Math.PI/2`, harness/scale from the
   aggregate, `focused` + sessions; camera flies there; no desk krab changes.
4. Deselect/home (C6): selection cleared → ring/panel clear, couch krab
   unmounts, `setLookAt` home `[12,12,12]→[0,1,0]` AND `camera.zoom` reset to
   35 with `updateProjectionMatrix()` (fitToBox changes zoom; home must undo).
5. Range change (C7): effect on `useRange()` calls `clearSelection()`.
6. Card hover (C8): `hoveredRepo` → `highlighted` ring on the matching desk or
   couch krab (no camera move).
7. `SessionKrab` implements focused/highlighted/sessions per contract;
   ring pulse, panel ≤8 rows + "+N more", pointer-events-none.

**DoD:** acceptance criteria above, no typecheck errors in owned files,
no new deps, browser behaviors verified by WS-2 (this agent may not be able
to run the full suite alone — see wave rules).

### WS-1b — stat card repo list (Wave 1)

**User story:** as a visitor, I can expand the PRs face of the stat card into
a scrollable, magnitude-ordered repo list for the active range, hover rows to
highlight their krabs, and click rows to fly to them.

**Acceptance criteria:**
1. PRs face has a "more details" affordance; expanded panel renders below the
   card (respects `max-w`/viewport, scrollable if long).
2. List = `aggregateReposByRepo(filterWindow(...))` for the ACTIVE range via
   `useSnapshot` + `useRange` — visible at all ranges incl. 7d; empty → no
   list; shows repo name, sessions/msgs, LOC, harness dots (HARNESS_COLORS).
3. Row hover → `setHoveredRepo`; leave → null; click → toggle `selectRepo`;
   selected row styled; second click deselects.
4. 4s face cycle paused while expanded or hovering the list; `hoveredRepo`
   cleared on collapse and face switch (cleanup effect).
5. Range toggle still filters the list (existing behavior); does NOT itself
   call `clearSelection` (WS-1a owns C7).

**DoD:** acceptance criteria above, no typecheck errors in owned files, no new
deps, browser behaviors verified by WS-2.

### WS-2 — integration + verification (orchestrator)

**User story:** as the owner, I get one clean merged result: RepoCarousel gone,
full suite green, the scene behaves per contracts C1-C10 in a real browser,
and docs reflect the new model.

**Checklist:**
- [ ] `components/RepoCarousel.tsx` deleted; `app/page.tsx` import removed.
- [ ] `npm test` (all suites incl. new layout/selection tests) green.
- [ ] `npm run typecheck`, `npm run lint` green.
- [ ] `npm run build` static export succeeds.
- [ ] Browser pass (dev server): C1 pan/zoom/rotate + bounds; C2 repo mode at
      7d (no per-session krabs); C4 desk focus fly+ring+panel; C5 couch
      spotlight; C6 deselect home+zoom; C8 card hover highlight; C10 exactly
      2 idle couch krabs, no clipping; "all" range overflow selection.
- [ ] Docs: `portfolio-plan.md` (scene/control-surface sections), `WATCHDOG.md`
      (krab ownership), this plan's review section; `lessons.md` only if a
      correction surfaces.
- [ ] All plan DoD items marked with evidence; assumption log triaged.

## Behavioral contracts (mapped to workstreams)

| # | Contract | Owner |
|---|---|---|
| C1 | Explore: drag pans, wheel/pinch zooms (15-90), rotate on with polar clamps, pan bounded | WS-1a |
| C2 | Repo aggregation at every range (repos mode only) | WS-0a |
| C3 | Aggregate retains sessions, newest-first, sums correct | WS-0a |
| C4 | Desk focus: fly + ring + panel for top-16 selection | WS-1a |
| C5 | Couch spotlight: krab at couch, fly + ring + panel for out-of-list | WS-1a |
| C6 | Deselect: ring/panel/couch krab clear, camera home + zoom reset | WS-1a |
| C7 | Range change clears selection | WS-1a |
| C8 | Card hover highlights krab + tooltip, no camera move | WS-1a (render) + WS-1b (emit) |
| C9 | Card list: expandable, magnitude-ordered, active range, cycle paused | WS-1b |
| C10 | Ambient: ≤3 idle krabs, couch 2 only, no clipping by construction | WS-0c |

## Edge case inventory (mapped)

- Snapshot loading / failed fetch / empty window → empty scene + empty list,
  no selection (existing empty-state preserved) — WS-0a, WS-1b.
- Range = `all` (48 repos): top-16 desks + overflow; couch spotlight serves
  any out-of-list selection — WS-0a (layout), WS-1a (render).
- Repo with zero sessions after range change → selection cleared (C7), cannot
  be selected (not in list) — WS-1a, WS-1b.
- Panel overflow (100+ sessions in a repo) → ≤8 rows + "+N more", no internal
  scroll — WS-1a.
- Selection during mid-drag → camera-controls replaces the in-flight tween;
  no stuck camera — WS-1a (verify in WS-2).
- Drag starting on a krab pans, does not select — WS-1a (threshold), WS-2 verify.
- Focused krab hover → tooltip suppressed while panel shows — WS-1a.
- Mobile/touch: one-finger pan, pinch zoom (camera-controls default); card
  expand + row tap — WS-1a/WS-1b, WS-2 verify.
- Ambient vs spotlight never share couch 2/1; ambient never on desks — WS-0c.
- Camera zoom state after focus → home restore resets zoom to 35 — WS-1a.

## Definition of Done (project, verified by WS-2)

- [x] WS-0a/0b/0c acceptance criteria met and merged green.
- [x] WS-1a/1b acceptance criteria met and merged; C1-C10 satisfied.
- [x] RepoCarousel removed; page.tsx clean.
- [x] `npm test` (58/58), `npm run typecheck`, `npm run lint`, `npm run build`
      green on the merged tree.
- [x] Browser pass — human-verified end-to-end by the owner (camera explore,
      card-driven focus, spotlight, ambient krabs); automated browser pass
      deferred — the owner signed off visually and requested the branch be
      closed as v1.
- [x] Docs updated (portfolio-plan.md, WATCHDOG.md, this review); assumption
      log triaged below.
- [x] No new npm dependencies (CameraControls ships inside drei 10.7.8).

## Review section

All workstreams landed. Evidence per workstream: ws-0a layout tests green
(verified by orchestrator: 29/29), ws-0b selection-store tests green (5/5),
ws-0c krab-walk tests green (5/5), ws-1a/ws-1b typecheck+lint clean on owned
files; post-merge full suite 58/58, typecheck/lint/build all exit 0. All
acceptance criteria were independently verified by reading the merged files,
not by trusting agent self-reports.

### Assumption log triage

1. Rotation enabled with polar clamps — **one-off**; user explicitly
   confirmed ("have rotation would be fine"). Clamps keep the diorama
   legible.
2. Selection clears on range change — **one-off**; deterministic and
   implemented in Scene (C7). Note: ws-1a had to guard the mount-time run so
   the initial view is static at home.
3. Ambient count = 2 on couch 2 — **one-off**; WATCHDOG notes the 15-walker
   baseline (~420 meshes) is gone.
4. Card hover = highlight only; click = fly — **one-off**; user-specified
   interaction, implemented as hoveredRepo vs selectedRepo.
5. RepoCarousel removal — **one-off**; user confirmed ("sure sounds good").
6. fitToBox size/zoom bounds tunable — **one-off**; ws-1a notes the levers
   (maxZoom, FOCUS_BOX_SIZE/PADDING) for a future tuning pass.

### Contract corrections (this cycle's process signal)

- The plan's `RepoAggregate` contract listed `sessions: number` AND
  `sessions: SessionEntry[]` — a duplicate key that cannot compile. ws-0a
  escalated; orchestrator confirmed `sessions` is the retained list (count
  via `.length`). **Specification gap:** interface contracts must be written
  with a single definition per field — added to lessons.md.
- The ownership matrix cited `lib/layout.ts`; the module is
  `components/scene/layout.ts`. **One-off:** verify every path in a contract
  against the tree before locking it (grep).
- Mid-session data-shape drift (user commits: snapshot split into per-range
  `/data/{range}.json` with lazy `ensureRangeSessions`; `snapshot.sessions`
  is 7d-only). Both Wave 1 agents independently caught this and adapted;
  WATCHDOG now documents it. **Lesson:** re-verify the data layer after
  interruptions/user commits, not just at plan time.

## Negative Space

What must not change:

- Data pipeline + snapshot schema (sessions retention is client-side only).
- StatCard's other three faces and metrics; the range toggle.
- The isometric cutaway aesthetic, glass styling, post-processing.
- The R3F stack (no game-engine migration; settled).
- `lib/types.ts` (read-only this cycle).
- Scene stays `'use client'` + `dynamic(..., { ssr: false })`.

What is explicitly out of scope:

- Recency ordering (rejected), per-session krabs at any range, krab
  "take-over" displacement (superseded by spotlight), physics/collision layer
  (unneeded once ambient krabs are stationary), DuckDB work (future analysis).

## Assumptions (triaged in review)

1. Rotation enabled with polar clamps (user confirmed rotation is fine; clamps
   prevent floor-through/overhead views).
2. Selection clears on range change (deterministic).
3. Ambient count = 2 on couch 2 (tunable).
4. Card hover = highlight only; click = fly (user-specified interaction).
5. RepoCarousel removal (user confirmed).
6. `fitToBox` box size and zoom bounds are tunable constants; WS-2 browser
   pass may adjust them.

## Open Questions

- None blocking. Contract deviations (if any surface during execution) are
  escalated to the orchestrator, not fixed locally.
