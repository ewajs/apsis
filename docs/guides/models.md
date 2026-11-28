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
from `own/parts.ts`), add its entry, run the script, and check it:

- **Its axes:** with `npm run dev`, open `/apsis/scripts/models/preview.html?id=<id>`. It
  shows the built model from four sides with the body frame's axes (+X red, +Y green,
  +Z blue). The antenna should face +Z and the arrays run along +Y; adjust `rotate`
  until they do. Spacecraft that fly with a shield to the Sun (Parker, James Webb) put
  the shield on +Z and say `pointing: sun`.
- **Its colours:** a source with placeholder colours (Galileo's "black" bus is blue)
  takes ours, by material name: `materials: { 'bus:black': black }`, any material in
  `own/parts.ts`. Its texture, if any, goes.
- **Its look in the app,** close up, under the Sun.

Heavy sources take `simplify` (the fraction of triangles to keep: Europa Clipper keeps
35% of 204,000), and `simplifyError` where seams keep the simplifier from removing much
(the ISS). Textures become WebP, at most 2048 px; the script warns above 5 MB.

## The AR copies

Beside each model the script writes `public/models/ar/<id>.glb`, for the phones' own AR
viewers (ADR 0014): plain glTF, textures at most 1024 px (JPEG unless see-through),
stood antenna-up with its lowest point at floor level, at real size (`arUp: -z` stands
it the other way, for one whose +Z faces Earth from below). Over 5 MB it's
simplified, then its textures halved. `scripts/models/ar.test.ts` checks every copy is
plain and stands on the floor.

On Android the card's "En tu casa (RA)" is a link that opens Scene Viewer
(`core/ar.ts`, `sceneViewerUrl`); on an iPhone, a button that converts the AR copy to USDZ
in the page and hands it to Quick Look (`scene/ar-export.ts`).

## The models, and where they come from

Checked 2026-11-28 (5.1). NASA's models carry no copyright ("free and without
copyright"; NASA credited as the source). ESA's are not usable here: Scifleet forbids
redistribution and derivative works, the SPICE models are non-commercial (ADR 0013).

| Spacecraft     | Source                                                          | Credit                          | Size   |
| -------------- | --------------------------------------------------------------- | ------------------------------- | ------ |
| Juno           | science.nasa.gov 3D model                                       | NASA VTAD                       | 0.9 MB |
| Europa Clipper | science.nasa.gov 3D model, simplified to 35%                    | NASA VTAD                       | 4.4 MB |
| Psyche         | ours (no clean free source)                                     | Apsis                           | small  |
| Parker         | science.nasa.gov 3D model                                       | NASA VTAD                       | 0.7 MB |
| Voyager 1      | science.nasa.gov 3D model                                       | NASA VTAD                       | 0.4 MB |
| New Horizons   | science.nasa.gov 3D model                                       | NASA VTAD                       | 0.3 MB |
| BepiColombo    | ours (ESA's terms don't allow it)                               | Apsis                           | small  |
| James Webb     | nasa/NASA-3D-Resources, model B                                 | NASA/Christopher R. Meaney      | 1.4 MB |
| Cassini        | science.nasa.gov 3D model                                       | NASA VTAD                       | 0.6 MB |
| Galileo        | nasa/NASA-3D-Resources, recoloured                              | NASA/JPL/Solar System Simulator | 0.2 MB |
| Rosetta        | nasa/NASA-3D-Resources                                          | NASA                            | 0.4 MB |
| Dawn           | nasa/NASA-3D-Resources, cells recoloured                        | NASA/Brian E. Kumanchik         | 0.3 MB |
| MRO            | science.nasa.gov Mars 3D resources                              | NASA                            | 0.3 MB |
| MAVEN          | science.nasa.gov Mars 3D resources                              | NASA                            | 1.0 MB |
| Mars Odyssey   | science.nasa.gov Mars 3D resources (antenna's pose approximate) | NASA                            | 0.5 MB |
| ISS            | science.nasa.gov 3D model, simplified                           | NASA                            | 5.8 MB |
| Hubble         | science.nasa.gov 3D model                                       | NASA                            | 0.6 MB |

Mars Express, TGO and Hope have no free model yet (ESA's and the UAE's terms, ADR
0013), nor has Tiangong: markers for now.

The ISS is over the 5 MB budget, knowingly: 195,000 triangles of real detail across 343
parts, after the simplifier took what it could without blurring the trusses; it loads
only for its close-up. It and Hubble fly with +Z toward Earth (`pointing` stays Earth): the
station's modules on the nadir side, as it really flies, and Hubble's aft end, its
aperture to the sky.

## Our own

`own/parts.ts` has the pieces: a bus quilted in blanket (`blanketBox`: gold, silver, or the
white ceramic of spacecraft that fly near the Sun, in slightly puffed pillows with dark
seams, so a hard light shades them softly), solar panels of real cells (tiles with gaps,
which catch the light the way a flat panel can't; optionally every few columns a mirror,
or all mirrors) and wings of them on a yoke, a parabolic dish with its feed and rim,
struts, cans, engine bells and Hall thrusters. Materials are physically based
(metalness, roughness), tuned for one hard light, the Sun. Builders stay short; a model
is a few dozen parts, and its comment names where its sizes come from.

- **Psyche** stands upright along X (instrument deck at +X, thrusters at −X), its 2 m
  dish on +Z and its two cross-shaped wings of five panels along ±Y.
- **BepiColombo** is the Mercury Planetary Orbiter with Mio in its sunshield (MOSIF), as
  it flies between orbit insertion and the orbiters' separation. Its radiator faces −X:
  the default pose keeps the Sun on the +X side, so the radiator stays in shade, as the
  real one must.

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
  its x–z plane (or, with `pointing: sun`, +Z at the Sun with Earth across); the scene
  turns that into a rotation (ecliptic to scene axes).
- **Close-up:** the card's button calls `closeUp(true)`: a flight to 2.2 model-lengths on
  the sunlit side. From the map, 3D opens first. While a model fills the view the
  canvas carries `data-model="<id>"`, and the spacecraft's label steps aside, as do
  orbit lines and trails: from 50 m away they would cross the sky as stray lines.
