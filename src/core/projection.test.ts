import { describe, expect, it } from 'vitest';
import { KM_PER_AU } from '../core/units.ts';
import { LOG_EDGE_AU, mapPoint, radialFraction } from './projection.ts';

describe('radialFraction', () => {
  it('puts the Sun at the centre and the edge distance at the edge', () => {
    expect(radialFraction(0, 'log', 1)).toBe(0);
    expect(radialFraction(LOG_EDGE_AU, 'log', 1)).toBeCloseTo(1, 12);
    expect(radialFraction(30, 'linear', 60)).toBe(0.5);
  });

  it('gives every planet room on the log scale', () => {
    const [mercury, earth, jupiter, neptune, voyager] = [0.39, 1, 5.2, 30, 172].map((au) =>
      radialFraction(au, 'log', 1),
    );
    // Mercury to Earth gets about as much room as Jupiter to Neptune.
    expect(earth! - mercury!).toBeGreaterThan(0.08);
    expect(neptune! - jupiter!).toBeGreaterThan(0.2);
    expect(voyager).toBeLessThan(1);
  });

  it('keeps growing below the knee, so Parker at perihelion is not at the Sun', () => {
    expect(radialFraction(0.046, 'log', 1)).toBeGreaterThan(0.04);
  });
});

describe('mapPoint', () => {
  it('keeps the direction and drops the height above the ecliptic', () => {
    const point = mapPoint(3 * KM_PER_AU, 4 * KM_PER_AU, 'linear', 10);
    expect(point.x).toBeCloseTo(0.3, 12);
    expect(point.y).toBeCloseTo(0.4, 12);
  });

  it('puts a body at the Sun at the centre', () => {
    expect(mapPoint(0, 0, 'log', 1)).toEqual({ x: 0, y: 0 });
  });
});
