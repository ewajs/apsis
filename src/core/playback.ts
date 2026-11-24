/**
 * The displayed instant and how it moves (ADR 0011): paused, following now, or playing
 * at a rate, forwards or backwards. Pure: the clock's readings are passed in. See
 * docs/guides/time.md.
 */

/** Simulated seconds per real second, for the agreed speeds. */
export const SPEEDS = {
  realTime: 1,
  day: 86_400,
  week: 7 * 86_400,
  /** A mean month: a year's 365.25 days in twelve. */
  month: (365.25 / 12) * 86_400,
} as const;

/** A named speed. */
export type Speed = keyof typeof SPEEDS;

/** Where time is and how it moves. */
export type Playback = {
  /** The instant shown, in UTC ms since 1970 (as `Date.now()`). */
  instantMs: number;
  /** Simulated seconds per real second: 0 paused, negative backwards. */
  rate: number;
  /** Whether it follows the clock ("now"); then `instantMs` is the clock's reading. */
  live: boolean;
};

/** The span there's data for, in UTC ms; playing stops at its edges. */
export type Range = { startMs: number; endMs: number };

/** Following the clock: the instant is now, at real-time speed. */
export function live(nowMs: number): Playback {
  return { instantMs: nowMs, rate: SPEEDS.realTime, live: true };
}

/** Paused at an instant, kept inside `range`. */
export function pausedAt(instantMs: number, range?: Range): Playback {
  return { instantMs: clamp(instantMs, range), rate: 0, live: false };
}

/** Playing from where it is, at `rate` (negative to go backwards). Leaves "now". */
export function playing(playback: Playback, rate: number): Playback {
  return { instantMs: playback.instantMs, rate, live: false };
}

/**
 * Moves playback on by `elapsedMs` of real time. Following now, the instant is simply
 * the clock's reading. Playing, it moves by `rate × elapsed`, and pauses at the edge of
 * `range` rather than running past the data.
 */
export function advance(
  playback: Playback,
  elapsedMs: number,
  nowMs: number,
  range?: Range,
): Playback {
  if (playback.live) return live(nowMs);
  if (playback.rate === 0) return playback;
  const instantMs = playback.instantMs + playback.rate * elapsedMs;
  const clamped = clamp(instantMs, range);
  return clamped === instantMs ? { ...playback, instantMs } : pausedAt(clamped);
}

function clamp(instantMs: number, range?: Range): number {
  if (!range) return instantMs;
  return Math.min(range.endMs, Math.max(range.startMs, instantMs));
}
