# Plan: Repository initialization and 3D scene tech review

## Intent

Turn the empty `dev-portfolio` repo into a professional, harness-ready codebase
(CI, release/PR/issue templates, linear-history conventions, AGENTS.md) and
produce a grounded review of the 3D scene tech stack in `~/repos/3d-scene-test`,
including transferability and rework effort per candidate stack.

## Scope

- Initialize git (branch `main`) and commit infra files with a clean linear history.
- Add GitHub Actions CI, release note template, PR template, issue forms, dependabot.
- Add harness files: `AGENTS.md`, `CLAUDE.md`, `WATCHDOG.md`, `tasks/lessons.md`.
- Add `README.md`, `CONTRIBUTING.md`, `.gitignore`, `.editorconfig`.
- Write `docs/3d-scene-tech-review.md` and correct the 3D integration section of
  `portfolio-plan.md`.

## Out of scope

- Scaffolding the Next.js application (follows the tech review and a human check-in).
- The weekly data pipeline workflow (needs the app + data source to exist).
- Choosing a license (legal decision reserved for the owner).
- Adding a git remote / pushing to GitHub (needs the target repo URL).

## Checklist

- [x] Read `portfolio-plan.md` and the 3D scene source
- [x] Confirm current 3D scene stack (Vite + React 18 + R3F v8 + drei + postprocessing + three r170)
- [ ] Initialize git with branch `main`
- [ ] Add repo scaffold files
- [ ] Add CI workflow
- [ ] Add PR / release / issue templates and dependabot
- [ ] Add harness files
- [ ] Write 3D tech review doc
- [ ] Correct plan doc 3D integration section
- [ ] Validate YAML and commit

## Review

Add post-implementation review notes here once complete.
