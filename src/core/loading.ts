/**
 * Which years of data to load for an instant (ADR 0011): the year shown, the previous
 * one while a trail still reaches back across New Year, and the next or previous one
 * near a year's edge in the direction of play. Pure.
 */
import { TRAIL_DAYS } from './trails.ts';

const DAY_MS = 86_400_000;
/** How close to a year's edge, while playing towards it, the next year is fetched. */
export const LOOKAHEAD_DAYS = 60;

/**
 * The calendar years (UTC) to have loaded for `instantMs`, played at `rate`
 * (simulated seconds per real second; 0 paused, negative backwards).
 * @example yearsToLoad(Date.UTC(2026, 5, 1), 0) // [2026]
 */
export function yearsToLoad(instantMs: number, rate: number): number[] {
  const year = new Date(instantMs).getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const startOfNext = Date.UTC(year + 1, 0, 1);
  const years = new Set([year]);
  // The trail looks back TRAIL_DAYS; early in a year that's last year's file.
  if (instantMs - startOfYear < (TRAIL_DAYS + 1) * DAY_MS) years.add(year - 1);
  if (rate > 0 && startOfNext - instantMs < LOOKAHEAD_DAYS * DAY_MS) years.add(year + 1);
  if (rate < 0 && instantMs - startOfYear < LOOKAHEAD_DAYS * DAY_MS) years.add(year - 1);
  return [...years].sort((a, b) => a - b);
}
