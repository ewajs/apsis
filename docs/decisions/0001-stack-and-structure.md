# 0001. Stack and structure

- Status: Accepted; implemented in step 0.2. Amended 2026-11-22: `WebGPURenderer`
  instead of `WebGLRenderer`, once AR became a handoff to the phone's own viewer.
- Date: 2026-11-22

## Decision

- **TypeScript strict, Node 24, Vite.** The app and the data scripts are both
  TypeScript. Node 24 runs `.ts` files directly (type stripping), so the scripts
  need no build step.
- **three.js with `WebGPURenderer`**, which falls back to its WebGL 2 backend where
  WebGPU is missing, for the 3D scene; SVG for the 2D map. Custom shaders are written
  in TSL (three.js's shading language), which compiles to either backend.
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
- **`WebGPURenderer` with fallback, as in gravitas and Lux Studio.** The owner knows it,
  and code and lessons carry over (gravitas's floating origin among them). It is where
  three.js's new work lands, and compute shaders are there if we ever need them
  (many asteroids, say). The cost is two backends to test: browser tests force the
  WebGL backend, and each release is checked on a real WebGPU device, as gravitas does
  (its ADR 0006). `WebGLRenderer` was the first choice because three.js's WebXR
  support is mature there; AR is now a handoff to Scene Viewer and Quick Look (M6),
  so that reason no longer holds.
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
