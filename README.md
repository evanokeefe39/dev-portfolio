# dev-portfolio

Single-page developer portfolio for a data / analytics engineer. A full-viewport
3D isometric office cutaway is the hero, with transparent glass UI overlays that
replay real session data (PRs, branches, LOC deltas) on a weekly cadence.

The detailed product plan lives in [`portfolio-plan.md`](portfolio-plan.md). The
3D scene tech stack review (and the reasoning behind the integration decision) is
in [`docs/3d-scene-tech-review.md`](docs/3d-scene-tech-review.md).

## Status

Repository infrastructure is initialized (CI, PR/release templates, agent harness
files, git conventions). The Next.js application scaffold is the next step and has
not been built yet — see the plan and tech review before starting.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router), static export |
| 3D scene | React Three Fiber (see tech review for the port decision) |
| Overlay UI | React + Framer Motion |
| Blog | MDX via `@next/mdx` |
| Styling | Tailwind CSS |
| Data | Static JSON rebuilt weekly by a GitHub Action |
| Deployment | Vercel |

## Getting started

The application is not scaffolded yet. Once it is:

```bash
npm install
npm run dev
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Trunk-based branching, squash-merge PRs,
conventional commits, linear history.
