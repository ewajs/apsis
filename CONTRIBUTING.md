# Contributing

Apsis is a small, static web app. The owner must be able to follow all of it, so
prefer explicit code, familiar platform mechanisms and small changes over cleverness.

## Principles

1. **Simple over complex.** Build the simplest thing that solves today's problem. No
   abstraction, option or extension point until a second real use needs it.
2. **Pure logic, edges outside.** Orbital math, interpolation and data parsing are
   pure functions in `src/core`. Network, storage, the clock, three.js and the DOM
   live at the edges and pass data in.
3. **Real data, honestly shown.** Positions come from Horizons. If we don't have a
   position, we say so; we never invent one.
4. **Code documents itself.** Types and TSDoc on exports are the reference; prose docs
   explain how the pieces fit and why.

## Working cycle

1. Pick the next step in [PLAN.md](docs/PLAN.md) and mark it `[~]`.
2. Branch from `main`: `feat/`, `fix/`, `docs/`, `chore/`, `data/`.
3. Implement with tests. A PR is one self-contained, reviewable unit; size is a hint,
   not a limit. As a rough guide, more than ~400 changed lines of source code (`src/`,
   `scripts/`, config) is worth a second look for a natural split; tests, docs,
   generated files and the lockfile don't count. Never split a unit just to get under
   a number.
4. `npm run check` passes; try the change in a browser at 375×667 and on desktop.
5. Open a PR; CI must be green. Tick the step `[x]` in the same PR.
6. The owner reviews and merges. `main` deploys to GitHub Pages.

Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`,
`data:` for catalogue or archived-ephemeris changes). Each milestone ends with
version `0.N.0` in `package.json` and a short release note in PLAN.md.

## Commands

| Command                                   | Does                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                             | Dev server at `/apsis/`; append `-- --host` to try a phone   |
| `npm run check`                           | Format, lint, types and unit tests: the PR gate              |
| `npm run lint`                            | ESLint, including folder boundaries; warnings fail           |
| `npm run typecheck`                       | The app, `core` alone (no DOM, no Node), scripts and configs |
| `npm test` / `npm run test:watch`         | Vitest, tests beside the code as `*.test.ts`                 |
| `npm run format` / `npm run format:check` | Write / check formatting                                     |
| `npm run build` / `npm run preview`       | Production build to `dist/` / serve it                       |
| `npm run data`                            | Fetch the live window from Horizons into `public/data/`      |
| `npm run data:orbits`                     | Refetch the committed planet orbits (`data/orbits.json`)     |
| `npm run e2e`                             | Build, then the browser tests on a phone and a desktop       |
| `npm run icons`                           | Redraw the icon and render its PNGs into `public/`           |

Before the first `npm run e2e`, install the browser (`npx playwright install chromium`)
and fetch data (`npm run data`): the map tests use what's in `public/data/`.

CI runs `check`, `npm audit --omit=dev` (advisories in what ships), `data` and `build` on every
PR; on `main` it then deploys that same build to Pages. A weekly schedule (Mondays)
rebuilds and redeploys with fresh data (ADR 0008).

## Code

- TypeScript strict, no `any`. Validate external data (Horizons responses, the
  catalogue) at the boundary, where it enters.
- Plain data and pure functions for logic. Stateful owners (the scene, the time
  controller) may be classes with private fields.
- Name things after the domain: _ephemeris, state vector, chunk, epoch, focus,
  trail, apsis_. Units in names when ambiguous (`distanceKm`, `tdbSeconds`).
- Tunable numbers (minimum on-screen size, trail length, time steps) live in one
  named constant each.
- One home per responsibility, no duplicated logic. Generic vector and angle maths
  lives in `src/core/math.ts` (a `math/` folder once it grows); domain modules
  (`orbits`, `frames`, `ephemeris`) build on it instead of carrying their own helpers,
  and so do tests.
- Comments explain _why_. No commented-out code, no TODOs without a PLAN.md entry.
- Prettier formats; ESLint warnings are errors, including folder boundaries.

## Dependencies

A dependency must remove real complexity. For each new one, say in the PR what it
saves, its license, its cost in bundle size and the alternatives considered. Runtime
stack changes get an ADR. Commit the lockfile.

## Testing

- Vitest for `src/core` and the data scripts. Parsers are tested against recorded
  Horizons responses in `tests/fixtures/`, never against the live API.
- Interpolation is tested against Horizons itself: fixtures sampled at a fine step
  give the expected positions between the coarse samples, within stated tolerances.
- Playwright runs locally for changes to page flow, input, rendering or the PWA. CI
  runs the fast checks only.
- No snapshot tests of components or screenshots as proof of correctness.

## Documentation

- Every exported function, type and constant has a TSDoc comment.
- Every Lit component starts with a comment: what it shows, its properties and the
  events it fires.
- Developer guides in `docs/guides/` explain how a feature works end to end. Write
  one with each feature the owner will want to dig into later (the data pipeline,
  interpolation, the scene's scale and floating origin).
- A change that makes a doc wrong fixes the doc in the same PR.
- Code, comments and developer docs are English. Player-facing text is es-AR
  (voseo) and English.
