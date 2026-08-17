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

- Scene is voxel-style (Lambert materials, box geometry). Watch draw calls:
  `InstancedMesh` for repeated desks/chairs/pillars, `mergeGeometries` for static
  geometry, power-of-two compressed textures. Profile with `renderer.info`.
- `EffectComposer` lives per-environment; verify it still works after the R3F v9
  + postprocessing v3 upgrade (god rays were already removed due to WebGL errors).

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
