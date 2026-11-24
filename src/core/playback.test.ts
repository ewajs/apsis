import { describe, expect, it } from 'vitest';
import { advance, live, pausedAt, playing, SPEEDS } from './playback.ts';

const DAY_MS = 86_400_000;
const range = { startMs: 0, endMs: 100 * DAY_MS };

describe('playback', () => {
  it('follows the clock while live', () => {
    expect(advance(live(1_000), 16, 5_000)).toEqual(live(5_000));
  });

  it('stays put while paused', () => {
    const paused = pausedAt(10 * DAY_MS);
    expect(advance(paused, 1_000, 99, range)).toBe(paused);
  });

  it('moves a day per real second at "day" speed, either way', () => {
    const start = playing(pausedAt(50 * DAY_MS), SPEEDS.day);
    expect(advance(start, 2_000, 0, range).instantMs).toBe(52 * DAY_MS);
    const back = playing(start, -SPEEDS.week);
    expect(advance(back, 1_000, 0, range).instantMs).toBe(43 * DAY_MS);
  });

  it('pauses at the edge of the data instead of running past it', () => {
    const end = advance(playing(pausedAt(99 * DAY_MS), SPEEDS.month), 1_000, 0, range);
    expect(end).toEqual(pausedAt(100 * DAY_MS));
    const start = advance(playing(pausedAt(DAY_MS), -SPEEDS.week), 1_000, 0, range);
    expect(start).toEqual(pausedAt(0));
  });

  it('keeps a requested instant inside the data', () => {
    expect(pausedAt(-5, range).instantMs).toBe(0);
  });

  it('leaves "now" as soon as it plays', () => {
    expect(playing(live(5), SPEEDS.day).live).toBe(false);
  });

  it('makes a month a twelfth of a year', () => {
    expect(SPEEDS.month * 12).toBeCloseTo(365.25 * 86_400, 6);
  });
});
