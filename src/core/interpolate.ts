/**
 * A body's state at any instant, from samples taken at a coarser step (ADR 0003).
 * See docs/guides/interpolation.md for how cubic Hermite interpolation works.
 */
import { yearOf, type Chunk, type Sample } from './ephemeris.ts';

/**
 * The state between two samples, by cubic Hermite interpolation: on each axis, the
 * cubic polynomial that passes through both positions with both velocities as its
 * slopes. The velocity returned is that cubic's derivative.
 * @param a The sample at or before `t`.
 * @param b The sample at or after `t`, later than `a`.
 * @param t TDB seconds since J2000, between `a` and `b`.
 */
export function hermite(a: Sample, b: Sample, t: number): Sample {
  const h = b[0] - a[0];
  const s = (t - a[0]) / h; // 0 at a, 1 at b
  const s2 = s * s;
  const s3 = s2 * s;
  // The four Hermite basis functions, and their derivatives with respect to s.
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  const d00 = 6 * s2 - 6 * s;
  const d10 = 3 * s2 - 4 * s + 1;
  const d01 = -6 * s2 + 6 * s;
  const d11 = 3 * s2 - 2 * s;

  const state: number[] = [t];
  for (let axis = 1; axis <= 3; axis++) {
    const p0 = a[axis]!;
    const p1 = b[axis]!;
    // Velocities are per second; the basis works per interval, hence the h.
    const m0 = a[axis + 3]! * h;
    const m1 = b[axis + 3]! * h;
    state[axis] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
    state[axis + 3] = (d00 * p0 + d10 * m0 + d01 * p1 + d11 * m1) / h;
  }
  return state as unknown as Sample;
}

/**
 * The state at `t` from samples in time order, or `null` when `t` is outside them:
 * we never extrapolate.
 */
export function stateAt(samples: readonly Sample[], t: number): Sample | null {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last || t < first[0] || t > last[0]) return null;

  // Binary search for the last sample at or before t.
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (samples[middle]![0] <= t) low = middle;
    else high = middle - 1;
  }
  const before = samples[low]!;
  if (before[0] === t || low === samples.length - 1) return before;
  return hermite(before, samples[low + 1]!, t);
}

/**
 * The state at `t` from a body's yearly chunks, or `null` when no loaded chunk covers
 * it. Because each chunk ends with the next year's first sample, an instant early in
 * a year may fall at the end of the previous year's chunk.
 */
export function stateFromChunks(chunks: ReadonlyMap<number, Chunk>, t: number): Sample | null {
  const year = yearOf(t);
  for (const candidate of [year, year - 1]) {
    const chunk = chunks.get(candidate);
    const state = chunk && stateAt(chunk.samples, t);
    if (state) return state;
  }
  return null;
}
