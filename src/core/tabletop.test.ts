import { describe, expect, it } from 'vitest';
import { RADIUS_KM } from './bodies.ts';
import { KM_PER_AU } from './units.ts';
import { TABLE_RADIUS_M, tableRadius, tableSpot } from './tabletop.ts';

describe('the tabletop', () => {
  it('spreads the planets across the table on the map’s log scale', () => {
    const [x, y, z] = tableSpot([KM_PER_AU, 0, 0]);
    expect(x).toBeCloseTo(0.189, 3);
    expect(y).toBe(0);
    expect(z).toBe(0);
    // The log scale's edge (200 AU) is the table's.
    expect(tableSpot([200 * KM_PER_AU, 0, 0])[0]).toBeCloseTo(TABLE_RADIUS_M, 12);
    expect(tableSpot([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('keeps the real angle above the ecliptic', () => {
    const [x, , z] = tableSpot([100 * KM_PER_AU, 0, 70 * KM_PER_AU]);
    expect(z / x).toBeCloseTo(0.7, 12);
  });

  it('draws planets big enough to see, still in order of size', () => {
    const size = (id: string) => tableRadius(id, RADIUS_KM[id]!);
    expect(size('mercury')).toBeCloseTo(0.0063, 3);
    expect(size('jupiter')).toBeCloseTo(0.015, 3);
    expect(size('earth')).toBeGreaterThan(size('mars'));
    expect(size('sun')).toBe(0.03);
  });
});
