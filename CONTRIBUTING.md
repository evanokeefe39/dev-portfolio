# Contributing

## Git model

- **Trunk-based.** All work branches from `main` and returns to `main` via a
  squash-merge pull request.
- **Linear history.** No merge commits. Squash-merge only. `main` always fast-forwards.
- **No direct pushes to `main`.** Always work on a branch.
- **Branch prefix:** `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `perf/`, `ci/`.
- **Branch lifetime:** 1–3 days. **PR size:** target ~400 lines or fewer.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): imperative summary
```

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

## Pull requests

Fill out the PR template (linked automatically). Every PR must:

- State intent and scope.
- Include or reference tests for behavioral changes.
- Pass CI before merge.

## Releasing

Releases are tag-driven. When a `v*` tag is pushed, the release workflow creates a
GitHub Release with auto-generated notes (configured in `.github/release.yml`).

1. Bump version and update `CHANGELOG.md` (Keep a Changelog format).
2. Tag and push: `git tag v1.0.0 && git push origin v1.0.0`.
3. The release notes are generated from PR labels.

## Branch protection (set up once on GitHub)

Recommended settings on `main`:

- Require a pull request before merging.
- Require squash merge.
- Require status checks (CI) to pass.
- Require linear history (no merge commits).
