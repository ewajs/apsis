import { describe, expect, it } from 'vitest';
import { KM_PER_AU, kmToAu, lightTimeSeconds } from './units.ts';

describe('units', () => {
  it('converts kilometres to astronomical units', () => {
    expect(kmToAu(KM_PER_AU)).toBe(1);
    expect(kmToAu(0)).toBe(0);
  });

  it('gives the light-time of one AU as 8 min 19 s', () => {
    expect(lightTimeSeconds(KM_PER_AU)).toBeCloseTo(499.005, 3);
  });
});
