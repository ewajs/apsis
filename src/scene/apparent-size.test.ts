import { describe, expect, it } from 'vitest';
import { displayRadius, unitsPerPixel } from './apparent-size.ts';

describe('unitsPerPixel', () => {
  it('spans the whole view height at the given distance', () => {
    // A 90° field of view at distance 1 is 2 units tall.
    expect(unitsPerPixel(1, 90, 800) * 800).toBeCloseTo(2, 12);
  });
});

describe('displayRadius', () => {
  const earth = 6_371;
  const au = 149_597_870.7;

  it('keeps a far planet visible: 7 px across from 3 AU away', () => {
    const radius = displayRadius(earth, 3 * au, 45, 800, 7, false);
    expect(radius).toBeGreaterThan(earth * 100);
    expect((2 * radius) / unitsPerPixel(3 * au, 45, 800)).toBeCloseTo(7, 9);
  });

  it('uses the true size up close', () => {
    expect(displayRadius(earth, 50_000, 45, 800, 7, false)).toBe(earth);
  });

  it('always uses the true size in true-scale mode', () => {
    expect(displayRadius(earth, 3 * au, 45, 800, 7, true)).toBe(earth);
  });
});
