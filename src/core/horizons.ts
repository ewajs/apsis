/**
 * The JPL Horizons API, as Apsis uses it (ADR 0002): requests for state vectors and the
 * parsing of their answers. Pure: building a request and reading a response; the
 * network call itself lives in scripts/data.
 */
import { tdbSecondsFromJulianDate, type Sample } from './ephemeris.ts';

/** The Horizons API endpoint. */
export const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** The API major version this parser was written against (from the response signature). */
export const HORIZONS_API_MAJOR = '1';

/** A request for one body's state vectors over a span, at a fixed step. */
export type VectorsRequest = {
  horizonsId: string;
  /** Calendar dates in TDB, `YYYY-MM-DD`. */
  start: string;
  stop: string;
  /** A Horizons step size, such as `1d` or `6h`. */
  step: string;
};

/** Horizons answered, but with a message instead of data (bad ID, no coverage…). */
export class HorizonsError extends Error {
  override name = 'HorizonsError';
}

/**
 * The query parameters for a vectors request: heliocentric (the Sun's centre),
 * ecliptic J2000, km and km/s, position and velocity only, as CSV (ADR 0004).
 * A plain record, so `core` needs no URL API; the caller encodes it.
 */
export function vectorsQuery(request: VectorsRequest): Record<string, string> {
  // Horizons wants its values quoted.
  const quoted = (value: string) => `'${value}'`;
  return {
    format: 'json',
    COMMAND: quoted(request.horizonsId),
    OBJ_DATA: quoted('NO'),
    MAKE_EPHEM: quoted('YES'),
    EPHEM_TYPE: quoted('VECTORS'),
    CENTER: quoted('500@10'),
    REF_PLANE: quoted('ECLIPTIC'),
    REF_SYSTEM: quoted('ICRF'),
    VEC_TABLE: quoted('2'),
    OUT_UNITS: quoted('KM-S'),
    CSV_FORMAT: quoted('YES'),
    START_TIME: quoted(request.start),
    STOP_TIME: quoted(request.stop),
    STEP_SIZE: quoted(request.step),
  };
}

// The answer's JSON envelope, as far as we use it.
type Envelope = { result?: unknown; error?: unknown; signature?: { version?: unknown } };

/**
 * Reads a vectors answer (the parsed JSON) into samples, rounded to 1 ms, 1 m and
 * 1 mm/s. Throws `HorizonsError` when Horizons sent a message instead of data, and a
 * plain `Error` when the answer isn't shaped as expected.
 */
export function parseVectors(response: unknown): Sample[] {
  const envelope = (response ?? {}) as Envelope;
  const version = String(envelope.signature?.version ?? '');
  if (version.split('.')[0] !== HORIZONS_API_MAJOR) {
    throw new Error(`Unexpected Horizons API version "${version}"`);
  }
  if (typeof envelope.error === 'string') throw new HorizonsError(envelope.error.trim());
  if (typeof envelope.result !== 'string') throw new Error('Horizons answer has no result');

  const text = envelope.result;
  const start = text.indexOf('$$SOE');
  const end = text.indexOf('$$EOE');
  if (start < 0 || end < start) throw new HorizonsError(firstLines(text));

  return text
    .slice(start + '$$SOE'.length, end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map(parseRow);
}

// A CSV row: JDTDB, calendar date, X, Y, Z, VX, VY, VZ (and a trailing comma).
function parseRow(line: string): Sample {
  const cells = line.split(',').map((cell) => cell.trim());
  const numbers = [cells[0], ...cells.slice(2, 8)].map(Number);
  if (cells.length < 8 || !numbers.every(Number.isFinite)) {
    throw new Error(`Unreadable Horizons row: ${line}`);
  }
  const [julianDate, x, y, z, vx, vy, vz] = numbers as [number, ...number[]];
  const km = (n: number | undefined) => Math.round(n! * 1e3) / 1e3;
  const kmPerS = (n: number | undefined) => Math.round(n! * 1e6) / 1e6;
  const t = Math.round(tdbSecondsFromJulianDate(julianDate) * 1e3) / 1e3;
  return [t, km(x), km(y), km(z), kmPerS(vx), kmPerS(vy), kmPerS(vz)];
}

// Horizons explains a refusal in the first lines of its text; keep them for the error.
function firstLines(text: string): string {
  return text.trim().split('\n').slice(0, 6).join(' ').replace(/\s+/g, ' ').slice(0, 400);
}
