# 0001. Stack and structure

- Status: Accepted; implementation in step 0.2.
- Date: 2026-11-22

## Decision

- **TypeScript strict, Node 24, Vite.** The app and the data scripts are both
  TypeScript. Node 24 runs `.ts` files directly (type stripping), so the scripts
  need no build step.
- **three.js with `WebGLRenderer`** for the 3D scene; SVG for the 2D map.
- **Lit + `@lit/localize`** for the UI: a handful of panels (picker, card, time
  slider, settings) around a canvas, as web components with design tokens.
- **One npm package**, with folders `core`, `data`, `scene`, `map`, `ui` and
  import rules enforced by `eslint-plugin-boundaries`
  ([ARCHITECTURE.md](../ARCHITECTURE.md)).
- **Vitest** for unit tests, **Playwright** for local browser tests, **ESLint** and
  **Prettier**. TypeDoc once there is API worth browsing.

## Reasons and alternatives

- **TypeScript for the data scripts, not Python.** One toolchain, and the chunk
  format and catalogue types are defined once, in `src/core`, for both the writer and
  the reader. Python's real advantage is SPICE (spiceypy); if we ever need it, a
  separate script can write the same chunk format then.
- **`WebGLRenderer`, not `WebGPURenderer`** (which gravitas uses). AR is on the plan
  (M7), and three.js's WebXR support is mature on `WebGLRenderer`. The scene is light
  (a few dozen objects), so WebGPU buys nothing yet. Revisit when WebGPU's XR support
  matches.
- **Lit**, as in gravitas and Lux Studio: the owner knows it, components are
  standard elements, and `@lit/localize` switches language without a reload. Svelte
  or React would work too; nothing here outweighs familiarity.
- **One package, not npm workspaces.** gravitas split into packages because reusable
  libraries were an explicit goal. Nothing in Apsis is reused yet. Folder boundaries
  with lint rules give the same discipline with less tooling. If code proves useful
  to another project (frames and orbits to gravitas, say), it becomes a package then.
- **A separate project from gravitas.** gravitas is a flight game; Apsis is an
  explorer of real data with a daily data refresh. They share tools and patterns,
  not a product. Patterns are copied for now; shared code is extracted on a second
  real use.
