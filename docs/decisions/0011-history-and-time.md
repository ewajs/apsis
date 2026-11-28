# 0011. Every mission's history, and moving through time

- Status: Accepted 2026-11-23, with the owner's answers below; implementation in M3.
- Builds on ADR 0003 (chunks), 0007 (caching) and 0008 (delivery).

## Goal

From the owner (2026-11-23): every mission's **whole history**, from launch to its end
or to now, and a **time slider** to move through it, forwards and backwards; and no
need to update anything every day.

## Proposal

### 1. Two kinds of data, split at the start of the current year

```text
launch ──────────── archive: whole past years, committed, never edited ────────────┬── live ──▶
                                                                          1 January this year   +60 days
```

- **Archive:** every complete past year, for every body, in the chunk format of ADR 0003. Written once into `data/archive/<body>/<year>.json`, committed, never edited.
  Ended missions (Cassini) are archived whole when they join the catalogue.
- **Live:** from 1 January of the current year to 60 days ahead, fetched on every build
  (weekly, ADR 0008), exactly as today but starting at the year's start instead of 60
  days back. It's never committed.
- **The year rolls over once a year:** in January, `npm run data:archive -- --year 2026`
  fetches last year whole and commits it (a small PR). Until it's done, nothing
  breaks: the live window still covers the last 60 days.

Why the year, not a monthly cut-off: chunks are already yearly, so an archived year is
one file per body, written once, and the live data never overlaps a file in the
archive. A monthly cut-off would mean editing archived files, or chunks by month.

### 2. Steps

- **Daily, for every body,** as today. Hermite makes that effectively exact away from
  encounters (ADR 0003, measured).
- **Finer around encounters:** milestones marked `encounter: true` in the catalogue (a
  flyby, a perihelion) get samples every hour for 3 days either side, fetched as a
  separate Horizons request and merged into the chunk (chunks already allow any step).
  At Parker's perihelion that takes the error from 200,000 km to well under 100 km.
  **Measured (step 3.4):** Parker at its 2 December 2026 perihelion, 1.85 km at worst;
  Europa Clipper at its 3 December Earth flyby (3,200 km from Earth), 815 km: invisible
  at solar-system scale, but its path bends around Earth within the hour, so the local
  Earth view (M7) still needs Earth-centred samples minutes apart.

### 3. Size

Measured on today's files: one body-year at a daily step is **30 KB raw, 14 KB
gzipped**.

| What                                                        | Body-years | Raw      | Committed (gzip-ish) |
| ----------------------------------------------------------- | ---------- | -------- | -------------------- |
| The 14 candidate missions, launch → end/now (Cassini incl.) | ≈ 190      | ≈ 6 MB   | ≈ 3 MB               |
| Planets, 1977 → now (the Voyagers' launch)                  | ≈ 400      | ≈ 12 MB  | ≈ 6 MB               |
| Encounter samples (≈ 40 encounters × 145 hourly samples)    | —          | ≈ 0.5 MB | small                |

About 18 MB in the repository, once. **Measured after step 3.5:** 490 body-years (8
planets × 49 years, Voyager 1 × 49, Cassini × 21, and the other missions from launch),
14.9 MB raw, 6.9 MB gzipped. **After step 4.4** (New Horizons, BepiColombo, James
Webb, Galileo, Rosetta, Dawn): 563 body-years, 17.3 MB raw, 7.7 MB gzipped. **A visit
loads only the years it shows:** about
18 chunks (8 planets and ~10 spacecraft) for one year, roughly 250 KB gzipped. Dragging
the slider across fifty years would load more, but only what's looked at.

If size ever matters: outer planets at a 5-day step (Hermite error stays far below a
pixel there) halves the planets' share.

### 4. Loading and caching

- In the build, archive and live live under different paths: `data/archive/…` and
  `data/live/…`. `index.json` lists, for each body, which years exist and where.
- The browser keeps a small cache of chunks in memory and loads the years around the
  displayed instant (the year shown, plus the next or previous one as the slider
  heads that way).
- The service worker (ADR 0007): **archive files are cache-first** (they never change,
  so after the first visit they're instant and offline); **live files stay
  stale-while-revalidate**.

### 5. Time

- One **time controller** in `main.ts` owns the displayed instant and its rate:
  paused, real time, or faster, forwards or backwards (for example 1 day, 1 week or 1
  month per second). Everything else already takes the time as an input.
- **The slider** sits along the bottom: its range is from the first data (1977) to the
  end of the live window. It has play/pause, speed, direction and a "now" button, and
  dragging is immediate. The address bar's `?t=` follows it, so any moment can be
  shared.
- Bodies with no data at the shown instant are hidden and listed as today ("no data
  for this date"): before launch, after the end, or in a gap.

### 6. What doesn't change

Planet orbits stay one epoch (ADR 0010): 3D close-ups pin each orbit to its planet, and
the 2D drift is under a pixel even in 1977. The frame and time conversions already work
for any date (the TDB − UTC constant is off by up to 21 s before 2017: a few hundred
km, invisible).

## Alternatives considered

- **Everything live, nothing committed:** fetching 50 years for 20 bodies on every
  build is about 600 Horizons requests and minutes of CI per build, and history would
  depend on Horizons being up. No.
- **Commit the live data too:** daily or weekly commits of changing files (ADR 0003
  already turned this down).
- **A monthly cut-off:** more freshness than we need, and archived files would change.
- **A database or a backend:** nothing here needs one; static files and the cache do
  the job.

## Decided (2026-11-23)

1. **The year roll-over is a manual command** (`npm run data:archive -- --year <last
year>`) run in January; nothing breaks while it waits.
2. **Planets go back to 1977**, so the slider never shows spacecraft without planets.
3. **Ended missions:** Cassini first (3.5), then Rosetta, Galileo and Dawn (moved to
   4.4), each only with a Horizons ephemeris (all four have one: −82, −226, −77, −203).
   Coverage stops at the mission's end, even where Horizons predicts on (Dawn still
   orbits Ceres, to 2043): an ended mission is drawn while it worked.
4. **Slider speeds:** real time, 1 day, 1 week and 1 month per second.

Loading stays **one file per body per year**: the index lists each body's years, the
browser fetches the year shown (plus the previous one while a trail reaches back
across New Year, and the next one in the direction of play), keeps recent years in
memory, and the service worker keeps archived years for good.
