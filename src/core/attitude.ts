/**
 * Which way a spacecraft faces (ADR 0013). Horizons has positions, not attitude, so
 * every model gets the pose most of them fly in: the high-gain antenna (the body
 * frame's +Z) towards Earth, rolled so the Sun lies across the solar arrays' axis (+Y),
 * where arrays that turn about that axis can face it. Pure.
 */
import { cross, dot, normalize, scale, subtract, type Vector3 } from './math.ts';

/** A body frame: where its x, y and z axes point, as unit vectors in the ecliptic frame. */
export type Axes = { x: Vector3; y: Vector3; z: Vector3 };

/** Ecliptic north: the roll reference when the Sun and Earth line up. */
const NORTH: Vector3 = [0, 0, 1];

/**
 * The default pose of a spacecraft at `at`, with Earth at `earth` (heliocentric km).
 * When Earth and the Sun are in line as seen from it (Juno near opposition), the arrays'
 * axis lies in the ecliptic instead.
 */
export function defaultAttitude(at: Vector3, earth: Vector3): Axes {
  const z = normalize(subtract(earth, at));
  const toSun = normalize(scale(at, -1));
  // y ⟂ both: the Sun then lies in the x–z plane, across the arrays' axis.
  let y = cross(z, toSun);
  if (Math.hypot(...y) < 1e-6) y = cross(z, NORTH);
  if (Math.hypot(...y) < 1e-6) y = [0, 1, 0];
  y = normalize(y);
  const x = cross(y, z);
  return { x, y, z };
}

/** Whether three axes are a right-handed orthonormal frame (for tests and checks). */
export function isFrame({ x, y, z }: Axes, tolerance = 1e-9): boolean {
  const unit = (v: Vector3) => Math.abs(dot(v, v) - 1) < tolerance;
  const right = cross(x, y);
  return (
    unit(x) &&
    unit(y) &&
    unit(z) &&
    Math.abs(dot(x, y)) < tolerance &&
    Math.abs(dot(y, z)) < tolerance &&
    Math.abs(dot(z, x)) < tolerance &&
    Math.hypot(right[0] - z[0], right[1] - z[1], right[2] - z[2]) < tolerance
  );
}
