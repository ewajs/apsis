/**
 * Which way a spacecraft faces (ADR 0013). Horizons has positions, not attitude, so
 * every model gets the pose most of them fly in: the high-gain antenna (the body
 * frame's +Z) towards Earth, rolled so the Sun lies across the solar arrays' axis (+Y),
 * where arrays that turn about that axis can face it. Pure.
 */
import { cross, dot, normalize, subtract, type Vector3 } from './math.ts';

/** A body frame: where its x, y and z axes point, as unit vectors in the ecliptic frame. */
export type Axes = { x: Vector3; y: Vector3; z: Vector3 };

/** Ecliptic north: the roll reference when the Sun and Earth line up. */
const NORTH: Vector3 = [0, 0, 1];

/**
 * The pose of a spacecraft at `at` whose +Z faces `primary`, rolled so `secondary` lies
 * in its x–z plane, across the arrays' axis (+Y). Positions are heliocentric km. When
 * the two line up as seen from it, the arrays' axis lies in the ecliptic instead.
 */
export function pointAt(at: Vector3, primary: Vector3, secondary: Vector3): Axes {
  const z = normalize(subtract(primary, at));
  let y = cross(z, normalize(subtract(secondary, at)));
  if (Math.hypot(...y) < 1e-6) y = cross(z, NORTH);
  if (Math.hypot(...y) < 1e-6) y = [0, 1, 0];
  y = normalize(y);
  return { x: cross(y, z), y, z };
}

/**
 * The default pose: the antenna to Earth with the Sun across the arrays (most
 * spacecraft), or a shield to the Sun with Earth across (Parker, James Webb).
 */
export function defaultAttitude(
  at: Vector3,
  earth: Vector3,
  pointing: 'earth' | 'sun' = 'earth',
): Axes {
  const sun: Vector3 = [0, 0, 0];
  return pointing === 'sun' ? pointAt(at, sun, earth) : pointAt(at, earth, sun);
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
