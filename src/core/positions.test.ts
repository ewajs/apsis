import { describe, expect, it } from 'vitest';
import io from '../../tests/fixtures/horizons/io-elements.json';
import { CHUNK_FORMAT, trackByYear, type Chunk, type Sample } from './ephemeris.ts';
import { positionFromSamples } from './elements.ts';
import { parseElementSeries } from './horizons.ts';
import { distance, length, subtract } from './math.ts';
import { positionAt, velocityAt, type World } from './positions.ts';

const samples = parseElementSeries(io);
const [t0] = samples[0]!;
const t1 = samples.at(-1)![0];
// Jupiter on a straight line through the two days (enough to test the sum).
const jupiterStates: Sample[] = [
  [t0, 7e8, 2e8, -1e7, -3, 12, 0.1],
  [t1, 7e8 - 3 * (t1 - t0), 2e8 + 12 * (t1 - t0), -1e7 + 0.1 * (t1 - t0), -3, 12, 0.1],
];
const jupiter: Chunk = {
  format: CHUNK_FORMAT,
  body: 'jupiter',
  horizonsId: '599',
  year: 2026,
  samples: jupiterStates,
};
const world: World = new Map([
  ['jupiter', { states: new Map([[2026, jupiter]]) }],
  [
    'io',
    {
      states: new Map(),
      track: {
        center: 'jupiter',
        chunks: new Map(trackByYear(samples, 'io', 'jupiter').map((c) => [c.year, c])),
      },
    },
  ],
]);

describe('positionAt', () => {
  it('puts a moon at its parent plus its offset from its orbital elements', () => {
    const t = t0 + 6 * 3600;
    const parent = positionAt('jupiter', t, world)!;
    const moon = positionAt('io', t, world)!;
    expect(distance(subtract(moon, parent), positionFromSamples(samples, t)!)).toBeLessThan(1e-6);
    // Io circles about 422,000 km out.
    expect(distance(moon, parent)).toBeCloseTo(422_000, -4);
  });

  it('knows the Sun, and nothing it has no data for', () => {
    expect(positionAt('sun', t0, world)).toEqual([0, 0, 0]);
    expect(positionAt('pluto', t0, world)).toBeNull();
    expect(positionAt('io', t1 + 86_400, world)).toBeNull();
  });
});

describe('velocityAt', () => {
  it('takes a state’s velocity, or works one out along a track', () => {
    const t = t0 + 3600;
    expect(velocityAt('jupiter', t, world)).toEqual([-3, 12, 0.1]);
    const relative = subtract(velocityAt('io', t, world)!, [-3, 12, 0.1]);
    // Io's orbital speed: about 17.3 km/s.
    expect(length(relative)).toBeCloseTo(17.3, 0);
  });
});
