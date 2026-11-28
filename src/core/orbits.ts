/**
 * Orbits as ellipses, from osculating orbital elements (ADR 0010): the shape and
 * orientation of the two-body orbit a body would follow from a given instant, if only
 * the Sun pulled on it. See docs/guides/orbits.md.
 */
import { add, combine, dot, radians, subtract, type Vector3 } from './math.ts';

/** Osculating orbital elements around the Sun, in the ecliptic J2000 frame. */
export type OrbitalElements = {
  /** The instant they describe, in TDB seconds since J2000. */
  epoch: number;
  /** 0 for a circle, towards 1 for a long, thin ellipse. */
  eccentricity: number;
  semiMajorAxisKm: number;
  /** Tilt of the orbit against the ecliptic. */
  inclinationDeg: number;
  /** Where the orbit rises through the ecliptic, measured from the vernal equinox (Ω). */
  ascendingNodeDeg: number;
  /** Where the closest point (perihelion) is, measured from the ascending node (ω). */
  argumentOfPeriapsisDeg: number;
  /** Where the body was along its orbit at the epoch, measured from perihelion (ν). */
  trueAnomalyDeg: number;
};

/** The three angles that orient an orbit in the ecliptic frame. */
export type OrbitAngles = Pick<
  OrbitalElements,
  'inclinationDeg' | 'ascendingNodeDeg' | 'argumentOfPeriapsisDeg'
>;

/**
 * The orbit's plane, as two unit vectors in the ecliptic frame: P points to
 * perihelion (periapsis, around another centre), Q is 90° ahead of it in the direction
 * of motion.
 */
export function orbitPlane(elements: OrbitAngles): { p: Vector3; q: Vector3 } {
  const [i, node, w] = [
    radians(elements.inclinationDeg),
    radians(elements.ascendingNodeDeg),
    radians(elements.argumentOfPeriapsisDeg),
  ];
  const [ci, si, cn, sn, cw, sw] = [i, i, node, node, w, w].map((angle, k) =>
    k % 2 === 0 ? Math.cos(angle) : Math.sin(angle),
  ) as [number, number, number, number, number, number];
  return {
    p: [cw * cn - sw * sn * ci, cw * sn + sw * cn * ci, sw * si],
    q: [-sw * cn - cw * sn * ci, -sw * sn + cw * cn * ci, cw * si],
  };
}

/**
 * The point on the orbit at a true anomaly (angle from perihelion, seen from the Sun),
 * in ecliptic km.
 */
export function orbitPoint(elements: OrbitalElements, trueAnomalyRad: number): Vector3 {
  const { eccentricity: e, semiMajorAxisKm: a } = elements;
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomalyRad));
  const { p, q } = orbitPlane(elements);
  return combine(r * Math.cos(trueAnomalyRad), p, r * Math.sin(trueAnomalyRad), q);
}

/**
 * The whole ellipse as `count` points, closed (the last repeats the first), spaced
 * evenly in eccentric anomaly so they stay smooth around both ends of the orbit.
 */
export function orbitPath(elements: OrbitalElements, count: number): Vector3[] {
  const pointAt = ellipse(elements);
  return Array.from({ length: count + 1 }, (_, k) => pointAt((2 * Math.PI * k) / count));
}

/**
 * The ellipse as a function of eccentric anomaly E (0 to 2π from perihelion), in
 * ecliptic km. In the orbit's own plane, with the Sun (a focus) at the origin, the point
 * is (a (cos E − e), b sin E); P and Q place that plane in the ecliptic frame.
 */
function ellipse(elements: OrbitalElements): (eccentricAnomaly: number) => Vector3 {
  const { eccentricity: e, semiMajorAxisKm: a } = elements;
  const b = a * Math.sqrt(1 - e * e);
  const { p, q } = orbitPlane(elements);
  return (anomaly) => combine(a * (Math.cos(anomaly) - e), p, b * Math.sin(anomaly), q);
}

/**
 * The ellipse as `count + 1` points that pass exactly through `position` (ecliptic km),
 * for drawing an orbit next to its planet up close (docs/guides/scene.md):
 *
 * - points are densest at the body, so the line doesn't cut across it as a chord;
 * - the whole ellipse is shifted by the body's small drift from it (planets wander up
 *   to about 0.0004 AU from one epoch's osculating orbit), pinning it to the body.
 *
 * The first and last points are both `position`.
 */
export function orbitPathThrough(
  elements: OrbitalElements,
  count: number,
  position: Vector3,
): Vector3[] {
  const e = elements.eccentricity;
  const { p, q } = orbitPlane(elements);
  // The body's direction within the orbit's plane, as an eccentric anomaly.
  const trueAnomaly = Math.atan2(dot(position, q), dot(position, p));
  const start = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(trueAnomaly / 2));

  const pointAt = ellipse(elements);
  const shift = subtract(position, pointAt(start));
  return Array.from({ length: count + 1 }, (_, k) => {
    // w runs from −1 to 1. 1 − (1 − |w|)³ flattens out at both ends, so the points
    // bunch up where the loop starts and ends, at the body, and spread out opposite it.
    const w = (2 * k) / count - 1;
    const anomaly = start + Math.PI + Math.PI * Math.sign(w) * (1 - (1 - Math.abs(w)) ** 3);
    return add(pointAt(k === 0 || k === count ? start : anomaly), shift);
  });
}
