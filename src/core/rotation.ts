/**
 * Which way bodies point and how they spin, from the IAU Working Group on Cartographic
 * Coordinates and Rotational Elements (WGCCRE): Archinal et al., Celestial Mechanics
 * and Dynamical Astronomy 130:22 (2018), and the 2009 report for Mars. Periodic terms
 * (all under 0.7°) are left out: they don't show at the sizes we draw. Pure.
 * See docs/guides/rotation.md.
 */
import { equatorialDirection, equatorialToEcliptic } from './frames.ts';
import { combine, cross, radians, type Vector3 } from './math.ts';

/**
 * A body's rotation model. Its "north" pole is, by IAU convention, the one on the north
 * side of the solar system's plane; a body spinning backwards (Venus, Uranus) has a
 * negative `meridianPerDay`. The pole's direction is given in the ICRF equatorial frame
 * as right ascension and declination, each drifting linearly per Julian century (T);
 * the prime meridian's angle W turns linearly per day (d), both from J2000 TDB.
 */
export type RotationModel = {
  poleRaDeg: number;
  poleRaPerCentury: number;
  poleDecDeg: number;
  poleDecPerCentury: number;
  meridianDeg: number;
  /** Degrees per day; negative for retrograde spin (Venus, Uranus). */
  meridianPerDay: number;
};

const model = (
  poleRaDeg: number,
  poleRaPerCentury: number,
  poleDecDeg: number,
  poleDecPerCentury: number,
  meridianDeg: number,
  meridianPerDay: number,
): RotationModel => ({
  poleRaDeg,
  poleRaPerCentury,
  poleDecDeg,
  poleDecPerCentury,
  meridianDeg,
  meridianPerDay,
});

/** Rotation models of the Sun and the planets, by body id. */
export const ROTATION: Readonly<Record<string, RotationModel>> = {
  sun: model(286.13, 0, 63.87, 0, 84.176, 14.1844),
  mercury: model(281.0103, -0.0328, 61.4155, -0.0049, 329.5988, 6.1385108),
  venus: model(272.76, 0, 67.16, 0, 160.2, -1.4813688),
  earth: model(0, -0.641, 90, -0.557, 190.147, 360.9856235),
  mars: model(317.68143, -0.1061, 52.8865, -0.0609, 176.63, 350.89198226),
  jupiter: model(268.056595, -0.006499, 64.495303, 0.002413, 284.95, 870.536),
  saturn: model(40.589, -0.036, 83.537, -0.004, 38.9, 810.7939024),
  uranus: model(257.311, 0, -15.175, 0, 203.81, -501.1600928),
  neptune: model(299.36, 0, 43.46, 0, 249.978, 541.1397757),
};

/** A body's axes at an instant, as unit vectors in the ecliptic J2000 frame. */
export type BodyAxes = {
  /** Towards its north pole. */
  pole: Vector3;
  /** Towards longitude 0 on its equator (the prime meridian). */
  meridian: Vector3;
  /** Towards longitude 90° east on its equator. */
  east: Vector3;
};

const DAY = 86_400;
const CENTURY_DAYS = 36_525;

/**
 * Where a body's pole and prime meridian point at an instant.
 * @param tdbSeconds TDB seconds since J2000.
 */
export function bodyAxes(rotation: RotationModel, tdbSeconds: number): BodyAxes {
  const days = tdbSeconds / DAY;
  const centuries = days / CENTURY_DAYS;
  const raDeg = rotation.poleRaDeg + rotation.poleRaPerCentury * centuries;
  const decDeg = rotation.poleDecDeg + rotation.poleDecPerCentury * centuries;
  const ra = radians(raDeg);
  const w = radians(rotation.meridianDeg + rotation.meridianPerDay * days);

  const pole = equatorialDirection(raDeg, decDeg);
  // W is measured along the body's equator from where it crosses the ICRF equator going
  // north (the ascending node), which lies 90° of right ascension past the pole's.
  const node: Vector3 = [-Math.sin(ra), Math.cos(ra), 0];
  const meridian = combine(Math.cos(w), node, Math.sin(w), cross(pole, node));
  return {
    pole: equatorialToEcliptic(pole),
    meridian: equatorialToEcliptic(meridian),
    east: equatorialToEcliptic(cross(pole, meridian)),
  };
}
