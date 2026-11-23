# 0010. Planet orbits

- Status: Accepted; implemented in step 1.5.
- Date: 2026-11-23

## Decision

Planet orbits are drawn as ellipses from **osculating orbital elements** fetched from
Horizons **once**, at one epoch (2026-01-01), and committed as `data/orbits.json`.

- **Barycentres, not centres.** Each orbit is the one of the planet's system
  barycentre (Horizons `1` to `8`): Earth's centre wobbles about 4,700 km around the
  Earth–Moon barycentre every month, which makes its instantaneous orbit wobble too.
  The planet markers stay at the centres (ADR 0002); the difference is far below a
  pixel.
- `npm run data:orbits` rewrites the file; `npm run data` validates it and copies it into
  the build next to the live data.
- `core/orbits.ts` turns elements into points (pure, tested against Horizons).

## Reasons and alternatives

- **Elements, not long position runs.** A full orbit from positions means 165 years of
  samples for Neptune; seven numbers per planet describe the whole ellipse.
- **One epoch, committed.** Orbits change slowly. Measured against Horizons
  positions, every planet sits within 0.0004 AU of its 2026 ellipse today and within
  0.003 AU for Mercury to Jupiter from 1977 to 2035. Uranus and Neptune drift most:
  0.16 and 0.12 AU off in 1977, under a pixel on the 2D map.
- **Not JPL's "approximate positions of the planets"** formulas: they'd be a second
  source next to Horizons, the kind of mismatch ADR 0002 avoids.

## Revisit when

The time slider (M3) or a 3D close-up shows an outer planet visibly off its orbit in
another decade: fetch elements per decade and draw the set nearest the shown instant.
