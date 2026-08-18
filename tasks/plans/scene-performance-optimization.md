# Scene performance optimization

Date: 2026-08-18

## Intent

Eliminate the visible krab jitter in the hero scene and cut per-frame GPU cost
so the scene holds 60fps on retina laptops. Root causes (from the 2026-08-18
review, grounded in source): a 4096x4096 directional shadow map on a 12x12
room, hundreds of un-instanced `<Voxel>` meshes (each a draw call and a shadow
caster), four EffectComposer passes at up to 2x DPR, and animation that uses
unclamped `delta` with a hard pause/resume that freezes legs mid-swing and pops
the phase on resume.

Coordination: a separate plan is cutting the ambient walking krabs to a few and
keeping only the data krabs. This plan does NOT do that cut; it assumes it and
scopes around it (see Negative Space).

## Context Package

### Relevant existing code

- `components/scene/Scene.tsx` — Canvas (ortho, static camera, `shadows`,
  `gl={{ antialias: true }}`, no `dpr` prop; R3F v9 default caps at 2x).
- `components/scene/environments/warehouse/Daylight.tsx` — directional light
  `castShadow` with `shadow-mapSize-width/height={4096}` (lines 203-204),
  frustum +/-10, far 30; `gl.shadowMap.needsUpdate` on hour change.
- `components/scene/environments/warehouse/Furniture.tsx` — `HotDesks` (~74
  `<Voxel>` meshes), `DeskChairs` (16 chairs x 5 = 80 meshes), all individual
  meshes; speaker drivers already share geometries (module-level).
- `components/scene/environments/warehouse/WallInstances.tsx` — the existing
  `InstancedMesh` pattern to mirror (`WallLayer`, instance data arrays).
- `components/scene/Voxel.tsx` — module-level geometry/material caches
  (memory dedup only; draw calls untouched); `castShadow` defaults `true`.
- `components/scene/krabs/KrazyKrab.tsx` — path-following in `useFrame`:
  `s.progress += delta / (segLen / speed)` (unclamped), pause guard
  `if (s.pausing > 0) { s.pausing -= delta; return }` (freezes legs mid-swing,
  `s.time` keeps advancing so `Math.sin(s.time * legRate)` pops on resume).
- `components/scene/krabs/traits.ts` — temperament pool: pauses 0.15-2.5s at
  every waypoint (lazy krabs are stopped >50% of the time).
- `components/scene/environments/warehouse/index.tsx` — EffectComposer:
  Noise + Scanline + ChromaticAberration + Vignette (4 full-screen passes).
- `components/scene/environments/warehouse/SunRays.tsx` — unmounted dead code
  (SunMeshProvider/SunGodRays), still imports removed GodRays.
- `tasks/plans/frontend-iteration-*.md`, `tests/layout.test.ts` — pure
  derivation + unit-test convention this plan follows.

### Architectural constraints

- TypeScript strict, `'use client'` scene components, `next/dynamic ssr:false`.
- No new npm dependencies (drei already present; `<Stats>` is from drei).
- Static ortho camera; scene grain driven by `layout.ts` (pure, tested).
- Post stack stays (it's the visual identity) — tune it, don't remove it.

### Prior decisions

- Stack is final: R3F v9 + three r185 (docs/3d-scene-tech-review.md). No
  engine change. WebGPU is a future optimization, not this fix.
- GodRays already removed (index.tsx comment). SunRays.tsx is leftover.
- Ambient krab reduction is owned by another plan.

### Anti-patterns to avoid

- Touching `Voxel.tsx`'s `castShadow` default: changes every voxel's behavior
  globally and couples workstreams. Shadow-caster policy is decided per
  instanced mesh group instead.
- Two workstreams editing the same file (disjoint ownership below).
- Re-implementing the scene imperatively in three.js.
- Removing post effects "because they're slow" — tune, don't delete.

## Parallel workstreams

Five workstreams, disjoint file ownership, independently verifiable, mergeable
in any order. A shared dev-only `<Stats>` (WS-1) gives every workstream and the
reviewer the same FPS / draw-call readout.

### WS-1 — Render target & post config (Scene.tsx only)

- [ ] Canvas `dpr={[1, 1.5]}` (cuts post fill ~half on retina vs 2x cap).
- [ ] Drop `gl={{ antialias: true }}` — redundant under EffectComposer, which
      does its own multisampled compositing.
- [ ] Dev-only drei `<Stats showPanel={0}/>` (render info) gated by
      `NODE_ENV === 'development'`, for shared measurement.
- [ ] Keep `frameloop="always"` (remaining krabs animate). `frameloop="demand"`
      stays a noted future option only if the ambient cut becomes total.
- Verify: `next dev` shows FPS/draw-call panel; DOM overlays unaffected.

### WS-2 — Shadow map tuning (Daylight.tsx only)

- [ ] `shadow-mapSize-width/height` 4096 -> 2048 (drop to 1024 only if
      shadows stay clean at ortho zoom 35; 2048 is the default target).
- [ ] Tighten shadow camera frustum +/-10 -> ~+/-7 (room is 12x12, casters to
      +/-5.95; verify the shadow-only roof/front-wall blockers stay covered).
- [ ] Keep `gl.shadowMap.needsUpdate` hour-change effect.
- Verify: no new shadow acne / peter-panning; shadows visibly intact on
  floor/desks/krabs; `renderer.info` shadow pass cost drops.

### WS-3 — Furniture instancing (Furniture.tsx only)

- [ ] `DeskChairs` (80 meshes) -> one `InstancedMesh` per color group,
      mirroring `WallLayer` in WallInstances.tsx (module-level instance data
      arrays; reuse the Voxel material cache's materials).
- [ ] `HotDesks` (~74 meshes) -> instanced (desk tops, legs, laptops, cups by
      color group; laptops/cups already use small color palettes).
- [ ] Per-group `castShadow` policy decided locally (desks keep casting; small
      items like cups/monitors cast=false) — visual check, no global default
      change.
- [ ] Optional extension (not in core DoD): `SupportBeams` pillars in
      Room.tsx, same pattern, same agent, later if budget allows.
- Verify: scene visually near-identical (screenshot diff); draw calls for
  desks+chairs collapse from ~154 meshes to single-digit instanced draws.

### WS-4 — Krab animation correctness (KrazyKrab.tsx + new pure module + test)

- [ ] Extract the walk step out of `useFrame` into a pure function in a new
      `components/scene/krabs/walk.ts` (repo convention: layout.ts is pure and
      unit-tested), taking `(state, path, pathLengths, dt, speed, pause, ...)`.
- [ ] Clamp `dt` to ~0.05s so a dropped frame never teleports the krab.
- [ ] Fix the pause: legs/claws ease to rest during pause (no mid-swing
      freeze), and the leg/claw phase must not jump on resume (`s.time` gated
      or phase continued from the frozen pose).
- [ ] New `tests/krab-walk.test.ts`: large-`dt` step stays within one step
      bound (no teleport); pause produces no phase discontinuity above a
      threshold; determinism for a fixed seed.
- Verify: `npm test` green; in `next dev`, a krab pause is a smooth stop/start,
      no pop, no teleport even under artificial frame drops (devtools CPU
      throttle).

### WS-5 — Dead code cleanup (delete SunRays.tsx)

- [ ] Delete `components/scene/environments/warehouse/SunRays.tsx` (unmounted;
      imports removed GodRays). Typecheck + build confirm no references.
- Do NOT touch `ChairKrab.tsx` / `classics.tsx` — those are ambient-krab files
  owned by the ambient-cut plan (avoid double-deletion).

## Measurement

- Baseline before any merge (one dev run): `renderer.info.render.calls`,
  triangles, and FPS with `<Stats>` visible. Expected baseline is hundreds of
  draw calls (furniture/windows/krabs un-instanced) [INFERENCE — not yet
  measured; record the real number in the review section].
- Post-merge target: draw calls in the tens (not hundreds); steady 60fps on
  the dev machine's retina-class display with the post stack intact.

## Edge Case Inventory

- Retina (dpr 2) vs 1x displays — dpr 1.5 cap must not visibly soften the
  scene on 1x/2x (verify both via devtools device emulation).
- Hour change (once/minute) — `gl.shadowMap.needsUpdate` still correct with the
  smaller map; no flicker.
- Dropped frame / tab throttling — krab step clamped, no teleport.
- Empty data window (`mode: 'empty'`) — scene still renders, `<Stats>` panel
  doesn't break the empty state.
- Range switch 7d <-> 30d — SessionKrab count changes (16 vs <=16), layout
  derivation untouched by all workstreams.
- Low-power / weak iGPU (Intel Iris Xe here) — the primary target for WS-1/2.

## Definition of Done

- [ ] All five workstreams' checkable items complete, files merged (disjoint
      ownership verified — no file touched by two workstreams).
- [ ] `npm test` — existing + new `krab-walk.test.ts` green.
- [ ] `npm run typecheck` and `npm run lint` — zero warnings.
- [ ] `npm run build` static export — exit 0.
- [ ] Browser pass on `next dev`: shadows intact and clean, krab pauses are
      smooth stops with no pop/teleport, scene visually near-identical,
      draw calls in the tens, steady 60fps on the dev machine.
- [ ] Baseline and post numbers (draw calls, FPS) recorded in the review
      section; WATCHDOG.md + tasks/lessons.md updated with any findings.

## Negative Space

- NOT doing the ambient-krab cut (owned by another plan). WS-4 only fixes the
  animation of the krabs that remain; it does not reduce `KrabGeneration
  count={15}` or delete classics/ChairKrab.
- NOT changing the tech stack (no engine/version changes).
- NOT removing post effects — only capping resolution (dpr) they render at.
- NOT flipping `Voxel`'s `castShadow` default (global behavioral change;
  shadow policy handled per instanced group in WS-3).
- `frameloop="demand"` + `invalidate` — deferred, contingent on the ambient cut
  becoming total; not in this plan's DoD.

## Open Questions

None. Assumptions (decided with defaults, tunable at review): dpr cap 1.5;
shadow map 2048 (1024 fallback if clean); desks keep castShadow, small items
don't; chairs keep casting unless visual check says otherwise.

## Review section

(To be filled post-implementation: baseline vs post numbers, assumption
triage, lessons.)
