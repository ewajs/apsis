/**
 * What the mission card says about a body at one instant: how far it is from the Sun
 * and from Earth, and how fast it moves. Pure: positions in, numbers out (km, km/s).
 */
import { distance, length, subtract, type Vector3 } from './math.ts';

/** A body's distances and speed at one instant. */
export type Facts = {
  /** From the Sun's centre, in km. */
  fromSunKm: number;
  /** From Earth's centre, in km; `null` without Earth's state. */
  fromEarthKm: number | null;
  /** Relative to the Sun, in km/s. */
  speedKmS: number;
};

/**
 * The facts for a body at `at` moving at `velocity` (heliocentric km and km/s), with
 * Earth at `earth`.
 */
export function factsAt(at: Vector3, velocity: Vector3, earth: Vector3 | null): Facts {
  return {
    fromSunKm: length(at),
    fromEarthKm: earth ? distance(at, earth) : null,
    speedKmS: length(velocity),
  };
}

/** A satellite's height and speed around Earth. */
export type EarthOrbitFacts = {
  /** Above Earth's mean radius, in km. */
  altitudeKm: number;
  /** Relative to Earth, in km/s. */
  speedKmS: number;
};

/** Earth's mean radius, in km: heights are measured from it. */
const EARTH_MEAN_RADIUS_KM = 6_371;

/**
 * A satellite's facts from its position and velocity and Earth's (all heliocentric, km
 * and km/s).
 */
export function earthOrbitFacts(
  at: Vector3,
  velocity: Vector3,
  earth: Vector3,
  earthVelocity: Vector3,
): EarthOrbitFacts {
  return {
    altitudeKm: distance(at, earth) - EARTH_MEAN_RADIUS_KM,
    speedKmS: length(subtract(velocity, earthVelocity)),
  };
}
