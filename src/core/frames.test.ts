import { describe, expect, it } from 'vitest';
import { galacticAxes, toScene } from './frames.ts';
import { cross, dot, length, subtract, type Vector3 } from './math.ts';

// −0 and +0 are the same position; `toEqual` tells them apart, so normalise.
const plain = (v: Vector3) => v.map((n) => n + 0);

describe('toScene', () => {
  it('puts ecliptic north up', () => {
    expect(plain(toScene([0, 0, 1]))).toEqual([0, 1, 0]);
  });

  it('is a rotation, not a mirror: x × y still gives z', () => {
    const [x, y, z] = [toScene([1, 0, 0]), toScene([0, 1, 0]), toScene([0, 0, 1])];
    expect(plain(cross(x, y))).toEqual(plain(z));
  });
});

describe('the floating origin', () => {
  // Neptune is about 4.5 billion km from the Sun. A 32-bit float there can only step
  // by 256–512 km: a ship near Neptune would visibly jump between those steps.
  const neptune: Vector3 = [4_476_123_456.789, -123_456_789.123, 98_765_432.1];
  const nearby: Vector3 = [neptune[0] + 30_000.25, neptune[1] - 12_000.5, neptune[2] + 7.75];

  it('loses hundreds of km when absolute positions go to the GPU', () => {
    const error = Math.abs(Math.fround(nearby[0]) - nearby[0]);
    expect(error).toBeGreaterThan(1);
  });

  it('keeps metres when positions are made relative first', () => {
    for (const value of subtract(nearby, neptune)) {
      expect(Math.abs(Math.fround(value) - value)).toBeLessThan(0.01);
    }
  });
});

describe('galacticAxes', () => {
  const { centre, north, east } = galacticAxes();

  it('are perpendicular unit vectors, right-handed', () => {
    for (const axis of [centre, north, east]) expect(length(axis)).toBeCloseTo(1, 9);
    expect(dot(centre, north)).toBeCloseTo(0, 6);
    cross(north, centre).forEach((v, i) => expect(v).toBeCloseTo(east[i]!, 9));
  });

  it('put the galactic centre just south of the ecliptic, in Sagittarius', () => {
    // Ecliptic longitude about 266.8°, latitude about −5.6°.
    const latitude = (Math.asin(centre[2]) * 180) / Math.PI;
    const longitude = ((Math.atan2(centre[1], centre[0]) * 180) / Math.PI + 360) % 360;
    expect(latitude).toBeCloseTo(-5.6, 0);
    expect(longitude).toBeCloseTo(266.8, 0);
  });

  it('tilt the galactic plane about 60° to the ecliptic', () => {
    const tilt = (Math.acos(north[2]) * 180) / Math.PI;
    expect(tilt).toBeCloseTo(60.2, 0);
  });
});
