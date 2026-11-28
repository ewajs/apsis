import { describe, expect, it } from 'vitest';
import iss from '../../tests/fixtures/celestrak/iss-gp.json';
import issVectors from '../../tests/fixtures/horizons/iss-earth-vectors.json';
import { gpEpochMs, parseGp, satellitePosition, type GpElements } from './earth-orbit.ts';
import { parseVectors } from './horizons.ts';
import { distance } from './math.ts';

// Recorded: CelesTrak's ISS elements of 28 Nov 2026, and Horizons' ISS around Earth's
// centre every 30 minutes for the day after.
const gp = (iss as GpElements[])[0]!;
const truth = parseVectors(issVectors);
const utcMs = (tdb: number) => Date.UTC(2000, 0, 1, 12) + (tdb - 69.184) * 1000;

describe('satellitePosition', () => {
  it('puts the ISS where Horizons does, approximately, for a day', () => {
    const errors = truth.map((sample) =>
      distance(satellitePosition(gp, utcMs(sample[0])), [sample[1], sample[2], sample[3]]),
    );
    expect(errors[0]!).toBeLessThan(20);
    expect(Math.max(...errors)).toBeLessThan(100);
  });

  it('keeps it at its altitude, some 400 km up', () => {
    const r = Math.hypot(...satellitePosition(gp, gpEpochMs(gp) + 3 * 3600_000));
    expect(r - 6_371).toBeGreaterThan(380);
    expect(r - 6_371).toBeLessThan(440);
  });
});

describe('parseGp', () => {
  it('keeps the fields it uses from CelesTrak’s answer', () => {
    const gp = parseGp(iss, 'iss');
    expect(gp.EPOCH).toBe('2026-11-28T00:58:03.424224');
    expect(gp.MEAN_MOTION).toBeCloseTo(15.4964, 4);
    expect(Object.keys(gp)).not.toContain('OBJECT_NAME');
  });

  it('refuses what isn’t one object’s elements', () => {
    expect(() => parseGp('No GP data found', 'iss')).toThrow(/one object/);
    expect(() => parseGp([], 'iss')).toThrow(/one object/);
    expect(() => parseGp([{ ...iss[0], EPOCH: 'soon' }], 'iss')).toThrow(/EPOCH/);
    expect(() => parseGp([{ ...iss[0], INCLINATION: null }], 'iss')).toThrow(/INCLINATION/);
    expect(() => parseGp([{ ...iss[0], ECCENTRICITY: 1.2 }], 'iss')).toThrow(/closed/);
  });
});
