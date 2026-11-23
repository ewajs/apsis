# The data pipeline

How positions get from JPL Horizons to the app. Code: `scripts/data/`,
`src/core/horizons.ts`, `src/core/ephemeris.ts`. Decisions: ADR 0002 (source),
0003 (chunks), 0004 (frame, units, time).

## What runs

`npm run data` (and CI, before every build):

1. takes the live window: 60 days either side of today, at a 1-day step;
2. asks Horizons, one body at a time, for state vectors: position and velocity of the
   body's centre relative to the Sun's centre, in the ecliptic J2000 frame, km and km/s;
3. parses and validates each answer (`parseVectors`, `assertValidSamples`);
4. splits each body's samples into calendar-year chunks (`chunkByYear`);
5. only if every body succeeded, replaces `public/data/` with the chunks and
   `index.json`. Vite copies `public/` into the build, so the app finds them under
   `/apsis/data/`.

A failure anywhere exits non-zero with Horizons' own message, leaves the previous
`public/data/` as it was, and in CI stops the deployment. The live site keeps the last
good data, which stays correct for about two months.

## Reading a Horizons answer

Horizons answers JSON with a `signature` (the API version; we accept 1.x), and either
an `error` or a `result`: a text report. The data sits between the `$$SOE` and
`$$EOE` markers ("start/end of ephemeris"), one CSV row per instant:

```text
JDTDB, Calendar Date (TDB), X, Y, Z, VX, VY, VZ,
2461364.500000000, A.D. 2026-Nov-20 00:00:00.0000, -5.63198E+08, 5.61968E+08, …
```

`JDTDB` is a Julian date (days since 4713 BC, a continuous day count astronomers use)
on the TDB time scale. We store `(JD − 2451545) × 86400`: seconds since the J2000
epoch, 2000-01-01 12:00 TDB. Positions are rounded to 1 m and velocities to 1 mm/s,
far below anything visible and enough for close-up views later.

Horizons refuses some requests with HTTP 200 and a message instead of data
("No such record", "No ephemeris for target … prior to …"). `parseVectors` turns those
into a `HorizonsError` carrying the message.

## The files

```text
public/data/index.json          { format, fetchedAt, span, bodies: [{ id, horizonsId, kind, years }] }
public/data/<body>/<year>.json  { format, body, horizonsId, year, samples: [[t, x, y, z, vx, vy, vz], …] }
```

Each chunk also holds the first sample of the next year, so interpolating up to
31 December 23:59 never needs a second file. Today's window is 13 bodies × 2 years,
about 260 KB uncompressed.

## Bodies and IDs

Horizons numbers planets' centres `199` (Mercury) to `899` (Neptune); `5` alone would
be Jupiter's system barycentre, which we don't want. Spacecraft have negative IDs.
`scripts/data/bodies.ts` lists what we fetch; step 1.2 moves the spacecraft into the
catalogue.

| Body               | ID   | Source in Horizons               |
| ------------------ | ---- | -------------------------------- |
| Planets            | x99  | DE441 and moon models            |
| Juno               | −61  | merged reconstructed + predicted |
| Europa Clipper     | −159 | `Europa_Clipper_merged`          |
| Psyche             | −255 | from launch, 2023-10-13          |
| Parker Solar Probe | −96  | `psp_merged`                     |
| Voyager 1          | −31  |                                  |

## Tests

`src/core/*.test.ts` run against answers recorded in `tests/fixtures/horizons/`
(Earth across a New Year, Juno, and two refusals), never the live API. Re-record a
fixture with the request in `vectorsQuery` if Horizons changes its format.
