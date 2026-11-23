import { describe, expect, it } from 'vitest';
import earth from '../../tests/fixtures/horizons/earth-new-year.json';
import {
  assertValidSamples,
  chunkByYear,
  chunkPath,
  DATA_FORMAT,
  tdbSecondsFromJulianDate,
  yearOf,
  type Sample,
} from './ephemeris.ts';
import { parseVectors } from './horizons.ts';

const DAY = 86_400;
const at = (t: number): Sample => [t, 1, 2, 3, 0.1, 0.2, 0.3];

describe('time', () => {
  it('counts TDB seconds from J2000 (2000-01-01 12:00)', () => {
    expect(tdbSecondsFromJulianDate(2451545)).toBe(0);
    expect(tdbSecondsFromJulianDate(2451545.5)).toBe(DAY / 2);
  });

  it('finds the calendar year of an instant, at the boundary too', () => {
    const newYear2027 = tdbSecondsFromJulianDate(2461406.5); // 2027-01-01 00:00
    expect(yearOf(newYear2027 - 1)).toBe(2026);
    expect(yearOf(newYear2027)).toBe(2027);
    expect(yearOf(0)).toBe(2000);
  });
});

describe('chunkByYear', () => {
  it('splits at new year and repeats the next year’s first sample', () => {
    const samples = parseVectors(earth); // 2026-12-30 … 2027-01-02
    const chunks = chunkByYear(samples, { id: 'earth', horizonsId: '399' });
    expect(chunks.map((c) => c.year)).toEqual([2026, 2027]);
    expect(chunks[0]!.samples).toEqual(samples.slice(0, 3));
    expect(chunks[1]!.samples).toEqual(samples.slice(2));
    expect(chunks[0]).toMatchObject({ format: DATA_FORMAT, body: 'earth', horizonsId: '399' });
  });

  it('keeps a single year in one chunk', () => {
    const chunks = chunkByYear([at(0), at(DAY)], { id: 'x', horizonsId: '1' });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.samples).toHaveLength(2);
  });
});

describe('assertValidSamples', () => {
  it('accepts increasing, finite samples', () => {
    expect(() => assertValidSamples([at(0), at(DAY)], 'ok')).not.toThrow();
  });

  it('refuses too few, out-of-order or non-finite samples', () => {
    expect(() => assertValidSamples([at(0)], 'one')).toThrow(/need at least 2/);
    expect(() => assertValidSamples([at(DAY), at(DAY)], 'same')).toThrow(/not later/);
    expect(() => assertValidSamples([at(0), [DAY, NaN, 0, 0, 0, 0, 0]], 'nan')).toThrow(/finite/);
  });
});

describe('chunkPath', () => {
  it('keeps archived and live years apart', () => {
    expect(chunkPath('juno', { year: 2025, archived: true })).toBe('archive/juno/2025.json');
    expect(chunkPath('juno', { year: 2026, archived: false })).toBe('live/juno/2026.json');
  });
});
