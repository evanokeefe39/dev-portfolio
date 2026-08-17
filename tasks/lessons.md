# Lessons

Session-level patterns to review before starting work. Append after any
correction; reference the specific failure mode and the rule that prevents it.

## 2026-08-17 — repo init and 3D review

- **Pattern:** the plan doc described the 3D scene as a "vibe-coded Vite
  project" needing a "significant rewrite" to port into Next.js (Option B).
  The actual scene is already React Three Fiber v8 with clean environment
  components and config objects — a port, not a rewrite.
- **Rule:** before costing an integration, read the actual source. The plan's
  iframe "recommendation" was based on a wrong cost assumption. The real driver
  is the React 18→19 / R3F v8→v9 version gap, not the framework choice.
- **Action:** corrected `portfolio-plan.md`; added `docs/3d-scene-tech-review.md`.
