/**
 * Satellites around Earth (ADR 0016), from the orbital data CelesTrak publishes ("GP",
 * general perturbations, the successor of TLEs): carried from their epoch along an
 * ellipse that turns as Earth's equatorial bulge (J2) drags it, then referred to the
 * ecliptic and equinox of J2000. An approximation, said so wherever it shows: within
 * about 10 km at the epoch and 60–80 km a day later for the ISS (tested). Pure.
 */
import type { Vector3 } from './math.ts';

/** One satellite's GP elements, as CelesTrak's JSON gives them (the fields we use). */
export type GpElements = {
  /** ISO 8601 UTC, without the zone (CelesTrak's `EPOCH`). */
  EPOCH: string;
  /** Revolutions a day. */
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  /** Degrees, against Earth's equator of date. */
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  /** Half the mean motion's rate of change, revolutions a day², as TLEs carry it. */
  MEAN_MOTION_DOT: number;
};

/** Earth's gravitational parameter (km³/s²), equatorial radius (km) and J2 (WGS-84). */
export const EARTH_MU = 398_600.4418;
const EARTH_RADIUS_KM = 6_378.137;
const J2 = 1.082_626_68e-3;
const DEG = Math.PI / 180;
/** The ecliptic's tilt against the equator at J2000. */
const OBLIQUITY = 23.439_291_1 * DEG;
/** The equinox's precession along the ecliptic, arcseconds a year. */
const PRECESSION_ARCSEC_PER_YEAR = 50.29;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_S = 86_400;

/** The GP epoch in UTC ms. */
export function gpEpochMs(gp: GpElements): number {
  return Date.parse(`${gp.EPOCH}Z`);
}

/**
 * Where the satellite is at `ms` (UTC), relative to Earth's centre, km, in the ecliptic
 * J2000 frame the rest of Apsis uses.
 */
export function satellitePosition(gp: GpElements, ms: number): Vector3 {
  const dt = (ms - gpEpochMs(gp)) / 1000;
  const n = (gp.MEAN_MOTION * 2 * Math.PI) / DAY_S;
  const e = gp.ECCENTRICITY;
  const a = Math.cbrt(EARTH_MU / (n * n));
  const p = a * (1 - e * e);
  // J2's secular drift: the node slides back, periapsis turns, the mean motion shifts.
  const k = 1.5 * J2 * (EARTH_RADIUS_KM / p) ** 2 * n;
  const [si, ci] = [Math.sin(gp.INCLINATION * DEG), Math.cos(gp.INCLINATION * DEG)];
  const node = gp.RA_OF_ASC_NODE * DEG - k * ci * dt;
  const w = gp.ARG_OF_PERICENTER * DEG + k * (2 - 2.5 * si * si) * dt;
  // TLE's first derivative is n'/2 in rev/day²: it adds (n'/2)·dt² to the mean anomaly.
  const nDot = (gp.MEAN_MOTION_DOT * 2 * Math.PI) / (DAY_S * DAY_S);
  const m =
    gp.MEAN_ANOMALY * DEG +
    (n + k * Math.sqrt(1 - e * e) * (1 - 1.5 * si * si)) * dt +
    nDot * dt * dt;
  let E = m;
  for (let step = 0; step < 20; step++) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  const [x, y] = [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
  const [cn, sn, cw, sw] = [Math.cos(node), Math.sin(node), Math.cos(w), Math.sin(w)];
  // In Earth's equatorial frame of date.
  const equatorial: Vector3 = [
    x * (cw * cn - sw * sn * ci) + y * (-sw * cn - cw * sn * ci),
    x * (cw * sn + sw * cn * ci) + y * (-sw * sn + cw * cn * ci),
    x * sw * si + y * cw * si,
  ];
  // Equator to ecliptic (about x by the obliquity), then the equinox of date back to
  // J2000's (about the ecliptic pole by the precession since).
  const [ex, ey, ez] = [
    equatorial[0],
    Math.cos(OBLIQUITY) * equatorial[1] + Math.sin(OBLIQUITY) * equatorial[2],
    -Math.sin(OBLIQUITY) * equatorial[1] + Math.cos(OBLIQUITY) * equatorial[2],
  ];
  const years = (ms - J2000_MS) / (365.25 * DAY_S * 1000);
  const back = -(PRECESSION_ARCSEC_PER_YEAR / 3600) * years * DEG;
  return [Math.cos(back) * ex - Math.sin(back) * ey, Math.sin(back) * ex + Math.cos(back) * ey, ez];
}

const GP_NUMBERS = [
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
  'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER',
  'MEAN_ANOMALY',
  'MEAN_MOTION_DOT',
] as const;

/**
 * The fields Apsis uses from CelesTrak's JSON answer for one object (a list of one), or
 * an error saying what's wrong with it.
 */
export function parseGp(json: unknown, label: string): GpElements {
  const record = Array.isArray(json) && json.length === 1 ? (json[0] as unknown) : undefined;
  if (typeof record !== 'object' || record === null) {
    throw new Error(`${label}: expected a list with one object, got ${JSON.stringify(json)}`);
  }
  const fields = record as Record<string, unknown>;
  const epoch = fields.EPOCH;
  if (typeof epoch !== 'string' || Number.isNaN(Date.parse(`${epoch}Z`))) {
    throw new Error(`${label}: EPOCH is not a date`);
  }
  const gp: Record<string, number | string> = { EPOCH: epoch };
  for (const name of GP_NUMBERS) {
    const value = fields[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${label}: ${name} is not a number`);
    }
    gp[name] = value;
  }
  if ((gp.MEAN_MOTION as number) <= 0 || (gp.ECCENTRICITY as number) >= 1) {
    throw new Error(`${label}: not a closed orbit around Earth`);
  }
  return gp as GpElements;
}
