import { describe, expect, it } from 'vitest';
import earthNewYear from '../../tests/fixtures/horizons/earth-new-year.json';
import { position } from './ephemeris.ts';
import { parseVectors } from './horizons.ts';
import { dot, length, scale, type Vector3 } from './math.ts';
import { bodyAxes, ROTATION } from './rotation.ts';

const degrees = (rad: number) => (rad * 180) / Math.PI;
const angleBetween = (a: Vector3, b: Vector3) => degrees(Math.acos(dot(a, b)));
const NORTH: Vector3 = [0, 0, 1]; // ecliptic north

describe('bodyAxes', () => {
  it('returns three perpendicular unit vectors', () => {
    const { pole, meridian, east } = bodyAxes(ROTATION.saturn!, 1e8);
    for (const axis of [pole, meridian, east]) expect(length(axis)).toBeCloseTo(1, 12);
    expect(dot(pole, meridian)).toBeCloseTo(0, 12);
    expect(dot(pole, east)).toBeCloseTo(0, 12);
    expect(dot(meridian, east)).toBeCloseTo(0, 12);
  });

  it('tilts each planet by its known obliquity (to within its orbit’s own tilt)', () => {
    // Angle between the pole and ecliptic north. Each planet's orbit is itself tilted a
    // little against the ecliptic, hence the ranges.
    const tilt = (id: string) => angleBetween(bodyAxes(ROTATION[id]!, 0).pole, NORTH);
    expect(tilt('earth')).toBeCloseTo(23.44, 1);
    expect(tilt('mars')).toBeGreaterThan(24);
    expect(tilt('mars')).toBeLessThan(28);
    expect(tilt('saturn')).toBeGreaterThan(24);
    expect(tilt('saturn')).toBeLessThan(30);
    // The IAU's "north" pole is the one on the north side of the solar system's plane,
    // whichever way the body spins. Uranus lies on its side: its north pole is 82° from
    // ecliptic north (the textbook 97.8° measures the same axis by the right-hand rule).
    // Uranus and Venus spin backwards, so their meridians turn the other way.
    expect(tilt('uranus')).toBeGreaterThan(80);
    expect(tilt('uranus')).toBeLessThan(84);
    expect(tilt('venus')).toBeLessThan(5);
    expect(ROTATION.uranus!.meridianPerDay).toBeLessThan(0);
    expect(ROTATION.venus!.meridianPerDay).toBeLessThan(0);
  });

  it('puts the Sun over the antimeridian at Greenwich midnight, at the December solstice latitude', () => {
    // 2026-12-30 00:00 TDB is 23:58:51 UTC on 29 December: almost midnight at Greenwich,
    // so the Sun is overhead near longitude 180°, off by at most the equation of time
    // (about a degree). Its latitude is the Sun's declination then, about −23.2°.
    const sample = parseVectors(earthNewYear)[0]!;
    const toSun = scale(position(sample), -1 / length(position(sample)));
    const { pole, meridian, east } = bodyAxes(ROTATION.earth!, sample[0]);
    const longitude = degrees(Math.atan2(dot(toSun, east), dot(toSun, meridian)));
    const latitude = degrees(Math.asin(dot(toSun, pole)));
    expect(180 - Math.abs(longitude)).toBeLessThan(2);
    expect(latitude).toBeCloseTo(-23.2, 0);
  });
});
