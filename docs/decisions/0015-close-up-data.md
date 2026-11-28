# 0015. Close-up data: daily orbital elements

- Status: Accepted (taken unsupervised, 2026-11-28). Propagation from step 7.0; the
  data, moons, small bodies and orbiters through M7.
- Date: 2026-11-28

## Decision

- **Moons and orbiters are positioned from orbital elements around their planet,**
  sampled once a day from Horizons (`ELEMENTS` with `CENTER='500@599'` for Jupiter's
  centre, and so on), not from heliocentric positions: a daily heliocentric sample puts
  Juno 29,000 km off at perijove (ADR 0003), while a day's elements describe the whole
  ellipse it's on.
- **Between two samples,** the body is carried along each sample's ellipse to the
  instant (Kepler's equation) and the two positions are blended by how far between them
  the instant is (`core/elements.ts`). Exact at each sample; measured against Horizons'
  own positions six-hourly over two days: Io within 325 km (of a 422,000 km orbit), Juno
  near apojove within 22 km.
- **A sample is eight numbers,** `[t, a, e, i, Ω, ω, M, n]`: a year of daily samples is
  about 30 KB, a tenth of what minutes-apart positions would need.
- **The position on screen is the parent's plus the offset:** Jupiter's heliocentric
  position (Hermite, as now) plus Io's from its elements. A body with elements at an
  instant uses them; otherwise its heliocentric states, as before.
- **Small bodies** (Pluto, Ceres, Vesta, 67P…) use the same series around the Sun, at a
  coarser step: their ellipses change slowly.
- **Said so:** the card notes when a position comes from orbital elements, "calculada a
  partir de elementos orbitales diarios de JPL Horizons".

## Alternatives

- **Minutes-apart positions around each planet:** exact, but megabytes per body-year,
  for the archive back to 1977.
- **SPICE kernels:** the source of truth, but large binary files and a reader in the
  browser.
