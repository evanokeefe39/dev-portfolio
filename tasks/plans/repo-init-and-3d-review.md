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
- [x] Initialize git with branch `main`
- [x] Add repo scaffold files
- [x] Add CI workflow
- [x] Add PR / release / issue templates and dependabot
- [x] Add harness files
- [x] Write 3D tech review doc
- [x] Correct plan doc 3D integration section
- [x] Validate YAML and commit

## Review

- Grounded the 3D stack in the actual `3d-scene-test` source: it is already R3F v8
  with clean env boundaries, so the plan's "significant rewrite" cost was wrong.
- Corrected `portfolio-plan.md` (tech stack row, performance note, integration
  options) and added `docs/3d-scene-tech-review.md`.
- Repo initialized with `main` branch and two linear conventional commits
  (`chore` infra, `docs` review). All 7 YAML files validated with a YAML parser.

### Assumption log

- **Package manager = npm** (high). Chosen for consistency with `3d-scene-test`
  and Vercel; no JS PM was specified in the plan.
- **CI assumes a Next.js app** (high). `ci.yml` runs `npm ci/lint/typecheck/build/test`
  and will go green once the app scaffold lands. Not run yet because the app
  does not exist.
- **Node 22 in CI** (medium). Current active LTS; adjust if the scaffold pins another.
- **Release process = tag-driven** (medium). Tag `v*` triggers `softprops/action-gh-release`
  with auto-generated notes from `.github/release.yml`.
- **Issue config links a Discussions URL** (low). Owner/repo inferred from git
  identity; update if the repo is hosted elsewhere.
- **No LICENSE added** (open). Legal choice reserved for the owner.
