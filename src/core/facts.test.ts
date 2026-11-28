import { describe, expect, it } from 'vitest';
import { factsAt } from './facts.ts';

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
