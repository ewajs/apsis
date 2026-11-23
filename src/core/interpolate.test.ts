import { describe, expect, it } from 'vitest';
import earthDaily from '../../tests/fixtures/horizons/earth-daily.json';
import earthHourly from '../../tests/fixtures/horizons/earth-hourly.json';
import parkerHourly from '../../tests/fixtures/horizons/parker-perihelion-hourly.json';
import { chunkByYear, type Chunk, type Sample } from './ephemeris.ts';
import { parseVectors } from './horizons.ts';
import { hermite, stateAt, stateFromChunks } from './interpolate.ts';

const HOUR = 3_600;
const distance = (a: Sample, b: Sample) => Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]);

/** The largest position error when interpolating `truth` from every `step`-th sample. */
function worstError(truth: Sample[], step: number): number {
  const coarse = truth.filter((_, i) => i % step === 0);
  return Math.max(
    ...truth.map((sample) => {
      const state = stateAt(coarse, sample[0]);
      return state ? distance(state, sample) : 0;
    }),
  );
}

describe('hermite', () => {
  it('reproduces any cubic exactly, with its derivative as the velocity', () => {
    // x(t) = t³ − 2t² + 3t + 5 on every axis, so v(t) = 3t² − 4t + 3.
    const x = (t: number) => t ** 3 - 2 * t ** 2 + 3 * t + 5;
    const v = (t: number) => 3 * t ** 2 - 4 * t + 3;
    const sample = (t: number): Sample => [t, x(t), x(t), x(t), v(t), v(t), v(t)];
    const state = hermite(sample(0), sample(2), 0.7);
    for (const value of state.slice(1, 4)) expect(value).toBeCloseTo(x(0.7), 10);
    for (const value of state.slice(4)) expect(value).toBeCloseTo(v(0.7), 10);
  });

  it('returns the samples themselves at both ends', () => {
    const [a, b] = parseVectors(earthDaily) as [Sample, Sample];
    hermite(a, b, a[0]).forEach((value, i) => expect(value).toBeCloseTo(a[i]!, 6));
    hermite(a, b, b[0]).forEach((value, i) => expect(value).toBeCloseTo(b[i]!, 6));
  });
});

// Against Horizons itself: daily samples, checked at every hour in between.
describe('accuracy against Horizons', () => {
  it('follows Earth to within 1 km from daily samples', () => {
    const daily = parseVectors(earthDaily);
    for (const truth of parseVectors(earthHourly)) {
      expect(distance(stateAt(daily, truth[0])!, truth)).toBeLessThan(1);
    }
  });

  it('improves about 16 times per halved step, as a cubic method should', () => {
    // Parker at perihelion: the hardest curve in the live data. Daily samples miss by
    // about 200,000 km there; see docs/guides/interpolation.md.
    const truth = parseVectors(parkerHourly);
    const errors = [24, 12, 6, 3].map((hours) => worstError(truth, hours));
    for (let i = 1; i < errors.length; i++) {
      expect(errors[i - 1]! / errors[i]!).toBeGreaterThan(7);
    }
    expect(errors[0]).toBeLessThan(250_000);
  });
});

describe('stateAt', () => {
  const samples = parseVectors(earthDaily);

  it('never extrapolates', () => {
    expect(stateAt(samples, samples[0]![0] - 1)).toBeNull();
    expect(stateAt(samples, samples.at(-1)![0] + 1)).toBeNull();
    expect(stateAt([], 0)).toBeNull();
  });

  it('is exact at a sample, including the last', () => {
    expect(stateAt(samples, samples[2]![0])).toEqual(samples[2]);
    expect(stateAt(samples, samples.at(-1)![0])).toEqual(samples.at(-1));
  });
});

describe('stateFromChunks', () => {
  const samples = parseVectors(earthDaily); // 2026-12-29 … 2027-01-03
  const chunks = new Map<number, Chunk>(
    chunkByYear(samples, { id: 'earth', horizonsId: '399' }).map((chunk) => [chunk.year, chunk]),
  );

  it('crosses New Year as if the data were one piece', () => {
    for (const hours of [12, 70, 73, 80]) {
      const t = samples[0]![0] + hours * HOUR;
      expect(stateFromChunks(chunks, t)).toEqual(stateAt(samples, t));
    }
  });

  it('finds an instant early in a year in the previous year’s chunk', () => {
    // Samples at noon: 2026-12-31 12:00 and 2027-01-01 12:00 (TDB), so 06:00 on New
    // Year's Day falls before the 2027 chunk's first sample.
    const newYear = 852_033_600; // 2027-01-01 00:00 TDB, seconds since J2000
    const noon = (offsetDays: number): Sample => [
      newYear + (offsetDays + 0.5) * 86_400,
      1,
      2,
      3,
      0,
      0,
      0,
    ];
    const split = new Map<number, Chunk>(
      chunkByYear([noon(-2), noon(-1), noon(0), noon(1)], { id: 'x', horizonsId: '1' }).map(
        (chunk) => [chunk.year, chunk],
      ),
    );
    expect([...split.keys()]).toEqual([2026, 2027]);
    expect(stateFromChunks(split, newYear + 6 * HOUR)).not.toBeNull();
  });

  it('has nothing to say outside the loaded years', () => {
    expect(stateFromChunks(chunks, samples[0]![0] - HOUR)).toBeNull();
    expect(stateFromChunks(new Map(), samples[0]![0])).toBeNull();
  });
});
