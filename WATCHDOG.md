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
  = ~320 meshes), shadow map 1024, pendant pointLights, and the ambient-krab
  cut (15 walkers = ~420 meshes, owned by another plan).
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
- `buildKrabLayout` renders per-session only at 7d; 30d/90d/1y/all aggregate by
  repo (`mode: 'repos'`). Both modes are covered in tests/layout.test.ts — keep
  it that way; the derivation is pure and unit-tested.
