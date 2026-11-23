/**
 * Where a body has been: the stretch of its path both views draw behind a spacecraft.
 * Pure.
 */
import { position, type Chunk } from './ephemeris.ts';
import { stateFromChunks } from './interpolate.ts';
import type { Vector3 } from './math.ts';

/** How much of a spacecraft's past path the views draw, in days. */
export const TRAIL_DAYS = 30;
const DAY = 86_400;

/**
 * A body's positions over the `TRAIL_DAYS` before `time`, one a day, oldest first and
 * ending at `time`. Days without data are skipped, so the trail can be shorter.
 */
export function trailPoints(chunks: ReadonlyMap<number, Chunk>, time: number): Vector3[] {
  const points: Vector3[] = [];
  for (let day = TRAIL_DAYS; day >= 0; day--) {
    const state = stateFromChunks(chunks, time - day * DAY);
    if (state) points.push(position(state));
  }
  return points;
}
