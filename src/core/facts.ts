/**
 * What the mission card says about a body at one instant: how far it is from the Sun
 * and from Earth, and how fast it moves. Pure: states in, numbers out (km, km/s).
 */
import { position, type Sample } from './ephemeris.ts';
import { distance, length } from './math.ts';

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
 * The facts for a body in `state` (heliocentric, as Horizons gives it), with Earth in
 * `earth`.
 */
export function factsAt(state: Sample, earth: Sample | null): Facts {
  return {
    fromSunKm: length(position(state)),
    fromEarthKm: earth ? distance(position(state), position(earth)) : null,
    speedKmS: Math.hypot(state[4], state[5], state[6]),
  };
}
