/**
 * Fetches each planet's osculating orbital elements from Horizons at one epoch and
 * writes data/orbits.json, which is committed (ADR 0010). Run it again only to move
 * the epoch, for example when the time slider reaches far enough that the drawn orbits
 * drift from the planets.
 *
 *   npm run data:orbits
 */
import { writeFileSync } from 'node:fs';
import { assertOrbitFile, type OrbitFile } from '../../src/core/orbit-file.ts';
import { elementsQuery, HORIZONS_API, parseElements } from '../../src/core/horizons.ts';
import { PLANETS } from './bodies.ts';

/** The instant the drawn orbits describe. */
const EPOCH = '2026-01-01';
const USER_AGENT = 'apsis-data (+https://github.com/ewajs/apsis)';

const file: OrbitFile = { format: 1, epoch: EPOCH, planets: {} };
for (const planet of PLANETS) {
  const query = new URLSearchParams(elementsQuery(planet.orbitId!, EPOCH));
  const response = await fetch(`${HORIZONS_API}?${query}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`${planet.id}: HTTP ${response.status}`);
  file.planets[planet.id] = parseElements(await response.json());
  console.log(
    `  ${planet.id.padEnd(8)} a = ${(file.planets[planet.id]!.semiMajorAxisKm / 149_597_870.7).toFixed(4)} AU`,
  );
}
assertOrbitFile(
  file,
  PLANETS.map((planet) => planet.id),
);
writeFileSync(
  new URL('../../data/orbits.json', import.meta.url),
  `${JSON.stringify(file, null, 2)}\n`,
);
console.log(`Wrote data/orbits.json (epoch ${EPOCH})`);
