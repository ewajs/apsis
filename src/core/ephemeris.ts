/**
 * Ephemeris data as Apsis stores it (ADR 0003): state vectors in yearly chunks.
 * Positions are km and velocities km/s, heliocentric ecliptic J2000 (ADR 0004).
 */

/** One state vector: `[t, x, y, z, vx, vy, vz]`, with `t` in TDB seconds since J2000. */
export type Sample = readonly [
  t: number,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
];

/** Version of the chunk and index formats; bumped only once data is archived (M3). */
export const DATA_FORMAT = 1;

/** One body's samples for one calendar year, plus the first sample of the next year. */
export type Chunk = {
  format: typeof DATA_FORMAT;
  body: string;
  horizonsId: string;
  year: number;
  samples: Sample[];
};

/** What kind of body a data entry is. */
export type BodyKind = 'planet' | 'spacecraft';

/** What `data/index.json` says: which bodies have data, for which years, and how fresh. */
export type DataIndex = {
  format: typeof DATA_FORMAT;
  /** When the data was fetched, ISO 8601 UTC. */
  fetchedAt: string;
  /** The span requested from Horizons, as calendar dates (TDB). */
  span: { start: string; stop: string };
  bodies: { id: string; horizonsId: string; kind: BodyKind; years: number[] }[];
};

/** The J2000 epoch (2000-01-01 12:00 TDB) as a Julian date. */
export const J2000_JULIAN_DATE = 2451545;
const SECONDS_PER_DAY = 86_400;
/** The Unix epoch (1970-01-01 00:00) as a Julian date. */
const UNIX_EPOCH_JULIAN_DATE = 2440587.5;

/**
 * A Julian date (TDB) as TDB seconds since J2000.
 * @example tdbSecondsFromJulianDate(2451545.5) // 43200
 */
export function tdbSecondsFromJulianDate(julianDate: number): number {
  return (julianDate - J2000_JULIAN_DATE) * SECONDS_PER_DAY;
}

/**
 * The calendar year (TDB) that an instant falls in. Calendar arithmetic only, through
 * `Date.UTC`'s proleptic Gregorian calendar; no clock is read.
 */
export function yearOf(tdbSeconds: number): number {
  const julianDate = tdbSeconds / SECONDS_PER_DAY + J2000_JULIAN_DATE;
  return new Date((julianDate - UNIX_EPOCH_JULIAN_DATE) * SECONDS_PER_DAY * 1000).getUTCFullYear();
}

/**
 * Throws unless samples are usable for interpolation: at least two, times strictly
 * increasing, every number finite.
 */
export function assertValidSamples(samples: readonly Sample[], label: string): void {
  if (samples.length < 2) throw new Error(`${label}: ${samples.length} samples, need at least 2`);
  samples.forEach((sample, i) => {
    if (sample.length !== 7 || !sample.every(Number.isFinite)) {
      throw new Error(`${label}: sample ${i} is not seven finite numbers`);
    }
    const previous = samples[i - 1];
    if (previous && sample[0] <= previous[0]) {
      throw new Error(`${label}: sample ${i} is not later than the one before`);
    }
  });
}

/**
 * Splits a body's samples into yearly chunks. Each chunk also repeats the first sample
 * of the next year, so interpolating up to the end of a year needs only one file.
 * Samples must already be valid (see `assertValidSamples`).
 */
export function chunkByYear(
  samples: readonly Sample[],
  body: { id: string; horizonsId: string },
): Chunk[] {
  const chunks: Chunk[] = [];
  for (const sample of samples) {
    const year = yearOf(sample[0]);
    const last = chunks.at(-1);
    if (last?.year === year) {
      last.samples.push(sample);
      continue;
    }
    last?.samples.push(sample);
    chunks.push({
      format: DATA_FORMAT,
      body: body.id,
      horizonsId: body.horizonsId,
      year,
      samples: [sample],
    });
  }
  return chunks;
}
