import { describe, expect, it } from 'vitest';
import { yearsToLoad } from './loading.ts';

describe('yearsToLoad', () => {
  it('loads just the year shown in mid-year', () => {
    expect(yearsToLoad(Date.UTC(2026, 5, 15), 0)).toEqual([2026]);
  });

  it('adds last year while the trail reaches back across New Year', () => {
    expect(yearsToLoad(Date.UTC(2026, 0, 10), 0)).toEqual([2025, 2026]);
    expect(yearsToLoad(Date.UTC(2026, 1, 15), 0)).toEqual([2026]);
  });

  it('fetches ahead in the direction of play, near a year’s edge', () => {
    expect(yearsToLoad(Date.UTC(2026, 11, 1), 86_400)).toEqual([2026, 2027]);
    expect(yearsToLoad(Date.UTC(2026, 11, 1), -86_400)).toEqual([2026]);
    expect(yearsToLoad(Date.UTC(2026, 1, 20), -86_400)).toEqual([2025, 2026]);
    expect(yearsToLoad(Date.UTC(2026, 11, 1), 0)).toEqual([2026]);
  });
});
