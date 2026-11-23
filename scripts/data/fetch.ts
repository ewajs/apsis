/**
 * Builds the data folder the app loads (ADR 0002, 0003, 0009, 0010, 0011):
 *
 * - `live/<body>/<year>.json`: fetched from JPL Horizons now, from the earlier of
 *   1 January and 60 days ago, to 60 days ahead, skipping years already archived;
 * - `archive/<body>/<year>.json`: copied from the committed `data/archive/`;
 * - `index.json` (every body's years, and where each is), `catalogue.json` (validated)
 *   and `orbits.json` (from `data/orbits.json`, validated).
 *
 * The output is generated, never committed. Any failure exits non-zero, so a build
 * never ships partial data.
 *
 *   npm run data
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { assertOrbitFile } from '../../src/core/orbit-file.ts';
import {
  chunkByYear,
  chunkPath,
  DATA_FORMAT,
  type DataIndex,
  type YearEntry,
} from '../../src/core/ephemeris.ts';
import { ARCHIVE_DIR, archivedYears } from './archive-files.ts';
import { allBodies, PLANETS } from './bodies.ts';
import { readCatalogue } from './catalogue.ts';
import { fetchSamples } from './horizons-client.ts';

/** Days of data ahead of today (and at least behind): how long the site stays right. */
const LIVE_WINDOW_DAYS = 60;
/** The step for every body until fine steps around encounters arrive (3.4). */
const STEP = '1d';

const output = new URL('../../public/data/', import.meta.url);
const DAY_MS = 86_400_000;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const orbits: unknown = JSON.parse(
  readFileSync(new URL('../../data/orbits.json', import.meta.url), 'utf8'),
);
const missions = (() => {
  try {
    assertOrbitFile(
      orbits,
      PLANETS.map((planet) => planet.id),
    );
    return readCatalogue();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
const bodies = allBodies(missions);

const now = Date.now();
const thisYear = new Date(now).getUTCFullYear();
// From 1 January, or 60 days back if that's earlier (in January, before last year is
// archived, the last two months are still there).
const start = isoDate(Math.min(Date.UTC(thisYear, 0, 1), now - LIVE_WINDOW_DAYS * DAY_MS));
const stop = isoDate(now + LIVE_WINDOW_DAYS * DAY_MS);
console.log(`Fetching ${bodies.length} bodies from Horizons, ${start} to ${stop}, step ${STEP}`);

const index: DataIndex = {
  format: DATA_FORMAT,
  fetchedAt: new Date(now).toISOString(),
  span: { start, stop },
  bodies: [],
};
const files: [string, unknown][] = [];
try {
  // One request at a time, to be polite to Horizons (ADR 0002).
  for (const body of bodies) {
    const archived = archivedYears(body.id);
    // Years already in the archive are never fetched again.
    let from = start;
    while (archived.includes(Number(from.slice(0, 4))))
      from = `${Number(from.slice(0, 4)) + 1}-01-01`;
    const samples = await fetchSamples(body, from, stop, STEP);
    const live = chunkByYear(samples, body).filter((chunk) => !archived.includes(chunk.year));
    console.log(
      `  ${body.id.padEnd(20)} archive ${archived.length} year(s), live ${live.length} chunk(s), ${samples.length} samples`,
    );
    const years: YearEntry[] = [
      ...archived.map((year) => ({ year, archived: true })),
      ...live.map((chunk) => ({ year: chunk.year, archived: false })),
    ];
    for (const chunk of live)
      files.push([chunkPath(body.id, { year: chunk.year, archived: false }), chunk]);
    if (years.length === 0) continue;
    const { id, horizonsId, kind } = body;
    index.bodies.push({ id, horizonsId, kind, years });
  }
} catch (error) {
  console.error(`\nData fetch failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

// Everything fetched and valid: only now replace what was there.
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
if (existsSync(ARCHIVE_DIR)) cpSync(ARCHIVE_DIR, new URL('archive/', output), { recursive: true });
for (const [file, content] of [
  ...files,
  ['index.json', index] as const,
  ['catalogue.json', missions] as const,
  ['orbits.json', orbits] as const,
]) {
  const url = new URL(file, output);
  mkdirSync(new URL('./', url), { recursive: true });
  writeFileSync(url, JSON.stringify(content));
}
const archivedCount = index.bodies.reduce(
  (n, b) => n + b.years.filter((y) => y.archived).length,
  0,
);
console.log(
  `Wrote ${files.length} live chunks, ${archivedCount} archived, index.json, catalogue.json and orbits.json to public/data/`,
);
