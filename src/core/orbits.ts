/**
 * Orbits as ellipses, from osculating orbital elements (ADR 0010): the shape and
 * orientation of the two-body orbit a body would follow from a given instant, if only
 * the Sun pulled on it. See docs/guides/orbits.md.
 */
import { combine, radians, type Vector3 } from './math.ts';

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

/**
 * The orbit's plane, as two unit vectors in the ecliptic frame: P points to
 * perihelion, Q is 90° ahead of it in the direction of motion.
 */
function orbitPlane(elements: OrbitalElements): { p: Vector3; q: Vector3 } {
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
  const { eccentricity: e, semiMajorAxisKm: a } = elements;
  const b = a * Math.sqrt(1 - e * e);
  const { p, q } = orbitPlane(elements);
  return Array.from({ length: count + 1 }, (_, k) => {
    const anomaly = (2 * Math.PI * k) / count;
    // In the orbit's plane, with the Sun (a focus) at the origin.
    return combine(a * (Math.cos(anomaly) - e), p, b * Math.sin(anomaly), q);
  });
}
