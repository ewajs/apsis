import { describe, expect, it } from 'vitest';
import { TDB_MINUS_UTC_SECONDS, tdbSecondsFromUtcMs, utcMsFromTdbSeconds } from './time.ts';

describe('UTC and TDB', () => {
  it('puts a Horizons sample time where the clock reads 69.184 s earlier', () => {
    // 2026-11-20 00:00 TDB, the first sample in tests/fixtures/horizons/juno.json.
    const utc = Date.UTC(2026, 10, 19, 23, 58, 50, 816);
    expect(tdbSecondsFromUtcMs(utc)).toBeCloseTo(848_404_800, 6);
  });

  it('goes back and forth without loss', () => {
    const utc = Date.UTC(2026, 10, 22, 21, 30);
    expect(utcMsFromTdbSeconds(tdbSecondsFromUtcMs(utc))).toBeCloseTo(utc, 3);
  });

  it('uses the offset since the 2017 leap second', () => {
    expect(TDB_MINUS_UTC_SECONDS).toBe(37 + 32.184);
  });
});
