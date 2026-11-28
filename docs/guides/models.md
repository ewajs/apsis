# Spacecraft models

Up close, each spacecraft is a 3D model at true size instead of a marker (ADR 0013).
Code: `scripts/models/` (the pipeline), `data/models.yaml` (what to build),
`public/models/` (what it built), `src/core/models.ts` (the index), `src/core/attitude.ts`
(the pose), `src/scene/craft-models.ts` and `solar-scene.ts` (drawing them).

## Building them

`npm run models` (or `-- --id juno` for one) reads `data/models.yaml`. Each entry is
either a model from elsewhere (`url`, `page`, `credit`, `licence`) or ours (`own: true`,
built by `scripts/models/own/<id>.ts`). For each one it:

1. **loads it:** downloads it once into `.cache/models/`, or runs our builder and turns
   its three.js objects into a glTF document (`three-to-gltf.ts`; three's own exporter
   needs a browser);
2. **puts it in the body frame:** turned by the entry's `rotate` (degrees about x, y, z)
   so +Z runs along the high-gain antenna and +Y along the solar arrays, centred, and
   scaled so its largest dimension is `lengthM`;
3. **compresses it:** duplicates merged, unused data pruned, vertices welded, reordered,
   quantised and Meshopt-encoded;
4. writes `public/models/<id>.glb` and adds it to `index.json`, which `parseModelIndex`
   checks.

The outputs are committed. To add a spacecraft: find a free model (or write a builder
from `own/parts.ts`), add its entry, run the script, and look at it close up in the app.

## Our own

`own/parts.ts` has the pieces: a bus in gold or silver blanket, solar wings of real cells
(tiles with gaps, which catch the light the way a flat panel can't), a parabolic dish with
its feed, struts and engine bells. Materials are physically based (metalness, roughness),
tuned for one hard light, the Sun. Builders stay short; a model is a few dozen parts.

## In the 3D view

- **Loading:** `CraftModels` loads a model the first time it's about a pixel across, or
  when its spacecraft is the focus, and gives every material the studio surround (see
  "Light" in ADR 0013). The surround is prefiltered when the first model arrives, not at
  start-up: most visits never come that close, and on WebGPU, prefiltering while the
  scene was still starting froze its frames now and then.
- **Marker to model:** each frame, `modelShows` compares the model's size on screen with
  the marker's (6 px); the larger one is drawn. The near plane follows the camera
  (`nearPlaneKm`: a thousandth of its distance, from 1 mm to 1 km), and the closest the
  camera may come is 0.8 model-lengths.
- **Pose:** `defaultAttitude` points +Z at Earth and rolls the model so the Sun lies in
  its x–z plane; the scene turns that into a rotation (ecliptic to scene axes).
- **Close-up:** the card's button calls `closeUp(true)`: a flight to 2.2 model-lengths on
  the sunlit side. From the map, 3D opens first. While a model fills the view the
  canvas carries `data-model="<id>"`, and the spacecraft's label steps aside.
