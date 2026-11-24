# The data pipeline

How positions get from JPL Horizons to the app. Code: `scripts/data/`,
`src/core/horizons.ts`, `src/core/ephemeris.ts`, `src/core/loading.ts`,
`src/data/load.ts`. Decisions: ADR 0002 (source), 0003 (chunks), 0004 (frame, units,
time), 0011 (archive and loading).

## Storage at a glance

| Data                                 | Where                                    | Written by             | How often                          | In git |
| ------------------------------------ | ---------------------------------------- | ---------------------- | ---------------------------------- | ------ |
| Catalogue (`data/catalogue.yaml`)    | repository                               | a person, in a PR      | when facts change                  | yes    |
| Planet orbits (`data/orbits.json`)   | repository                               | `npm run data:orbits`  | once; again only to move the epoch | yes    |
| Live positions (this year, +60 days) | `public/data/live/` → the deploy         | `npm run data`, in CI  | every build: each push and weekly  | no     |
| Archive (complete past years)        | `data/archive/` → `public/data/archive/` | `npm run data:archive` | once per file, never edited        | yes    |

Both are one file per body per year. A live file holds the part of the live window in
that year (from 1 January, or 60 days back if that's earlier, to 60 days ahead) and is
rebuilt from scratch on every build; an archived file holds a whole year and never
changes. A year in the archive is never fetched live again.

### Archiving

```sh
npm run data:archive -- --year 2025              # every body, one year
npm run data:archive -- --from 1977 --to 2025    # a span of years
npm run data:archive -- --year 2025 --body juno  # one body
```

Each year runs from 1 January to the next 1 January, so the file ends with the next
year's first sample, like every chunk. Years already archived are skipped (`--force`
fetches them again); bodies are clipped to their coverage. **In January**, archive the
year just ended: until then the live window still reaches 60 days back, so nothing
goes missing (ADR 0011).

## What runs

`npm run data` (and CI, before every build, including the weekly scheduled one):

1. reads and validates `data/catalogue.yaml` (`parseCatalogue`); any problem stops the
   run with the full list;
2. takes the live window: from 1 January (or 60 days back, if earlier) to 60 days ahead,
   at a 1-day step, clipped to each spacecraft's coverage and skipping years already
   archived; around each `encounter: true` milestone, hourly for 3 days either side
   (`fetchWithEncounters`, which swaps those days' daily samples for hourly ones with
   `mergeSamples`; the archive script does the same);
3. asks Horizons, one body at a time, for state vectors: position and velocity of the
   body's centre relative to the Sun's centre, in the ecliptic J2000 frame, km and km/s;
4. parses and validates each answer (`parseVectors`, `assertValidSamples`);
5. splits each body's samples into calendar-year chunks (`chunkByYear`);
6. only if every body succeeded, replaces `public/data/` with the live chunks, a copy
   of `data/archive/`, `index.json`, `catalogue.json` (the validated catalogue, for the
   browser) and `orbits.json` (the committed planet orbits, validated, ADR 0010). Vite
   copies `public/` into the build, so the app finds them under `/apsis/data/`.

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
public/data/index.json                    { format: 2, fetchedAt, span, bodies: [{ id, horizonsId, kind, years: [{ year, archived }] }] }
public/data/live/<body>/<year>.json       { format, body, horizonsId, year, samples: [[t, x, y, z, vx, vy, vz], …] }
public/data/archive/<body>/<year>.json    the same, for a whole past year
```

`chunkPath` (in `core/ephemeris.ts`) is the one place that turns a body and a year
entry into a path, for the scripts and the browser alike. Each chunk also holds the
first sample of the next year, so interpolating up to 31 December 23:59 never needs a
second file. A body-year at a daily step is about 30 KB (14 KB gzipped).

## Loading in the browser

`loadCatalogue` fetches the index, the catalogue and the orbits. Right after an app
update, the service worker may hand the new code an index in the previous format; then
it fetches a fresh one (`index.json?format=2`, an address the cache hasn't seen).

`ChunkStore` then loads years on demand. On every change of the shown instant,
`main.ts` asks `yearsToLoad(instant, rate)` (pure, tested) which years it needs: the
year shown, the previous one while a trail still reaches back across New Year, and the
next or previous one within 60 days of a year's edge in the direction of play. The
store fetches what it doesn't have yet into the very maps the views read, and the
views redraw when it arrives (the map says nothing about "no data" while a year is on
its way). Everything loaded stays for the visit.

The service worker keeps **archived years cache-first** (they never change: after one
visit they open instantly and offline) and the rest of `data/` stale-while-revalidate
(ADR 0007).

## Bodies and IDs

Planets are listed in `scripts/data/bodies.ts`: Horizons numbers their centres `199`
(Mercury) to `899` (Neptune); `5` alone would be Jupiter's system barycentre, which we
don't want. Spacecraft come from the catalogue (`data/catalogue.yaml`, ADR 0009), and
have negative IDs.

### Finding a spacecraft

1. Search by name with the lookup API:
   `https://ssd.jpl.nasa.gov/api/horizons_lookup.api?sstr=Hera&group=sct`.
   It doesn't find every spacecraft: BepiColombo only answers to its ID, `-121`.
2. Find the coverage by asking for a span Horizons surely lacks: a request for 1970
   answers "No ephemeris … prior to A.D. 2024-OCT-07", one for 2199 answers "… after
   A.D. 2027-JAN-13". Put the inner whole days in the catalogue's `coverage`: the fetch
   is clipped to it, so a mission that launches or whose predictions end inside the
   live window still works.

### The candidates, checked 2026-11-22

Coverage is what Horizons had on that date; predicted spans grow as missions update
them. Status was checked against agency sources only for the missions in the
catalogue so far; the rest are checked when they join it (step 4.3).

| Mission            | ID     | Coverage in Horizons    | Status                        |
| ------------------ | ------ | ----------------------- | ----------------------------- |
| Cassini            | `-82`  | 1997-10-15 → 2017-09-15 | ended, in the catalogue (3.5) |
| BepiColombo        | `-121` | 2018-10-20 → 2027-04-11 | to check (4.3)                |
| Hera               | `-91`  | 2024-10-07 → 2027-01-13 | to check (4.3)                |
| JUICE              | `-28`  | 2023-04-14 → 2031-07-21 | to check (4.3)                |
| Europa Clipper     | `-159` | 2024-10-14 → 2034-09-03 | active, in the catalogue      |
| Psyche             | `-255` | 2023-10-13 → 2029-02-24 | active, in the catalogue      |
| Juno               | `-61`  | 2011-08-05 → 2028-09-02 | active, in the catalogue      |
| Lucy               | `-49`  | 2021-10-16 → 2033-03-13 | to check (4.3)                |
| Parker Solar Probe | `-96`  | 2018-08-12 → 2030-01-01 | active, in the catalogue      |
| Solar Orbiter      | `-144` | 2020-02-10 → 2030-11-20 | to check (4.3)                |
| New Horizons       | `-98`  | 2006-01-19 → 2050-01-01 | to check (4.3)                |
| Voyager 1          | `-31`  | 1977-09-05 → 2100-01-01 | active, in the catalogue      |
| Voyager 2          | `-32`  | 1977-08-20 → 2100-01-01 | to check (4.3)                |
| MMX                | `-239` | 2026-10-19 → 2026-12-21 | launched Oct 2026; short span |
| Tianwen-2          | none   | not in Horizons         | joins with `horizons: null`   |

Notes:

- **Hera's and MMX's predictions end soon.** Clipping handles it: they'll show where
  data exists, and the app says "no data for this date" beyond it.
- **Tianwen-2** (CNSA) has no Horizons record under any name we tried.

## Tests

`src/core/*.test.ts` run against answers recorded in `tests/fixtures/horizons/`
(Earth across a New Year, Juno, two refusals, and daily/hourly pairs for the
interpolation tests), never the live API. Record one with exactly the fetch's
parameters:

```sh
node scripts/data/record-fixture.ts parker-perihelion-hourly -96 2026-11-30 2026-12-04 1h
```
