/**
 * Vector and angle arithmetic shared by the rest of `core` (and anything that imports
 * it). Generic: no orbits, frames or units here, only the maths they're built from.
 * Pure. Grows into a `math/` folder if it gets big.
 */

/** A 3D vector, in whatever unit the caller works in (km in Apsis). */
export type Vector3 = readonly [x: number, y: number, z: number];

/** `a + b`. */
export function add(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** `a − b`. */
export function subtract(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** `k · v`. */
export function scale(v: Vector3, k: number): Vector3 {
  return [v[0] * k, v[1] * k, v[2] * k];
}

/** `a·u + b·v`: a point given by its coordinates along two axes. */
export function combine(a: number, u: Vector3, b: number, v: Vector3): Vector3 {
  return [a * u[0] + b * v[0], a * u[1] + b * v[1], a * u[2] + b * v[2]];
}

/** The dot product `a · b`. */
export function dot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** The cross product `a × b`. */
export function cross(a: Vector3, b: Vector3): Vector3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** The length of `v`. */
export function length(v: Vector3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** The distance between two points. */
export function distance(a: Vector3, b: Vector3): number {
  return length(subtract(a, b));
}

/**
 * Degrees to radians.
 * @example radians(180) // Math.PI
 */
export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
