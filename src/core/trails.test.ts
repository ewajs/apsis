import { describe, expect, it } from 'vitest';
import { chunkByYear, type Chunk, type Sample } from './ephemeris.ts';
import { TRAIL_DAYS, trailPoints } from './trails.ts';

const DAY = 86_400;
// A body moving 1 km a day along x, sampled daily for 60 days from t = 0.
const samples: Sample[] = Array.from({ length: 61 }, (_, day) => [
  day * DAY,
  day,
  0,
  0,
  1 / DAY,
  0,
  0,
]);
const chunks = new Map<number, Chunk>(
  chunkByYear(samples, { id: 'x', horizonsId: '1' }).map((chunk) => [chunk.year, chunk]),
);

describe('trailPoints', () => {
  it('goes back TRAIL_DAYS, one point a day, ending now', () => {
    const points = trailPoints(chunks, 45 * DAY);
    expect(points).toHaveLength(TRAIL_DAYS + 1);
    expect(points[0]![0]).toBeCloseTo(45 - TRAIL_DAYS, 6);
    expect(points.at(-1)![0]).toBeCloseTo(45, 6);
  });

  it('is shorter where the data starts', () => {
    expect(trailPoints(chunks, 10 * DAY)).toHaveLength(11);
    expect(trailPoints(chunks, -DAY)).toEqual([]);
  });
});
