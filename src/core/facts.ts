/**
 * What the mission card says about a body at one instant: how far it is from the Sun
 * and from Earth, and how fast it moves. Pure: positions in, numbers out (km, km/s).
 */
import { distance, length, type Vector3 } from './math.ts';

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
