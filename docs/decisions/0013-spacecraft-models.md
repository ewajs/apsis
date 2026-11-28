# 0013. Spacecraft models

- Status: Accepted (taken unsupervised under the owner's mandate of 2026-11-28: models
  should look stunning, up to about 5 MB each; free models respecting their licence, or
  our own, simplified). Implemented from step 5.2.
- Date: 2026-11-28

## Decision

- **Sources, in order:** NASA's own models (science.nasa.gov 3D resources and the
  `nasa/NASA-3D-Resources` repository: "free and without copyright", NASA credited as
  the source); otherwise **our own**, built in code from simple parts and labelled
  "simplified, made for Apsis" on the card. Every model's credit and licence travel with
  it (`public/models/index.json`) and show on the card.
- **Not used:** ESA's Scifleet models (their terms forbid redistribution and derivative
  works), ESA's SPICE models (CC BY-NC 3.0 IGO: usable by a non-commercial app, but they
  would tie every fork of an MIT project to non-commercial use), NASA's Eyes assets (no
  licence stated), and Sketchfab uploads of unclear provenance. BepiColombo and Psyche
  are therefore ours.
- **One pipeline,** `npm run models` (`data/models.yaml` → `public/models/`): fetch (cached
  in `.cache/`), bring into **one body frame** (metres, centred, +Z along the high-gain
  antenna, +Y along the solar arrays), scale to the real size, merge and prune, quantise
  and **Meshopt**-compress. The outputs are committed, like the data archive: a build
  never depends on a third party being up. Up to about 5 MB a model.
- **In the scene,** a model loads the first time it could matter (about a pixel across, or
  when its spacecraft is the focus) and replaces the marker once it's bigger on screen
  than the marker (ADR 0005 amended). The near plane follows the camera down to
  millimetres; the camera may come within 0.8 model-lengths.
- **Attitude:** Horizons has none, so each model takes the pose most fly in: antenna to
  Earth, rolled so the Sun lies across the arrays' axis (`core/attitude.ts`).
- **Light:** the Sun is the key light. Models alone also reflect a soft studio surround
  (three's `RoomEnvironment`, prefiltered, at 0.45): in space there's nothing else to
  reflect and metal goes black, and every spacecraft render cheats the same way.
  Planets don't get it; their night sides stay dark.
- **Close-up:** the card's "Ver la nave de cerca" flies from wherever the camera is to
  2.2 model-lengths from the spacecraft, on its sunlit side (55° round from the Sun, 18°
  up), the distance shrinking by equal factors; a flight's length grows with the orders
  of magnitude it crosses (0.9 to 3.2 s), none with reduced motion.

## Reasons and alternatives

- **Meshopt over Draco:** three ships its decoder as a small module (no WebAssembly file
  to host), and it compresses animation-free meshes about as well. Several NASA files
  arrive Draco-compressed; the pipeline decodes them.
- **Committed outputs over building in CI:** models change rarely, the sources are big
  (up to 45 MB), and a vanished source would break deploys.
- **Our own models over NC assets:** a little less detail, in exchange for every file in
  the repository being reusable on the same terms.
