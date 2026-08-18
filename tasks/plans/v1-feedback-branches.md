# v1 feedback decomposition — branch map for the next session

Date: 2026-08-18. Source: owner feedback on the shipped v1 scene
(PR #1, merged as `6c841f7`).

## Intent

Turn the v1 feedback into independent, worktree-friendly branches so the
next session can pick them up in parallel without merge friction. Each
branch has its own files, acceptance criteria, and PR. No code is written
in this plan — it is the manifest for the next session.

## Feedback inventory (verbatim → branch)

| # | Feedback (verbatim) | Branch |
|---|---|---|
| 1 | "for rotation make it a hotkey like ctrl or alt to drag rotate and then another one to drag zoom so people using mouse can still zoom without trackpad" | A |
| 2 | "the krabs dont move around now... give them random things to do so they walk around and also idle animations" | D |
| 3 | "the hitboxes for hovering seem to be too big, if i hover over one krab i usually get two" | B |
| 4 | "we also dont need 'claude 14' 'pi 2' on the tooltip cards for krabs" | B |
| 5 | "use repo icon and branch icons where appropriate on tooltip cards" | B |
| 6 | "use green and red for LOC +/- changes in the tooltip" | B |
| 7 | "make the layout more structured too e.g. headings, bullet points... all the repo stuff together and all the agent session stuff together on a seperate line" | B |
| 8 | "make the Krabs move around so sometimes they are on the couch, sometimes at their desk, sometimes they go up on the mezzanine" | D |

| 9 | "the krabs seem to have lost their character... change their color based on harness but the other quirky things like different faces and hats and claw size we can bring back" | C |
| 10 | "change their size according to number of assistant messages and LOC change as well" | C |

## Branch map and dependency order

- **A — `feat/scene-camera-modifiers`** — `components/scene/Scene.tsx` only.
  Independent. Wave 1.
- **B — `feat/krab-tooltip-hover-polish`** — `components/scene/SessionKrab.tsx`,
  `components/scene/layout.ts`, `tests/layout.test.ts`, new icon module,
  `components/StatCard.tsx` (optional LOC coloring). Independent. Wave 1.
- **C — `feat/krab-character-traits`** — `components/scene/SessionKrab.tsx`,
  `components/scene/layout.ts` (sessionScale), `tests/layout.test.ts`,
  reuses `krabs/traits.ts` + `krabs/shells.tsx` (read-only).
  Wave 2 — MUST branch after B merges (both touch SessionKrab/layout).
- **D — `feat/krab-behavior-roaming`** — `SessionKrab.tsx`, `KrazyKrab.tsx`,
  `krabs/walk.ts`, new `krabs/behavior.ts` + waypoint data, `AmbientCouchKrabs.tsx`.
  Wave 3 — MUST branch after C merges (all of B/C/D touch `SessionKrab.tsx`).

A and B are file-disjoint (A: Scene.tsx; B: SessionKrab/layout/tests/icons)
so two worktrees can run them in parallel with zero merge conflict. C and D
are sequential because they build on B's and C's SessionKrab changes.

Worktree setup:

```
git worktree add ../dp-camera-modifiers -b feat/scene-camera-modifiers main
git worktree add ../dp-krab-tooltip     -b feat/krab-tooltip-hover-polish main
# Wave 2, after B merges:
git worktree add ../dp-krab-character   -b feat/krab-character-traits main
# Wave 3, after C merges:
git worktree add ../dp-krab-behavior    -b feat/krab-behavior-roaming main
```

Each branch returns via a squash-merge PR (CONTRIBUTING: conventional
commits, ~400-line PRs, CI green).

---

## Branch A — feat/scene-camera-modifiers

### Intent

Mouse users can rotate and zoom without a trackpad: plain drag pans,
a hotkey + drag rotates, another hotkey + drag zooms. Wheel zoom and touch
gestures stay as they are.

### Context

`Scene.tsx` configures drei `<CameraControls>` (lines ~204-223) with
`mouseButtons` left=TRUCK / right=ROTATE / middle=DOLLY / wheel=ZOOM and
touch mappings. camera-controls has NO built-in modifier-key support for
mouse buttons — the mapping must be swapped at runtime from key state.

### Scope

- Track `ctrl`/`alt`/`shift` keydown/keyup (window listeners) in Scene.
- Mapping (recommended, per feedback "ctrl or alt"): plain drag = pan
  (TRUCK); Ctrl OR Alt held + drag = rotate (ROTATE); Shift held + drag =
  zoom (DOLLY, or ZOOM for a direct zoom feel); wheel = ZOOM unchanged;
  touch unchanged. Update `controls.mouseButtons` on modifier change.
- Guard: ignore modifiers while an input/textarea has focus (no such
  inputs on the page today, but the guard is one line).
- Reset mapping on unmount (remove key listeners).

### Acceptance criteria

1. Plain drag pans (unchanged).
2. Ctrl+drag rotates; Alt+drag rotates (either modifier, both accepted).
3. Shift+drag zooms.
4. Wheel still zooms; pinch/one-finger touch behavior unchanged.
5. Modifier state can't get stuck (keyup outside window handled — use
   `window` blur listener or re-read `event.repeat`/`getModifierState`).

### DoD

Typecheck + lint green; manual browser test of 1-5 (mouse + touch);
WATCHDOG note updated if the mapping is non-obvious.

---

## Branch B — feat/krab-tooltip-hover-polish

### Intent

Krab tooltips and the focus panel read as structured cards — repo
information grouped, session information grouped, icons where they help,
LOC colored by sign — and hovering is precise (one krab, not two).

### Context

- `SessionKrab.tsx`: invisible hitbox `boxGeometry [1.1, 1.7, 0.9]` at
  `[0, 0.8, 0]` (lines ~116-119) — inside the scaled group (scale up to
  1.1), it overlaps the neighboring seat (seats are 1.0 apart), hence
  double-hovers.
- `layout.ts` `repoTooltipBody` (lines ~221-232): includes the harness
  line `omp 3 · claude 2 · pi 1` — the "claude 14 / pi 2" the owner wants
  gone from krab tooltips.
- `sessionRow` returns one plain string; the focus panel renders each row
  as a single truncated div (`SessionKrab.tsx` lines ~136-143) — no room
  for colored/structured parts.
- Icons: no icon dependency exists. Use small inline SVG components
  (repo, branch, maybe PR/hash) — no new npm deps.
- Branch data: `SessionEntry.branch` is null in the >7d lazy slices
  (stripped) and present in 7d eager sessions — branch icons only render
  when the field is non-null.

### Scope

- `layout.ts`:
  - Remove the harness line from `repoTooltipBody`.
  - Restructure tooltip/panel content into sections (Repo block, then
    Sessions block). Keep pure + deterministic; update
    `tests/layout.test.ts` accordingly.
  - `sessionRow` (or a new structured helper) must expose the LOC clause
    separately so the panel can color `+added` green / `−removed` red.
- `SessionKrab.tsx`:
  - Shrink the hitbox to the body footprint (e.g. ~`[0.5, 0.8, 0.45]` at
    `[0, 0.5, 0]`; verify at max scale 1.1 that it stays inside the 1.0
    seat pitch).
  - Restructure tooltip + focus panel: header with repo icon + repo name
    (+ harness chip), Repo section (sessions · days · msgs; LOC line with
    green/red; PR refs), Sessions section (per-session rows: day, msgs,
    colored LOC, branch icon + branch name when present, title). Sections
    visually separated (spacing/bullets/dividers).
- New small icon module (e.g. `components/icons.tsx`): `RepoIcon`,
  `BranchIcon` inline SVGs, currentColor.
- `StatCard.tsx` (optional, same branch): apply the same green/red LOC
  coloring to repo card rows for consistency.

### Acceptance criteria

1. No `claude N` / `pi N` harness-count text in any krab tooltip or focus
   panel (harness still appears as a chip/color).
2. Hovering one krab shows exactly one tooltip; hovering between two
   krabs never shows two.
3. LOC deltas render green (+added) / red (−removed) in tooltip, focus
   panel, and (if scoped) card rows.
4. Repo icon in the tooltip/panel header; branch icon beside branch text
   where branch data exists (7d), absent where it doesn't (>7d slices).
5. Panel is grouped: repo metrics together, session rows together, with
   clear separation.
6. No new npm dependencies.

### DoD

`tests/layout.test.ts` updated (harness line removal, section structure,
LOC clause extraction) and green; typecheck + lint; browser hover check
(one-krab hover) and visual check of a tooltip and a focused panel.

---

## Branch C — feat/krab-character-traits

### Intent

Give the data krabs their character back. Harness still decides the color
palette, but each repo's krab is otherwise quirky and individual — shell/
hat, build proportions, claw size — drawn deterministically from the
existing trait system, and krab size reflects BOTH assistant messages and
LOC change, not messages alone.

### Context

- `krabs/traits.ts` has the full character system: `mulberry32` seeded
  PRNG, `generateTraits(seed)` → palette/shell/build/size/temperament,
  plus the 17 shell designs in `krabs/shells.tsx` (spiral, spiky, coral,
  crystal, mushroom, treasure, skull, bonsai, disco, volcano, ice castle,
  beehive, aquarium, ufo, cactus, boombox, globe) and build traits
  (bodyWidth, bodyDepth, clawScale, legLen, eyeStalk).
- `SessionKrab` today ignores all of it: fixed voxel body, only
  `HARNESS_COLORS[harness]` palette + `sessionScale(assistantMessages)`.
- `sessionScale(msgs)` (`layout.ts`) caps at 1.1 and is log-domain, so raw
  LOC deltas (tens–hundreds) barely move it — LOC needs its own weight.
- No new deps; shells are React nodes already in the tree.

### Scope

- `SessionKrab.tsx`: derive a deterministic per-repo seed (string hash of
  the repo name → `mulberry32`), run `generateTraits(seed)`, and render
  the krab with: harness-driven palette (body/dark colors stay
  `HARNESS_COLORS`), the seeded shell (hat), and the seeded build
  proportions (bodyWidth/bodyDepth/clawScale/legLen/eyeStalk — this is the
  "claw size" feedback). Same repo ⇒ same krab on every visit/range.
- **Shell pool decision (owner, 2026-08-18): hold back the loud shells for
  now.** Data krabs draw from a subdued subset only: spiral, spiky, coral,
  crystal, mushroom, bonsai, beehive, cactus, globe. Held back (stay in
  `shells.tsx`, unused by data krabs): treasure, skull, disco, volcano,
  ice castle, aquarium, ufo, boombox. Implement as a `DATA_KRAB_SHELLS`
  subset constant — don't delete anything from the trait pools.
  (subdued pool applies to the seeded shell only; palette stays harness-
  driven, builds stay full-range.)
- "Faces": the existing pools cover shells/hats + build (incl. claws); if
  a distinct face/eye pool is wanted beyond the fixed eye stalks, add a
  small `EYES` pool to `traits.ts` (read-only reuse → extend, don't fork).
- `layout.ts` `sessionScale`: combine messages and LOC — e.g.
  `sessionScale(msgs, locAdded, locRemoved)` with
  `magnitude = assistantMessages + LOC_WEIGHT * (locAdded + locRemoved)`
  (LOC_WEIGHT ~10 so LOC visibly matters; tuning constant, documented).
  `buildKrabLayout` passes `r.locAdded`/`r.locRemoved` for repo krabs.
  Update `tests/layout.test.ts` (scale monotonicity in BOTH inputs; caps).
- The focus panel / tooltip (Branch B's restructure) stays untouched by C
  beyond the scale call — C lands AFTER B, so build on its SessionKrab.

### Acceptance criteria

1. Two repos never render identical krabs (shell/build variety visible);
   the same repo renders the SAME krab across ranges and page loads.
2. Harness still drives color; shells/builds/claw size vary per repo.
3. Scale increases with assistant messages AND with LOC delta (both
   monotonic), still capped ~1.1.
4. No new npm dependencies; shells/traits reused, not duplicated.
5. Ambient krabs (`AmbientCouchKrabs`) unaffected (they already use
   `generateTraits`).

### Risk / notes

- String-hash → seed: add a small deterministic `hashString` (no deps).
- Loud shells (treasure, skull, disco, volcano, ice castle, aquarium, ufo,
  boombox) stay in `shells.tsx` but are EXCLUDED from data krabs via
  `DATA_KRAB_SHELLS` (owner decision 2026-08-18) — do not delete them;
  ambient krabs and future uses may still want the full pool.

### DoD

`tests/layout.test.ts` green (sessionScale combined-input tests);
typecheck + lint; browser visual check (krab variety across the top-16;
same repo stable across reloads).


## Branch D — feat/krab-behavior-roaming

### Intent

Krabs are alive: idle animation at rest, and task-based roaming between
their desk, the lounge couch, and the mezzanine — without reintroducing
the clipping bug the ambient-walker removal fixed.

### Context

- `krabs/walk.ts` is a pure walking state machine (path segments, pause,
  activity easing) already tested in `tests/krab-walk.test.ts` — reuse it.
- `KrazyKrab` has an `idle` branch (leg wiggle + claw snap + bob) that
  `AmbientCouchKrabs` uses — `SessionKrab` has NO animation today (static
  body, ring pulse only).
- The mezzanine has a metal staircase (`Room.tsx` "Metal staircase +
  mezzanine platform") — krabs need elevation waypoints (stairs) to get up.
- No-physics constraint stands: no free pathing. A seeded waypoint graph
  (nodes + edges along clear lanes) keeps clipping impossible by
  construction. No new deps (a waypoint graph beats adding Yuka here).
- `SessionKrab`'s hitbox/panel live inside the krab group, so if the krab
  roams, hover/ring/panel follow it automatically.

### Scope

- New `components/scene/krabs/behavior.ts` (pure): per-krab task scheduler
  — states `AT_ANCHOR` (idle) / `WALK_TO(dest)` / `AT_DEST` (idle) /
  `WALK_HOME`; deterministic (seeded) randomized schedules; a waypoint
  graph: desk seats, couch 1/2 seats, lounge spots, stair nodes (with
  elevation transitions), mezzanine spots; edges along furniture-free
  lanes. Verify stair coordinates in `Room.tsx` before authoring nodes.
- `walk.ts`: support vertical segments (y interpolation) for stairs if it
  doesn't already; keep existing tests green, add stair-segment tests.
- `SessionKrab.tsx`: idle animation (reuse the KrazyKrab idle pattern),
  roaming driven by `behavior.ts`, walk animation via `walk.ts`; anchor =
  `SEAT_POSITIONS[seatIndex]`; the krab always returns to its anchor
  eventually.
- `AmbientCouchKrabs.tsx`: join the scheduler (roam lounge/mezzanine) for
  consistency — or stay idle if that reads better; decide at branch time.
- Focus interaction (design decision, flag in PR): **recall-to-seat** —
  selecting a repo makes its krab walk home to its anchor first, then the
  existing fly-to + ring + panel proceed. Keeps `Scene.tsx` unchanged.
  Alternative: live-position tracking (Scene must know each krab's
  position) — more complex, defer unless recall feels laggy.

### Acceptance criteria

1. Krabs periodically leave their desks: sometimes at the desk, sometimes
   on a couch, sometimes on the mezzanine.
2. Idle animation at rest (wiggle/snap/bob) — no frozen krabs.
3. Zero clipping into desks, couches, walls, or stairs (waypoint-graph
   only; verify visually).
4. Hover/selection still work while roaming (hitbox follows the group).
5. Schedules are deterministic (seeded) so behavior is testable.
6. No new meshes per krab and no new npm dependencies; mesh count does not
   regress (reuse bodies; only `behavior.ts` + waypoint data are new).

### DoD

New tests: schedule determinism, waypoint-graph validity (no edge crosses
furniture bounds — assert against known furniture coordinates), stair
vertical segments. Existing suites green; typecheck + lint; browser roam
check (krabs move, return, no clipping, mezzanine reachable).

### Risk / notes

- Verify the staircase's actual geometry (`Room.tsx`) before defining stair
  waypoints — wrong heights = floating krabs.
- If the branch exceeds ~400 changed lines, split: D1 (idle animation +
  walk.ts vertical support) → D2 (scheduler + waypoints + wiring).
- Keep `clearSelection`/C7 semantics untouched (Scene-side effect stays).

## Negative space (all branches)

- No new npm dependencies (inline SVGs, waypoint graph, camera-controls
  internals).
- No physics engine, no Yuka/navmesh adoption without a fresh decision.
- `lib/types.ts` read-only; snapshot schema unchanged.
- Per-session krabs do not return; repo aggregation at every range stands.
- Touch gestures and wheel zoom keep working on branch A.
