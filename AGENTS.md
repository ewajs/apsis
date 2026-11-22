# Working on Apsis

Shared instructions for Claude, Codex and other coding agents. CLAUDE.md points
here so the working rules have one source of truth.

## Read by task

- Always read [CONTRIBUTING.md](CONTRIBUTING.md) and the active step in
  [docs/PLAN.md](docs/PLAN.md).
- Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing folder boundaries,
  the data format, the reference frame or caching.
- [ADRs](docs/decisions/README.md) explain significant choices; amend one instead of
  silently contradicting it.

## Invariants

- `src/core` is pure: no three.js, Lit, DOM, clock, network or storage. Time is
  always an explicit input; "now" is only the default value the app passes in.
- Positions are kilometres and velocities km/s, heliocentric, ecliptic J2000, times
  in TDB (ADR 0004). The mapping to three.js axes lives in one function.
- The scene renders relative to the current focus (floating origin, ADR 0004):
  never hand absolute heliocentric kilometres to three.js.
- Generated data and committed data share one chunk format (ADR 0003); the browser
  cannot tell them apart.
- Player-facing text exists in Spanish (es-AR, voseo) and English, through
  `@lit/localize` or the catalogue's `{ es, en }` fields. Never hard-code it.
- Colours, durations and radii are tokens in `src/ui/styles.css`; components use
  `var(--…)`, never literal values. Touch targets are at least 44 px.
- Every third-party asset has its source and license in a CREDITS file before it ships.

## Scope and autonomy

Work one agreed PLAN step per branch and PR unless the owner expands the scope.
Within that step, implement, fix related bugs, test and update docs without asking
again. Explain material choices in the PR, and say so when you made a call the
owner didn't ask for.

Bring consequential changes forward with a recommendation and trade-offs: folder
boundaries, the data format, new runtime dependencies, or changes to an ADR.

The owner is learning three.js and orbital mechanics along the way: when a PR uses
a concept for the first time (Hermite interpolation, a frame transform, a Lit
directive…), explain it briefly in the PR and in the developer docs, tied to the code.

Open a review PR; the owner reviews and merges. Do not merge, start the next step
or change repository settings unless authorized.

## Before reporting completion

- `npm run check` passes (check its exit code). Try UI changes in a real browser at
  a phone viewport and on desktop.
- Update affected docs in the same PR. Label planned behavior as planned.
- Report what changed, how it was verified, and what wasn't verified.
