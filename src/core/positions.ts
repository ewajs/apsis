/**
 * Where any body is, from whatever data it has (ADR 0015): its track of orbital
 * elements around a parent when there's one for that instant, added to the parent's
 * position; otherwise its heliocentric states. Pure: data in, km out.
 */
import { position, yearOf, type Chunk, type TrackChunk } from './ephemeris.ts';
import { positionFromSamples, type ElementSample } from './elements.ts';
import { stateFromChunks } from './interpolate.ts';
import { add, scale, subtract, type Vector3 } from './math.ts';

/** A body's loaded data: heliocentric states by year, and its track, if it has one. */
export type BodyData = {
  states: ReadonlyMap<number, Chunk>;
  track?: { center: string; chunks: ReadonlyMap<number, TrackChunk> } | undefined;
};

/** Every body's loaded data, by id. The Sun needs none: it's the origin. */
export type World = ReadonlyMap<string, BodyData>;

/** Half the span used to estimate a velocity from positions, in seconds. */
const VELOCITY_SPAN_S = 60;

/**
 * The track sample in force at `t`: the latest at or before it (its ellipse is the one
 * to draw), or `null` outside the loaded years.
 */
export function trackSampleAt(
  chunks: ReadonlyMap<number, TrackChunk>,
  t: number,
): ElementSample | null {
  const year = yearOf(t);
  for (const candidate of [year, year - 1]) {
    const samples = chunks.get(candidate)?.samples;
    if (!samples?.length || t < samples[0]![0] || t > samples.at(-1)![0]) continue;
    let found = samples[0]!;
    for (const sample of samples) if (sample[0] <= t) found = sample;
    return found;
  }
  return null;
}

/** A track's offset from its parent at `t` (km), or `null` outside its loaded years. */
export function trackOffset(chunks: ReadonlyMap<number, TrackChunk>, t: number): Vector3 | null {
  const year = yearOf(t);
  // A year's chunk ends with the next year's first sample; just after New Year the
  // instant may still be in last year's.
  for (const candidate of [year, year - 1]) {
    const chunk = chunks.get(candidate);
    const at = chunk ? positionFromSamples(chunk.samples, t) : null;
    if (at) return at;
  }
  return null;
}

/**
 * Where body `id` is at `t` (TDB seconds since J2000), heliocentric ecliptic km; `null`
 * when nothing loaded covers that instant. Parents are looked up the same way.
 */
export function positionAt(id: string, t: number, world: World): Vector3 | null {
  if (id === 'sun') return [0, 0, 0];
  const body = world.get(id);
  if (!body) return null;
  if (body.track) {
    const offset = trackOffset(body.track.chunks, t);
    const parent = offset ? positionAt(body.track.center, t, world) : null;
    if (offset && parent) return add(parent, offset);
  }
  const state = stateFromChunks(body.states, t);
  return state ? position(state) : null;
}

/**
 * How fast and which way body `id` moves at `t`, relative to the Sun (km/s): from its
 * states, or across two positions a minute either side for a track.
 */
export function velocityAt(id: string, t: number, world: World): Vector3 | null {
  if (id === 'sun') return [0, 0, 0];
  const body = world.get(id);
  if (!body) return null;
  const state = body.track ? null : stateFromChunks(body.states, t);
  if (state) return [state[4], state[5], state[6]];
  const [before, after] = [
    positionAt(id, t - VELOCITY_SPAN_S, world),
    positionAt(id, t + VELOCITY_SPAN_S, world),
  ];
  return before && after ? scale(subtract(after, before), 1 / (2 * VELOCITY_SPAN_S)) : null;
}
