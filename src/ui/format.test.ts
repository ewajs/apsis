import { describe, expect, it } from 'vitest';
import { formatInstant } from './format.ts';

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
