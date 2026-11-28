/**
 * Ephemeris data as Apsis stores it (ADR 0003): state vectors in yearly chunks.
 * Positions are km and velocities km/s, heliocentric ecliptic J2000 (ADR 0004).
 */
import type { ElementSample } from './elements.ts';
import type { Vector3 } from './math.ts';

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

/** The position part of a sample, in km. */
export function position(sample: Sample): Vector3 {
  return [sample[1], sample[2], sample[3]];
}

/**
 * Version of the index format. 2 since the archive (ADR 0011): each year says whether
 * it's archived or live. 3 since the close-ups (ADR 0015): a body may have a track of
 * orbital elements around a parent, and moons have only that. Each file type versions
 * its own shape: a state chunk is still format 2, a track chunk 1.
 */
export const DATA_FORMAT = 3;
/** Version of a state chunk's format (unchanged since the archive, ADR 0011). */
export const CHUNK_FORMAT = 2;
/** Version of a track chunk's format (ADR 0015). */
export const TRACK_FORMAT = 1;

/** One body's samples for one calendar year, plus the first sample of the next year. */
export type Chunk = {
  format: typeof CHUNK_FORMAT;
  body: string;
  horizonsId: string;
  year: number;
  samples: Sample[];
};

/** What kind of body a data entry is. */
export type BodyKind = 'planet' | 'spacecraft' | 'moon' | 'small';

/**
 * One body's orbital elements around a parent for one calendar year, plus the first
 * sample of the next year (ADR 0015).
 */
export type TrackChunk = {
  format: typeof TRACK_FORMAT;
  body: string;
  /** The parent's id: the body circles it ('jupiter' for Io and Juno). */
  center: string;
  year: number;
  samples: ElementSample[];
};

/** One year of a body's data, and where it's kept (ADR 0011). */
export type YearEntry = {
  year: number;
  /** Committed and never edited (`true`), or fetched on each build (`false`). */
  archived: boolean;
};

/** What `data/index.json` says: which bodies have data, for which years, and how fresh. */
export type DataIndex = {
  format: typeof DATA_FORMAT;
  /** When the live data was fetched, ISO 8601 UTC. */
  fetchedAt: string;
  /** The span of the live data, as calendar dates (TDB). */
  span: { start: string; stop: string };
  bodies: {
    id: string;
    horizonsId: string;
    kind: BodyKind;
    /** Years of heliocentric states (none for a moon). */
    years: YearEntry[];
    /** Years of orbital elements around a parent, if any (ADR 0015). */
    track?: { center: string; years: YearEntry[] };
  }[];
};

/**
 * Where a body's year lives, relative to the data folder: `archive/…` or `live/…`.
 * The one place that decides it, for the scripts and the browser alike.
 * @example chunkPath('juno', { year: 2025, archived: true }) // 'archive/juno/2025.json'
 */
export function chunkPath(body: string, { year, archived }: YearEntry): string {
  return `${archived ? 'archive' : 'live'}/${body}/${year}.json`;
}

/**
 * Where a body's year of orbital elements lives, beside its states.
 * @example trackPath('io', { year: 2025, archived: true }) // 'archive/io/2025.track.json'
 */
export function trackPath(body: string, { year, archived }: YearEntry): string {
  return `${archived ? 'archive' : 'live'}/${body}/${year}.track.json`;
}

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
 * Swaps a stretch of coarse samples for finer ones: every coarse sample within the fine
 * samples' span is dropped, and the fine ones go in, in time order. This is how hourly
 * samples around an encounter join a daily series (ADR 0011).
 */
export function mergeSamples(coarse: readonly Sample[], fine: readonly Sample[]): Sample[] {
  const [first, last] = [fine[0], fine.at(-1)];
  if (!first || !last) return [...coarse];
  const outside = coarse.filter(([t]) => t < first[0] || t > last[0]);
  return [...outside, ...fine].sort((a, b) => a[0] - b[0]);
}

/**
 * Splits samples (anything with a time first) into calendar years. Each year also
 * repeats the first sample of the next, so interpolating up to a year's end needs one
 * file. Samples must be in time order.
 */
export function splitByYear<S extends readonly [number, ...number[]]>(
  samples: readonly S[],
): { year: number; samples: S[] }[] {
  const years: { year: number; samples: S[] }[] = [];
  for (const sample of samples) {
    const year = yearOf(sample[0]);
    const last = years.at(-1);
    if (last?.year === year) {
      last.samples.push(sample);
      continue;
    }
    last?.samples.push(sample);
    years.push({ year, samples: [sample] });
  }
  return years;
}

/** A body's states as yearly chunks (`splitByYear`). Samples must already be valid. */
export function chunkByYear(
  samples: readonly Sample[],
  body: { id: string; horizonsId: string },
): Chunk[] {
  return splitByYear(samples).map(({ year, samples: inYear }) => ({
    format: CHUNK_FORMAT,
    body: body.id,
    horizonsId: body.horizonsId,
    year,
    samples: inYear,
  }));
}

/** A body's orbital elements around `center` as yearly chunks (`splitByYear`). */
export function trackByYear(
  samples: readonly ElementSample[],
  body: string,
  center: string,
): TrackChunk[] {
  return splitByYear(samples).map(({ year, samples: inYear }) => ({
    format: TRACK_FORMAT,
    body,
    center,
    year,
    samples: inYear,
  }));
}
