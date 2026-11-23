/**
 * Reference frames (ADR 0004). Data uses the ecliptic J2000 frame, z towards ecliptic
 * north. Here: the turn from the equatorial (ICRF) frame that star and pole directions
 * are given in, the galactic frame, and three.js's y-up axes. The only place that knows.
 */
import { cross, radians, type Vector3 } from './math.ts';

/** The obliquity of the ecliptic at J2000: the angle between the two frames. */
export const OBLIQUITY_DEG = 23.4392911;

/** A direction given as right ascension and declination (equatorial, ICRF), as a unit vector. */
export function equatorialDirection(raDeg: number, decDeg: number): Vector3 {
  const [ra, dec] = [radians(raDeg), radians(decDeg)];
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/**
 * An equatorial (ICRF) vector in the ecliptic frame: a turn about x (the vernal
 * equinox, which both frames share) by the obliquity.
 */
export function equatorialToEcliptic([x, y, z]: Vector3): Vector3 {
  const e = radians(OBLIQUITY_DEG);
  return [x, Math.cos(e) * y + Math.sin(e) * z, -Math.sin(e) * y + Math.cos(e) * z];
}

/**
 * The Milky Way's axes, in the ecliptic frame: towards the galactic centre (in
 * Sagittarius), the north galactic pole, and galactic longitude 90°. From the IAU
 * definition of galactic coordinates in ICRF.
 */
export function galacticAxes(): { centre: Vector3; north: Vector3; east: Vector3 } {
  const centre = equatorialDirection(266.40499, -28.93617);
  const north = equatorialDirection(192.85948, 27.12825);
  return {
    centre: equatorialToEcliptic(centre),
    north: equatorialToEcliptic(north),
    east: equatorialToEcliptic(cross(north, centre)),
  };
}

/**
 * An ecliptic vector in scene axes: `(x, y, z)` becomes `(x, z, −y)`. A rotation of
 * −90° about x, not a mirror, so orbits keep turning the same way.
 * @example toScene([1, 2, 3]) // [1, 3, -2]
 */
export function toScene([x, y, z]: Vector3): Vector3 {
  return [x, z, -y];
}
