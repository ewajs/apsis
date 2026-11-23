/**
 * Records a Horizons vectors answer as a test fixture, with exactly the parameters the
 * data fetch uses (`vectorsQuery`).
 *
 *   node scripts/data/record-fixture.ts <name> <horizonsId> <start> <stop> <step>
 *   node scripts/data/record-fixture.ts parker-perihelion-hourly -96 2026-11-30 2026-12-04 1h
 *
 * Or orbital elements at one epoch (`elementsQuery`):
 *
 *   node scripts/data/record-fixture.ts earth-elements 3 2026-01-01 --elements
 *
 * Writes tests/fixtures/horizons/<name>.json.
 */
import { writeFileSync } from 'node:fs';
import { elementsQuery, HORIZONS_API, vectorsQuery } from '../../src/core/horizons.ts';

const [name, horizonsId, start, stop, step] = process.argv.slice(2);
const elements = stop === '--elements';
if (!name || !horizonsId || !start || (!elements && (!stop || !step))) {
  console.error(
    'Usage: record-fixture.ts <name> <horizonsId> <start> (<stop> <step> | --elements)',
  );
  process.exit(1);
}
const query = new URLSearchParams(
  elements
    ? elementsQuery(horizonsId, start)
    : vectorsQuery({ horizonsId, start, stop: stop!, step: step! }),
);
const response = await fetch(`${HORIZONS_API}?${query}`);
const file = new URL(`../../tests/fixtures/horizons/${name}.json`, import.meta.url);
writeFileSync(file, await response.text());
console.log(`Wrote ${file.pathname}`);
