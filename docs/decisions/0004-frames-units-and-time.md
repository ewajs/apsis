# 0004. Frames, units, time and the floating origin

- Status: Accepted; implementation in M1 (core) and M2 (scene).
- Date: 2026-11-22

## Decision

**Frame.** Heliocentric (Horizons `CENTER='500@10'`, the Sun's centre), ecliptic
and mean equinox of J2000 (`REF_PLANE=ECLIPTIC`, `REF_SYSTEM=ICRF`). +x points to
the vernal equinox, +z to ecliptic north. Local views (M5) use the same axes centred
on the target body.

**Units.** Kilometres and km/s everywhere in data and logic (`OUT_UNITS=KM-S`). AU
and light-time are display formats only.

**Time.** Ephemeris times are TDB, as Horizons gives them. The app's clock is UTC.
`core` converts with TDB − UTC = 69.184 s: 37 leap seconds (TAI − UTC since 2017)
plus 32.184 s (TT − TAI), ignoring TDB − TT, which never exceeds 2 ms. A new leap
second, if one is ever announced, means updating one constant.

**Axes in three.js.** three.js is y-up, the ecliptic frame is z-up. One function,
`toScene`, maps ecliptic `(x, y, z)` to scene `(x, z, −y)`, a proper rotation (no
mirror). Nothing else knows about the difference.

**Floating origin.** The scene keeps every position in kilometres as JavaScript
numbers (64-bit) and, each frame, subtracts the current focus's position before
writing three.js positions. The camera orbits near the origin. The depth buffer is
logarithmic.

## Reasons and alternatives

- **Heliocentric, not barycentric.** It is what people picture, and the Sun's wobble
  around the barycentre (up to about two solar radii) would be visible noise.
- **km, not AU, in the scene.** With a floating origin the unit doesn't affect
  precision (32-bit floats have the same relative precision at any magnitude), so
  one unit system everywhere removes a whole class of conversion bugs.
- **Why a floating origin.** The GPU works in 32-bit floats: about 7 significant
  digits. Voyager 1 is ~2.5 × 10¹⁰ km away, so positions near it would snap to steps
  of thousands of kilometres and jitter. Near the origin the steps are tiny. gravitas
  solved the same problem this way ([its ADR 0020](https://github.com/ewajs/gravitas/blob/main/docs/decisions/0020-planetary-view.md)).
  It is one subtraction where positions are written, cheaper to have from the first
  scene than to retrofit.
- **Logarithmic depth.** A scene spanning metres to tens of AU loses depth precision
  with a linear buffer (far objects flicker through each other). three.js supports
  `logarithmicDepthBuffer` on `WebGPURenderer`, on both backends. It also offers a
  reversed depth buffer, which can be more precise; step 2.1 compares the two.
