# 0016. Satellites around Earth: CelesTrak's data, propagated in the app

- Status: Accepted (taken unsupervised, 2026-11-28). Step 7.6.
- Date: 2026-11-28

## Context

The ISS, Hubble and Tiangong circle Earth every hour and a half. Horizons has the ISS
but not most satellites, and a position a day (ADR 0003) says nothing about an orbit
that short: the ISS goes around 15 times between two samples. Minute-by-minute states
would cost megabytes a year per satellite. The owner's terms (2026-11-28): trade
precision for simplicity and size, and say when an orbit is computed rather than taken
from a source.

## Decision

- **CelesTrak's orbital data ("GP", the successor of the TLE),** one JSON request per
  satellite per data run (`gp.php?CATNR=25544&FORMAT=json`). Free, no key; CelesTrak
  asks clients not to fetch the same data more than once per update (about every two
  hours) and blocks those that keep retrying errors, so a non-200 answer stops the run
  (the previous deployment stays live, ADR 0008).
- **The elements ride in `index.json`** (`satellite` on the body's entry): a dozen
  numbers each, no new file to load. `DATA_FORMAT` stays 3: the field is optional and
  older apps ignore it.
- **Propagated in `core/earth-orbit.ts`:** the ellipse the elements describe, turned as
  Earth's equatorial bulge (J2) drags it (the node slides back, periapsis turns), plus
  the mean motion's drift from drag, then rotated from Earth's equator to the ecliptic
  of J2000 (obliquity and the equinox's precession since 2000). Not SGP4, which is what
  the elements are made for: a few dozen lines instead of a library, at a cost measured
  in tests against Horizons' own ISS: 11 km at the data's epoch, 63 km a day later, 80
  km at most over the day. At 7.7 km/s, that's about ten seconds along the orbit:
  invisible at any scale but a model's close-up, where it doesn't matter where over
  Earth the station is.
- **A satellite shows only within three days of its data** (`SATELLITE_DAYS`): the error
  grows by tens of km a day, and drag and manoeuvres are unknown beyond. Picked from
  further away, the time goes to the data's date; scrubbed away, the card says why it
  isn't there.
- **The card says so:** "Órbita aproximada, calculada con datos de CelesTrak del 28 de
  noviembre", and gives the height above Earth, the speed relative to Earth and the time
  a turn takes, instead of distances from the Sun.
- **The data run goes daily** (ADR 0008): a satellite's data ages by a day between
  runs, and three missed runs hide the satellites until the next one.
- **In 3D a satellite is framed with Earth** when picked (five Earth radii away, lit side
  on), with its ellipse around Earth from its position and velocity
  (`elementsFromState`). The map and the AR tabletop leave satellites out, as they do
  moons: at their scales they sit on Earth.

## Alternatives

- **SGP4** (`satellite.js`): the model the elements are fitted for, within about a
  kilometre at the epoch. A dependency and a second propagator for a difference no view
  can show; worth it if Apsis ever predicts passes overhead.
- **Horizons for the ISS:** it has it, but no other satellite, and its ISS is CelesTrak's
  TLE propagated anyway.
- **A dense series of positions per satellite:** exact to the source, but about 15 MB a
  year for one satellite at one-minute steps.
