/**
 * Positions from orbital elements sampled once a day (or less), for bodies that circle a
 * planet or move too fast for daily positions: moons, orbiters, and the small bodies
 * (ADR 0015). Each sample is the ellipse the body was on at that instant; between two
 * samples, the body is carried along each ellipse to the instant and the two positions
 * blended. Pure.
 */
import { add, combine, cross, scale, subtract, type Vector3 } from './math.ts';
import { orbitPlane, type OrbitalElements } from './orbits.ts';

/**
 * One sample of osculating elements around a centre, in the ecliptic J2000 frame:
 * `[t, a, e, i, Ω, ω, M, n]`, with `t` in TDB seconds since J2000, `a` in km, angles in
 * degrees and the mean motion `n` in degrees per second.
 */
export type ElementSample = readonly [
  t: number,
  a: number,
  e: number,
  i: number,
  node: number,
  periapsis: number,
  meanAnomaly: number,
  meanMotion: number,
];

const DEG = Math.PI / 180;

/** The eccentric anomaly for a mean anomaly (radians), solving Kepler's equation. */
export function eccentricAnomaly(meanAnomaly: number, e: number): number {
  // Wrapped into (−π, π] first: Newton's method then converges from a start of M (or ±π
  // for long, thin orbits like Juno's, e ≈ 0.97) for every elliptic orbit.
  const M = meanAnomaly - 2 * Math.PI * Math.round(meanAnomaly / (2 * Math.PI));
  let E = e < 0.8 ? M : Math.PI * (Math.sign(M) || 1);
  for (let k = 0; k < 30; k++) {
    const step = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return E;
}

/** Where a body is at `t`, relative to its centre (km), carried along one sample's ellipse. */
export function propagate(sample: ElementSample, t: number): Vector3 {
  const [t0, a, e, i, node, w, m0, n] = sample;
  const meanAnomaly = (m0 + n * (t - t0)) * DEG;
  const E = eccentricAnomaly(meanAnomaly, e);
  const { p, q } = orbitPlane({
    inclinationDeg: i,
    ascendingNodeDeg: node,
    argumentOfPeriapsisDeg: w,
  });
  // Position in the orbit's plane, from the centre: along P and Q.
  return combine(a * (Math.cos(E) - e), p, a * Math.sqrt(1 - e * e) * Math.sin(E), q);
}

/**
 * Where a body is at `t` relative to its centre (km), from samples in time order: carried
 * along the ellipses of the samples either side and blended by how far `t` is between
 * them. `null` outside the samples.
 */
export function positionFromSamples(samples: readonly ElementSample[], t: number): Vector3 | null {
  if (samples.length === 0 || t < samples[0]![0] || t > samples[samples.length - 1]![0]) {
    return null;
  }
  let low = 0;
  let high = samples.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (samples[middle]![0] <= t) low = middle;
    else high = middle;
  }
  const before = samples[low]!;
  const after = samples[high]!;
  if (before === after || t === before[0]) return propagate(before, t);
  const w = (t - before[0]) / (after[0] - before[0]);
  return add(scale(propagate(before, t), 1 - w), scale(propagate(after, t), w));
}

/** A sample as the ellipse it describes, for drawing the orbit (`orbitPath`). */
export function sampleOrbit(sample: ElementSample): OrbitalElements {
  const [t, a, e, i, node, w, m] = sample;
  const E = eccentricAnomaly(m * DEG, e);
  const trueAnomaly =
    2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  return {
    epoch: t,
    eccentricity: e,
    semiMajorAxisKm: a,
    inclinationDeg: i,
    ascendingNodeDeg: node,
    argumentOfPeriapsisDeg: w,
    trueAnomalyDeg: trueAnomaly / DEG,
  };
}

/**
 * When a body on these elliptic samples next passes its periapsis after each one, in
 * TDB seconds, without repeats (to the hour): where an orbiter moves fastest and daily
 * samples fall short, so the data takes finer ones around them (ADR 0015).
 */
export function periapsisTimes(samples: readonly ElementSample[]): number[] {
  const times: number[] = [];
  for (const [t, , , , , , m, n] of samples) {
    if (!(n > 0)) continue;
    // Degrees still to go to the next periapsis, at n degrees a second.
    const ahead = (360 - (((m % 360) + 360) % 360)) % 360;
    const next = t + ahead / n;
    if (!times.some((known) => Math.abs(known - next) < 3600)) times.push(next);
  }
  return times.sort((a, b) => a - b);
}

/**
 * The ellipse a body at `r` (km) moving at `v` (km/s) is on, around a centre of
 * gravitational parameter `mu` (km³/s²), as of `epoch`: the elements of its two-body
 * orbit, in the frame `r` and `v` are given in. For drawing an orbit known only from
 * positions (a satellite from CelesTrak). Elliptic orbits only.
 */
export function elementsFromState(
  r: Vector3,
  v: Vector3,
  mu: number,
  epoch: number,
): OrbitalElements {
  const rLength = Math.hypot(...r);
  const speed2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
  const h = cross(r, v);
  const hLength = Math.hypot(...h);
  // The eccentricity vector points to periapsis.
  const rv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  const eVector = scale(subtract(scale(r, speed2 - mu / rLength), scale(v, rv)), 1 / mu);
  const e = Math.hypot(...eVector);
  const a = 1 / (2 / rLength - speed2 / mu);
  const i = Math.acos(h[2] / hLength);
  const node = cross([0, 0, 1], h);
  const nodeLength = Math.hypot(...node);
  const angle = (from: Vector3, to: Vector3, upwards: boolean) => {
    const c =
      (from[0] * to[0] + from[1] * to[1] + from[2] * to[2]) /
      (Math.hypot(...from) * Math.hypot(...to));
    const theta = Math.acos(Math.min(1, Math.max(-1, c)));
    return upwards ? theta : 2 * Math.PI - theta;
  };
  // Near-equatorial or near-circular orbits have no node or periapsis to measure from:
  // take the x axis, and the node, instead.
  const nodeDir: Vector3 = nodeLength > 1e-9 ? node : [1, 0, 0];
  const ascendingNode = nodeLength > 1e-9 ? angle([1, 0, 0], node, node[1] >= 0) : 0;
  const periDir: Vector3 = e > 1e-9 ? eVector : nodeDir;
  const periapsis = e > 1e-9 ? angle(nodeDir, eVector, eVector[2] >= 0) : 0;
  const trueAnomaly = angle(periDir, r, rv >= 0);
  return {
    epoch,
    eccentricity: e,
    semiMajorAxisKm: a,
    inclinationDeg: i / DEG,
    ascendingNodeDeg: ascendingNode / DEG,
    argumentOfPeriapsisDeg: periapsis / DEG,
    trueAnomalyDeg: trueAnomaly / DEG,
  };
}
