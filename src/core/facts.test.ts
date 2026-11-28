import { describe, expect, it } from 'vitest';
import { earthOrbitFacts, factsAt } from './facts.ts';

describe('factsAt', () => {
  it('measures from the Sun and from Earth, and the speed around the Sun', () => {
    expect(factsAt([3e8, 4e8, 0], [3, 4, 12], [3e8, 0, 0])).toEqual({
      fromSunKm: 5e8,
      fromEarthKm: 4e8,
      speedKmS: 13,
    });
  });

  it('leaves the distance from Earth out without Earth', () => {
    expect(factsAt([1, 0, 0], [0, 0, 0], null).fromEarthKm).toBeNull();
  });
});

describe('earthOrbitFacts', () => {
  it('measures height above Earth’s mean radius and speed relative to Earth', () => {
    const earth = [1.5e8, 0, 0] as const;
    const facts = earthOrbitFacts(
      [1.5e8 + 6_791, 0, 0],
      [0, 29.78 + 7.66, 0],
      earth,
      [0, 29.78, 0],
    );
    expect(facts.altitudeKm).toBeCloseTo(420, 6);
    expect(facts.speedKmS).toBeCloseTo(7.66, 6);
  });
});
