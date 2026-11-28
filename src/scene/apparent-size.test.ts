import { describe, expect, it } from 'vitest';
import {
  apparentPx,
  displayRadius,
  modelShows,
  nearPlaneKm,
  unitsPerPixel,
} from './apparent-size.ts';

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

describe('spacecraft models', () => {
  it('measures a length on screen', () => {
    // 45° field of view, 800 px tall: at 1 km, one px is about 1.04 m.
    expect(apparentPx(0.02, 1, 45, 800)).toBeCloseTo(19.3, 1);
  });

  it('shows the model once it outgrows the marker', () => {
    // Juno is about 20 m across: a model from roughly 3.3 km away on an 800 px screen.
    expect(modelShows(0.02, 3, 45, 800)).toBe(true);
    expect(modelShows(0.02, 4, 45, 800)).toBe(false);
  });

  it('brings the near plane in as the camera closes in', () => {
    expect(nearPlaneKm(3 * 1.5e8)).toBe(1);
    expect(nearPlaneKm(0.05)).toBeCloseTo(5e-5, 12);
    expect(nearPlaneKm(1e-9)).toBe(1e-6);
  });
});
