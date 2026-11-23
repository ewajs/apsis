/**
 * Fetches the live ephemeris window from JPL Horizons and writes it where the app
 * loads it: public/data/<body>/<year>.json, public/data/index.json and the validated
 * catalogue as public/data/catalogue.json (ADR 0002, 0003, 0009).
 * The output is generated, never committed. Any failure exits non-zero, so a build
 * never ships partial data.
 *
 *   npm run data
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import {
  assertValidSamples,
  chunkByYear,
  DATA_FORMAT,
  type DataIndex,
} from '../../src/core/ephemeris.ts';
import { HORIZONS_API, parseVectors, vectorsQuery } from '../../src/core/horizons.ts';
import { PLANETS, type Body } from './bodies.ts';
import { readCatalogue } from './catalogue.ts';

/** Days of data either side of today: how long the site stays right without a refresh. */
const LIVE_WINDOW_DAYS = 60;
/** The step for every body until fine steps around encounters arrive (M3). */
const STEP = '1d';
/** Attempts per request, and the wait before the second (doubled each time). */
const ATTEMPTS = 4;
const FIRST_RETRY_MS = 2_000;
// Generic and honest: what the client is and where it lives, nothing about who runs it.
const USER_AGENT = 'apsis-data (+https://github.com/ewajs/apsis)';

const output = new URL('../../public/data/', import.meta.url);

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      // 500 and 503 mean Horizons is busy or down: worth another try. Anything else
      // that isn't OK (400 bad request, 405) won't fix itself.
      if (response.ok) return await response.json();
      if (response.status !== 500 && response.status !== 503) {
        throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
      if (attempt >= ATTEMPTS) throw new Error(`HTTP ${response.status} after ${attempt} attempts`);
    } catch (error) {
      // Network errors (fetch rejects with TypeError) are retried too.
      if (!(error instanceof TypeError) || attempt >= ATTEMPTS) throw error;
    }
    await sleep(FIRST_RETRY_MS * 2 ** (attempt - 1));
  }
}

async function fetchBody(body: Body, start: string, stop: string) {
  // Ask only for what Horizons has: a mission launched or ending inside the window.
  if (body.coverage) {
    if (body.coverage.from > start) start = body.coverage.from;
    if (body.coverage.to < stop) stop = body.coverage.to;
    if (start >= stop) return [];
  }
  const query = vectorsQuery({ horizonsId: body.horizonsId, start, stop, step: STEP });
  const samples = parseVectors(await fetchJson(`${HORIZONS_API}?${new URLSearchParams(query)}`));
  assertValidSamples(samples, body.id);
  return chunkByYear(samples, body);
}

const missions = (() => {
  try {
    return readCatalogue();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
const bodies: Body[] = [
  ...PLANETS,
  ...missions.flatMap((mission) =>
    mission.horizons === null
      ? []
      : [
          {
            id: mission.id,
            horizonsId: mission.horizons,
            kind: 'spacecraft' as const,
            ...(mission.coverage && { coverage: mission.coverage }),
          },
        ],
  ),
];

const now = new Date();
const day = 86_400_000;
const start = isoDate(new Date(now.getTime() - LIVE_WINDOW_DAYS * day));
const stop = isoDate(new Date(now.getTime() + LIVE_WINDOW_DAYS * day));
console.log(`Fetching ${bodies.length} bodies from Horizons, ${start} to ${stop}, step ${STEP}`);

const index: DataIndex = {
  format: DATA_FORMAT,
  fetchedAt: now.toISOString(),
  span: { start, stop },
  bodies: [],
};
const files: [string, unknown][] = [];
try {
  // One request at a time, to be polite to Horizons (ADR 0002).
  for (const body of bodies) {
    const chunks = await fetchBody(body, start, stop);
    const samples = chunks.reduce((sum, chunk) => sum + chunk.samples.length, 0);
    console.log(`  ${body.id.padEnd(20)} ${chunks.length} chunk(s), ${samples} samples`);
    if (chunks.length === 0) continue;
    for (const chunk of chunks) files.push([`${body.id}/${chunk.year}.json`, chunk]);
    const { id, horizonsId, kind } = body;
    index.bodies.push({ id, horizonsId, kind, years: chunks.map((chunk) => chunk.year) });
  }
} catch (error) {
  console.error(`\nData fetch failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

// Everything fetched and valid: only now replace what was there.
rmSync(output, { recursive: true, force: true });
for (const [file, content] of [
  ...files,
  ['index.json', index] as const,
  ['catalogue.json', missions] as const,
]) {
  const url = new URL(file, output);
  mkdirSync(new URL('./', url), { recursive: true });
  writeFileSync(url, JSON.stringify(content));
}
console.log(`Wrote ${files.length} chunks, index.json and catalogue.json to public/data/`);
