/**
 * Fetches whole years from Horizons into the committed archive (ADR 0011): one file per
 * body per year, `data/archive/<body>/<year>.json`, never edited afterwards.
 *
 *   npm run data:archive -- --year 2025            every body, one year
 *   npm run data:archive -- --from 1977 --to 2025  every body, a span of years
 *   npm run data:archive -- --year 2025 --body juno
 *
 * Years already archived are skipped (add --force to fetch them again). Each year runs
 * from 1 January to 1 January, so the file ends with the next year's first sample.
 * Bodies are clipped to their coverage; a year with no data for a body is skipped.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chunkByYear } from '../../src/core/ephemeris.ts';
import { ARCHIVE_DIR } from './archive-files.ts';
import { allBodies } from './bodies.ts';
import { readCatalogue } from './catalogue.ts';
import { fetchSamples } from './horizons-client.ts';

/** The archive's step; finer samples around encounters come with step 3.4. */
const STEP = '1d';

const { values } = parseArgs({
  options: {
    year: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    body: { type: 'string', multiple: true },
    force: { type: 'boolean', default: false },
  },
});
const first = Number(values.year ?? values.from);
const last = Number(values.year ?? values.to);
const thisYear = new Date().getUTCFullYear();
if (!Number.isInteger(first) || !Number.isInteger(last) || first > last || last >= thisYear) {
  console.error(
    'Usage: npm run data:archive -- (--year Y | --from Y1 --to Y2) [--body id …] [--force]\n' +
      `Only complete years can be archived (before ${thisYear}).`,
  );
  process.exit(1);
}

const bodies = allBodies(readCatalogue()).filter(
  (body) => !values.body || values.body.includes(body.id),
);
let written = 0;
try {
  for (const body of bodies) {
    for (let year = first; year <= last; year++) {
      const file = new URL(`${body.id}/${year}.json`, ARCHIVE_DIR);
      if (existsSync(file) && !values.force) continue;
      const samples = await fetchSamples(body, `${year}-01-01`, `${year + 1}-01-01`, STEP);
      const chunk = chunkByYear(samples, body).find((c) => c.year === year);
      if (!chunk || chunk.samples.length < 2) continue;
      mkdirSync(new URL('./', file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(chunk)}\n`);
      written++;
      console.log(`  ${body.id.padEnd(20)} ${year}  ${chunk.samples.length} samples`);
    }
  }
} catch (error) {
  console.error(`\nArchive failed: ${error instanceof Error ? error.message : error}`);
  console.error(`(${written} file(s) written before it stopped; they're complete and can stay.)`);
  process.exit(1);
}
console.log(`Archived ${written} body-year(s) into data/archive/`);
