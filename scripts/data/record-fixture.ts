/**
 * Records a Horizons vectors answer as a test fixture, with exactly the parameters the
 * data fetch uses (`vectorsQuery`).
 *
 *   node scripts/data/record-fixture.ts <name> <horizonsId> <start> <stop> <step>
 *   node scripts/data/record-fixture.ts parker-perihelion-hourly -96 2026-11-30 2026-12-04 1h
 *
 * Writes tests/fixtures/horizons/<name>.json.
 */
import { writeFileSync } from 'node:fs';
import { HORIZONS_API, vectorsQuery } from '../../src/core/horizons.ts';

const [name, horizonsId, start, stop, step] = process.argv.slice(2);
if (!name || !horizonsId || !start || !stop || !step) {
  console.error('Usage: record-fixture.ts <name> <horizonsId> <start> <stop> <step>');
  process.exit(1);
}
const query = new URLSearchParams(vectorsQuery({ horizonsId, start, stop, step }));
const response = await fetch(`${HORIZONS_API}?${query}`);
const file = new URL(`../../tests/fixtures/horizons/${name}.json`, import.meta.url);
writeFileSync(file, await response.text());
console.log(`Wrote ${file.pathname}`);
