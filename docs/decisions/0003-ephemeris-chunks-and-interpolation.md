# 0003. Ephemeris chunks and interpolation

- Status: Accepted; the format and interpolation in M1, the archive and loading on
  demand in M3.
- Date: 2026-11-22

## Decision

**Chunks.** Ephemerides are stored as one JSON file per body per calendar year:
`data/<body>/<year>.json` in the build output. Each chunk holds samples with explicit
times, so the step can vary within a chunk:

```text
{
  "format": 1,
  "body": "juno",
  "horizonsId": "-61",
  "fetchedAt": "2026-11-22T05:17:00Z",
  "samples": [[t, x, y, z, vx, vy, vz], ...]
}
```

`t` is TDB seconds since J2000; positions are km and velocities km/s in the frame of
[ADR 0004](0004-frames-units-and-time.md), rounded to 1 m and 1 mm/s. Each chunk
repeats the first sample of the next year, so interpolation never needs two files.

**Two kinds of chunk, one format.**

- _Live_: chunks that may still change (active missions, whose predicted
  trajectories are revised after each manoeuvre). The build fetches them fresh and
  they are not committed. In M1 the live window is 60 days either side of the build
  date, at a 1-day step.
- _Archived_: chunks that will never change (an ended mission's whole trajectory,
  planets for past years). They are fetched once by a manual script, committed under
  `data/archive/`, and copied into the build as they are.

**Variable step.** A body's samples can come from several Horizons requests with
different steps: coarse in cruise (days), fine around flybys and for orbiters
(hours). The catalogue names the encounters that need a fine step (M3).

**Interpolation: cubic Hermite.** Between two samples, the position is the cubic
polynomial that matches both positions _and_ both velocities. Velocity is the
cubic's derivative. Outside a body's coverage there is no position: the body is not
drawn and the UI says there is no data for that date.

## Reasons and alternatives

- **Hermite, not linear.** Horizons gives velocity with every sample, and a straight
  line between daily samples cuts corners on curved paths. Hermite uses the
  velocity and costs a few multiplications. Splines over many samples or Chebyshev
  fits (what SPICE uses) are more accurate but not needed at this scale and harder
  to explain.
- **Yearly files.** A day per sample for twenty years of Cassini is ~7,300 samples, a
  few hundred kilobytes compressed: fine in yearly pieces, too heavy in one file. The
  time slider (M3) loads the years around the displayed instant.
- **History committed, live data not.** Committing what never changes means history
  no longer depends on Horizons and has its own history in git. Committing live data
  daily would grow the repository by megabytes a day for almost no information.
- **JSON first.** Binary typed arrays would be smaller and faster to load. JSON is
  readable and compresses well; switch if size or parse time becomes measurable.

## Measured (2026-11-22, step 1.3)

Against Horizons' own hourly samples, daily samples with Hermite are within 0.07 km
for Earth, but miss by 200,000 km at Parker's perihelion and 480,000 km at Juno's
perijove. Error falls about 16-fold per halved step. Encounters need a 6-hour step or
finer (M3); orbiters need target-centred data minutes apart (M5).
[The interpolation guide](../guides/interpolation.md) has the table.

## Revisit when

The data for a typical visit exceeds a few megabytes, or a view needs better than the
measured accuracy.
