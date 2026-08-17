# AGENTS.md

Operating instructions for the `dev-portfolio` repo. This is a production
factory, not a style guide. Read it before starting work. At session start,
review `tasks/lessons.md` for patterns relevant to the current task.

## What this repo is

A single-page developer portfolio: a full-viewport 3D isometric office hero
(React Three Fiber) with glass overlay UI replaying weekly session data
(PRs, branches, LOC deltas). Product intent lives in `portfolio-plan.md`;
the 3D integration decision lives in `docs/3d-scene-tech-review.md`.

## Foundational principles

- **Continuous improvement** — every cycle produces signal, not just code.
  After any correction, update `tasks/lessons.md` and add a rule that prevents
  the mistake recurring.
- **Respect for people** — the agent executes; the human owns intent and design.
  Never exceed the mandate. Never guess when the specification is silent.

## Specification gate

For any non-trivial change (3+ steps or any architectural decision), stop and
check before writing code:

- Intent is an outcome, not a technical description.
- Context package exists (relevant code, constraints, prior decisions, anti-patterns).
- Behavioral contracts are verifiable (`GIVEN / WHEN / THEN`).
- Edge cases are enumerated.
- Definition of done is binary and checkable.
- Open questions are empty — surface them to the human before proceeding.

If a gap exists, escalate with a specific prompt. Proceeding past a silent
specification is a defect.

## Planning

1. Write a named plan to `tasks/plans/<descriptive-name>.md` with checkable items.
2. Check in with the human before implementing non-trivial work.
3. Mark items complete as they land; never mark done without proof (tests, logs).
4. Add a review section when done; update `tasks/lessons.md` after any correction.

## Executable specification format

```
## Intent
## Context Package
  ### Relevant existing code
  ### Architectural constraints
  ### Prior decisions
  ### Anti-patterns to avoid
## Behavioral Contracts  (GIVEN/WHEN/THEN, testable)
## Edge Case Inventory
## Definition of Done    (binary checklist)
## Negative Space        (must-not-change, out-of-scope, human-reserved)
## Open Questions        (must be empty before execution)
```

## Bug fixing

Fix the root cause, not the symptom. Apply the Five Whys and log the result.
Add a test that would have caught the bug. Never suppress a failing test.

## Data and integration gates

This repo has two data surfaces that demand verification before modeling:

- **Local data** (`data/*.json`): read one real file and confirm schema before
  writing any transformation. Modeling against fake data is defect propagation.
- **External API** (GitHub REST/GraphQL in the weekly pipeline): smoke-test one
  real request and inspect the actual response shape before writing batch logic.
  GitHub tokens live in Actions secrets — never committed, never logged.

## Review interface

Present work in this order: definition-of-done checklist, assumption log
(sorted by consequence), reasoning trace, then code/tests. Triage each
assumption as one-off, specification gap, or schema gap.

## Conventions

- Git: trunk-based, squash-merge PRs, conventional commits, linear history.
  No pushes to `main`. See `CONTRIBUTING.md`.
- Package manager: npm. (uv is for Python repos only.)
- TypeScript everywhere; `strict: true`; explicit error paths; no bare `except`
  equivalents (no swallowed errors).
- 3D components inside Next.js must be client components (`'use client'`) and
  loaded with `dynamic(..., { ssr: false })`.
