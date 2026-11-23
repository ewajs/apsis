/**
 * The committed planet orbits, `data/orbits.json` (ADR 0010): written once by
 * `npm run data:orbits`, copied into the build by `npm run data`.
 */
import type { OrbitalElements } from './orbits.ts';

/** What `data/orbits.json` holds. */
export type OrbitFile = {
  format: 1;
  /** The instant the elements describe, as a calendar date (TDB). */
  epoch: string;
  /** Each planet's osculating elements, by planet id. */
  planets: Record<string, OrbitalElements>;
};

/** Throws unless `data` is an orbit file with elements for every planet listed. */
export function assertOrbitFile(
  data: unknown,
  planetIds: readonly string[],
): asserts data is OrbitFile {
  const file = data as Partial<OrbitFile> | null;
  if (file?.format !== 1 || typeof file.epoch !== 'string' || typeof file.planets !== 'object') {
    throw new Error('orbits.json: not an orbit file (format 1)');
  }
  for (const id of planetIds) {
    const elements = file.planets?.[id];
    const numbers = elements && Object.values(elements);
    if (!numbers || numbers.length !== 7 || !numbers.every(Number.isFinite)) {
      throw new Error(`orbits.json: no usable elements for ${id}`);
    }
  }
}
