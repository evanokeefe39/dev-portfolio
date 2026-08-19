# WATCHDOG.md

Advisor-only review guidance — project-specific traps and quality bars. Not for
the main executor's daily noise.

## Version trap (highest risk)

- `3d-scene-test` runs React 18 + `@react-three/fiber` v8. Current Next.js
  (App Router, 15+) ships React 19, and R3F v8 pairs with React 18 only.
- Porting the scene into Next.js is **not a rewrite** — it is a dependency
  upgrade (R3F v8→v9, drei v9→v10, `@react-three/postprocessing` v2→v3) plus
  `'use client'` + `dynamic(..., { ssr: false })`.
- Reject any PR that re-implements the scene imperatively in raw three.js
  "to simplify" — it is a regression and drops the declarative env pattern.

## 3D performance

- Done 2026-08-18: desks/chairs instanced (154 meshes -> 8 `InstancedMesh`
  groups in Furniture.tsx — the draw-call hot spots), directional shadow map
  4096 -> 2048 with frustum tightened to +/-7 (Daylight.tsx), Canvas `dpr={1}`
  + `antialias: false` (Scene.tsx), EffectComposer trimmed from 4 passes to
  Noise + Vignette only (ChromaticAberration + Scanline dropped — iGPU
  fill-rate bound at ~15fps), krab walk extracted to pure `krabs/walk.ts`
  (delta clamped to 0.05s, pause eases via an activity factor — no teleport,
  no phase pop). Dev-only drei `<Stats>` panel in Scene.tsx: click it twice to
  cycle to the render panel for draw calls.
- Still to watch: real-GPU fps re-check after the dpr/composer cuts; if still
  < 30fps, next levers are session-krab body instancing (16 krabs x ~20 voxels
  = ~320 meshes), shadow map 1024, and pendant pointLights. The ambient-krab
  cut landed 2026-08-18: 15 random walkers (~420 meshes) replaced by 2 idle
  krabs on lounge couch 2 (`AmbientCouchKrabs`); `generator.tsx` deleted.
- `EffectComposer` lives per-environment; god rays were already removed due to
  WebGL errors (SunRays.tsx deleted 2026-08-18 — do not re-add).

## Data pipeline

- Sources: `~/.omp/agent/sessions/**/*.jsonl` (current harness, PRIMARY), plus
  `~/.claude/projects`, `~/.pi/agent/sessions`, `~/.codex/sessions`, and
  `git log --numstat`. If 7d/30d tokens read zero, suspect a MISSING SOURCE,
  not "no data" — verify the source globs before accepting a snapshot.
- OMP JSONL has two layouts (usage/model top-level vs nested under `message`);
  the silver template must COALESCE both. OMP cost comes from `usage.cost.total`
  directly — never LiteLLM-price OMP rows.
- `public/data/` is generated. Never hand-edit; the snapshot script is the only
  writer. Keep every history file.

## Git hygiene

- Linear history, squash-merge only, no direct pushes to `main`. Conventional
  commits. Reject merge commits and bare `WIP`/`fixed the bug` messages.

## Frontend data + scene labels

- Snapshot reads must go through `lib/snapshot-store.ts` (`useSnapshot`) — a
  second direct `loadSnapshot()` duplicates the snapshot fetch+normalize per
  mount (hit once: StatCard and Scene fetched independently, causing the
  stat-card lag). The store fetches `/data/7d.json` eagerly and the per-range
  slices on demand; reject any direct fetch of a `/data/*.json` file.
- drei `<Html>`'s outer positioning div does NOT inherit the `pointerEvents`
  prop — without `wrapperClass="pointer-events-none"` each invisible tooltip
  leaves a hit-testable box over the scene that swallows canvas pointer events
  (hover-gating silently broke; caught in browser verification). Every `<Html>`
  label in the scene needs the wrapperClass.
- Krab labels are hover-gated on purpose; always-visible `<Html>` pills regress
  the scene (krabs invisible behind them). The invisible hitbox must stay tall
  enough to cover the pill region or hover flickers on/off.
- `buildKrabLayout` aggregates by repo at EVERY range (`mode: 'repos'`) — the
  per-session 7d mode was removed 2026-08-18. Top-16 repos by magnitude fill
  the desk seats; overflow repos render on the couch spotlight when selected.
  The derivation is pure and unit-tested (tests/layout.test.ts) — keep it so.

## 3D scene — camera and selection (2026-08-18)

- Camera: drei `<CameraControls>` (camera-controls ships inside drei — never
  add it as a direct dependency). Keep zoom within 15-90, the room pan
  boundary (ROOM_BOUNDARY in Scene.tsx), and the polar clamps 0.4-1.35; do NOT
  re-add the `onCreated` lookAt.
- Camera modifiers: plain drag pans, Ctrl/Alt+drag rotates, Shift+drag zooms
  — MOUSE_BUTTONS_* are module-level constants in Scene.tsx swapped on the
  live instance from key state; NEVER pass an inline literal (R3F re-applies
  a prop only when its reference changes). Shift maps left to ZOOM, not
  DOLLY: dolly only moves the ortho camera along its view axis (invisible).
- Selection: state lives in `lib/selection-store.ts` (selectedRepo +
  hoveredRepo, mirrors range-store). A range change MUST clear selection —
  Scene owns the `useEffect(() => clearSelection(), [range])`; reject code
  that clears selection from StatCard (double-clearing is a symptom of drift).
- RepoCarousel is GONE (2026-08-18). The stat card's PRs face repo list (all
  ranges) is the single repo control surface; reject PRs that resurrect a
  second repo list.
- Data: `snapshot.sessions` is the 7d window only; longer ranges load lazily
  via `ensureRangeSessions` (`/data/{range}.json`). NEVER derive a non-7d repo
  list from `snapshot.sessions` — it silently shows last week's repos
  (caught in review; both Scene and StatCard use the rangeSessions slice).
