# Planet orbits

How the map draws each planet's whole orbit from seven numbers. Code:
`src/core/orbits.ts`, `src/core/orbit-file.ts`, `scripts/data/orbits.ts`. Decision:
ADR 0010.

## Osculating orbital elements

If the Sun were the only thing pulling on a planet, the planet would follow a fixed
ellipse forever. Its _osculating_ ("kissing") orbit at an instant is that ellipse: the
one that matches its position and velocity at that moment. The other planets nudge it
slowly, so the real path drifts from any one osculating ellipse, but for planets the
drift is tiny (ADR 0010 has the numbers).

Horizons describes the ellipse with orbital elements; we keep six of them, plus the
epoch:

| Element                     | Symbol | Says                                                                 |
| --------------------------- | ------ | -------------------------------------------------------------------- |
| Semi-major axis             | a      | Size: half the ellipse's longest diameter                            |
| Eccentricity                | e      | Shape: 0 is a circle, close to 1 a long thin ellipse                 |
| Inclination                 | i      | Tilt of the orbit against the ecliptic                               |
| Longitude of ascending node | Ω      | Where the orbit climbs through the ecliptic, from the vernal equinox |
| Argument of perihelion      | ω      | Where the closest point is, from that node                           |
| True anomaly                | ν      | Where the body is, from perihelion, at the epoch                     |

`a` and `e` fix the ellipse in its own plane; `i`, `Ω` and `ω` turn that plane into
place in the ecliptic frame.

## From elements to points

In its own plane, with the Sun at one focus and perihelion along +x, the ellipse is:

```text
x = a (cos E − e)          E: the eccentric anomaly, 0 to 360°
y = b sin E                b = a √(1 − e²), the semi-minor axis
```

`orbitPlane` builds two unit vectors in the ecliptic frame from `i`, `Ω` and `ω`: **P**
towards perihelion and **Q** 90° ahead of it. Each point is then `x·P + y·Q`.
`orbitPath` steps `E` evenly, which keeps points smooth at both ends of the ellipse;
stepping the true anomaly instead would bunch them up near perihelion.

`orbitPoint(elements, ν)` uses the polar form instead,
`r = a (1 − e²) / (1 + e cos ν)`, to find the point at a given true anomaly. At the
elements' own `ν` it must land where Horizons' position vector is for the same
instant; the tests check that to within 1 km for the Earth–Moon barycentre and Mars.

## The file

`data/orbits.json` is committed: `{ format: 1, epoch: '2026-01-01', planets: { earth:
{ … }, … } }`. `npm run data:orbits` rewrites it, which should only be needed to move
the epoch. `npm run data` validates it and copies it to `public/data/orbits.json`, so
the browser loads it with the live data and the service worker caches it the same way.

On the map, each orbit is 240 points projected like everything else, so the log scale
bends the ellipses too: the inner orbits get room, and Neptune's is still a closed
loop. A browser test checks that every planet marker sits on its drawn orbit (within
1.5 px).
