/**
 * Axes (ADR 0004). Data uses the ecliptic J2000 frame, z towards ecliptic north;
 * three.js is y-up. This is the only place that knows.
 */
import type { Vector3 } from './math.ts';

/**
 * An ecliptic vector in scene axes: `(x, y, z)` becomes `(x, z, −y)`. A rotation of
 * −90° about x, not a mirror, so orbits keep turning the same way.
 * @example toScene([1, 2, 3]) // [1, 3, -2]
 */
export function toScene([x, y, z]: Vector3): Vector3 {
  return [x, z, -y];
}
