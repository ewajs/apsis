import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatDuration,
  formatInstant,
  formatLooseDate,
  formatSpeed,
} from './format.ts';

describe('formatInstant', () => {
  it('writes day, month, year and 24-hour time in that order, in both languages', () => {
    const instant = Date.UTC(2026, 10, 23, 20, 32);
    expect(formatInstant(instant, 'es-AR', 'UTC')).toBe('23 nov 2026 · 20:32');
    expect(formatInstant(instant, 'en', 'UTC')).toBe('23 Nov 2026 · 20:32');
  });

  it('pads day and hour, so the digits keep their places', () => {
    expect(formatInstant(Date.UTC(1979, 2, 5, 4, 7), 'es-AR', 'UTC')).toBe('05 mar 1979 · 04:07');
  });
});

describe('the card’s numbers', () => {
  it('writes distances in AU, or in km when small', () => {
    expect(formatDistance(779_000_000, 'es-AR', 'UA')).toBe('5,21 UA');
    expect(formatDistance(2.11e10, 'en', 'AU')).toBe('141 AU');
    expect(formatDistance(384_400, 'es-AR', 'UA')).toBe('384.000 km');
    expect(formatDistance(384_400, 'en', 'AU')).toBe('384,000 km');
  });

  it('writes how long light takes', () => {
    expect(formatDuration(499, 'en')).toBe('8 min 19 s');
    expect(formatDuration(82_000, 'en')).toBe('22 h 46 min');
    expect(formatDuration(1.28, 'es-AR')).toBe('1,3 s');
  });

  it('writes speeds in km/s', () => {
    expect(formatSpeed(29.78, 'es-AR')).toBe('29,8 km/s');
    expect(formatSpeed(16.99, 'en')).toBe('17 km/s');
  });

  it('writes catalogue dates as precise as they are', () => {
    expect(formatLooseDate('2016-07-05', 'es-AR')).toBe('5 jul 2016');
    expect(formatLooseDate('2016-07-05', 'en')).toBe('Jul 5, 2016');
    expect(formatLooseDate('2026-12', 'es-AR')).toBe('dic 2026');
    expect(formatLooseDate('2029', 'en')).toBe('2029');
  });
});
