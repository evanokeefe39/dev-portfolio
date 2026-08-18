# 3D scene tech stack review

Status of the hero scene in `~/repos/3d-scene-test` and the options for bringing
it into `dev-portfolio`. Written 2026-08-17.

## Current state (grounded in source)

`3d-scene-test` is **not** a "vibe-coded Vite project that needs rewriting." It
is already a React Three Fiber application with clean boundaries:

| Aspect | Actual |
|--------|--------|
| Framework | Vite 6 |
| React | 18.3 |
| 3D renderer | `@react-three/fiber` 8.17 (`three` 0.170) |
| Helpers | `@react-three/drei` 9.117 |
| Post FX | `@react-three/postprocessing` 2.16 + `postprocessing` 6.36 |
| Size | ~5,000 LOC across 24 files |

Structure:

- `components/` — reusable primitives. `Voxel` (box geometry + Lambert material,
  module-level geometry/material caches), `Person`, `Furniture`, `Decor`,
  `FiddleLeafFig`, `Room`.
- `environments/cozy-office/` and `environments/warehouse/` — each exports an
  `<Environment>` component plus an `<ENV>_CONFIG` object (`background`, `camera`,
  `orbitTarget`). `App.tsx` switches between them by key.
- `krabs/` — procedural "AI agent" characters: trait pools + `mulberry32` seeded
  PRNG, 17 shell designs, generated + hand-crafted instances, path-following
  animation (`useFrame`), a chair-hopping variant.

Two facts drive every decision below:

1. The scene is **already declarative R3F with clean env boundaries** — the
   component port into Next.js is mechanical, not a rewrite.
2. The scene is on **React 18 / R3F v8**. Current Next.js App Router (15+) is
   **React 19**, and R3F v8 pairs with React 18 only (`@react-three/fiber@8` →
   `react@18`, `@react-three/fiber@9` → `react@19`). This version gap is the
   real rework cost, not the framework choice.

## Options

### Option A — iframe embed (plan's current "recommended")

Keep `3d-scene-test` as a separate Vite build, embed full-viewport in Next.js,
position the glass overlays as DOM on top.

- **Transferability:** near 100%. Zero scene code change.
- **Rework:** near zero for the scene. New cost: `postMessage` bridge for the
  session-data labels, a second build + deploy, two React runtimes in one page.
- **Weaknesses:** 3D-anchored labels require projecting screen-space coords over
  the iframe boundary; no shared theme/state; a11y/SEO for the scene is worse;
  iframe pays a second compositor cost.

Verdict: fastest path to a working hero, and a valid v1. It is a bridge, not a
destination, if we want data labels anchored in 3D.

### Option B — R3F port into Next.js (corrected: this is a port, not a rewrite)

Import the environment components into the Next app as client components.

- **Transferability:** high. The `environments/*` + `components/*` + `krabs/*`
  modules move essentially verbatim; `App.tsx`'s canvas + controls get re-hosted
  in a client component.
- **Rework:** the real cost is a dependency upgrade, not code:
  - `@react-three/fiber` 8 → 9 (React 19)
  - `@react-three/drei` 9 → 10
  - `@react-three/postprocessing` 2 → 3 (React 19-compatible)
  - wrap in `'use client'` and load via `dynamic(..., { ssr: false })`
  - update any three r170-specific API if the v9 upgrade pins a newer `three`
- **Effort estimate:** ~1–2 days. Dependency upgrade + import/type fixes are the
  bulk; the component bodies are unchanged.
- **Payoff:** single build; `<Html>` from drei for true 3D-anchored labels;
  shared state with the overlay UI; one React runtime.

Verdict: the strong default for the real product. The plan's "significant
rewrite effort" note is wrong and should be corrected.

### Option B2 — pin Next.js 14 (React 18)

Keeps R3F v8 and the scene untouched, but stays on an older Next major in
maintenance. Not future-proof; only worth it as a stopgap. Not recommended.

### Option C — three.js WebGPURenderer

Swap the backend while keeping the declarative R3F layer. WebGPU is
production-ready in 2026 in recent Chrome/Edge with Safari/Firefox catching up,
and three's WebGPURenderer falls back to WebGL2. Real upside for heavy scenes.

- **Relevance here:** the scene is low-poly voxel with Lambert materials and a
  light post stack — WebGPU's throughput headroom is mostly unused. The
  post-processing stack is being reworked around node materials, so
  `@react-three/postprocessing` parity is the main risk.
- **Verdict:** a future optimization, not a reason to switch now. Revisit after
  Option B is live.

### Option D — Babylon.js

Full-featured engine, excellent for large scene graphs, PBR, glTF, and rigged
animation. But this scene is box geometry + Lambert voxels — Babylon's PBR-first
pipeline buys nothing and a full rewrite (~5,000 LOC) is the cost.

- **Transferability:** poor. Only the layout/coordinates survive as reference.
- **Verdict:** not worth it for a voxel aesthetic.

### Option E — Spline / PlayCanvas / no-code

Good for static or lightly-animated mockups, but the procedural krabs, seeded
generation, and weekly data-driven labels cannot be expressed. Dead end for a
data-driven scene.

### Option F — drop R3F for imperative three.js

Re-rewriting declarative R3F as imperative three.js loses React ergonomics and
the env/config pattern for no benefit. Regression. Not considered.

## Animation

Current animation is state-driven, not skeletal: krab path-following via
`useFrame`, `Person` limb swing, and `OrbitControls` for the camera. For the
portfolio's "agents at desks replaying session data," this is the right weight.

If richer motion is wanted later, R3F supports it without a stack change:

- `<Float>` / `<PresentationControls>` from drei for a hero feel.
- GLTF rigged models + three's animation mixer for skeletal animation.
- Frame tweens via `useFrame` + a small tween helper.

No engine change is required for any of these.

## Recommendation

1. **Short term** (fastest to ship): Option A iframe, accepting the postMessage
   bridge and dual build.
2. **Target**: Option B — the R3F v9 port. It is a dependency upgrade and a
   mechanical component move, not a rewrite, and it unlocks 3D-anchored data
   labels and a single build.

The plan's iframe recommendation was reached under a wrong cost assumption; the
integration section of `portfolio-plan.md` has been corrected accordingly.
