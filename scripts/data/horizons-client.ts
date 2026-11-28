/**
 * Talking to Horizons from the data scripts: one request at a time, a generic
 * User-Agent, retries with backoff on 500/503 and network errors (ADR 0002).
 */
import { assertValidSamples, mergeSamples, type Sample } from '../../src/core/ephemeris.ts';
import type { ElementSample } from '../../src/core/elements.ts';
import {
  elementSeriesQuery,
  HORIZONS_API,
  parseElementSeries,
  parseVectors,
  vectorsQuery,
} from '../../src/core/horizons.ts';
import type { Body } from './bodies.ts';

/** Attempts per request, and the wait before the second (doubled each time). */
const ATTEMPTS = 4;
const FIRST_RETRY_MS = 2_000;
// Generic and honest: what the client is and where it lives, nothing about who runs it.
const USER_AGENT = 'apsis-data (+https://github.com/ewajs/apsis)';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GETs a Horizons URL as JSON, retrying what might fix itself. */
export async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      // 500 and 503 mean Horizons is busy or down: worth another try. Anything else
      // that isn't OK (400 bad request, 405) won't fix itself.
      if (response.ok) return await response.json();
      if (response.status !== 500 && response.status !== 503) {
        throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
      if (attempt >= ATTEMPTS) throw new Error(`HTTP ${response.status} after ${attempt} attempts`);
    } catch (error) {
      // Network errors (fetch rejects with TypeError) are retried too.
      if (!(error instanceof TypeError) || attempt >= ATTEMPTS) throw error;
    }
    await sleep(FIRST_RETRY_MS * 2 ** (attempt - 1));
  }
}

/**
 * A body's validated samples from `start` to `stop` (calendar dates, TDB), clipped to
 * its coverage: none when the span is outside it.
 */
export async function fetchSamples(
  body: Body,
  start: string,
  stop: string,
  step: string,
): Promise<Sample[]> {
  if (body.coverage) {
    if (body.coverage.from > start) start = body.coverage.from;
    if (body.coverage.to < stop) stop = body.coverage.to;
  }
  if (start >= stop) return [];
  const query = vectorsQuery({ horizonsId: body.horizonsId, start, stop, step });
  const samples = parseVectors(await fetchJson(`${HORIZONS_API}?${new URLSearchParams(query)}`));
  assertValidSamples(samples, body.id);
  return samples;
}

/**
 * A body's orbital elements around its parent from `start` to `stop` (calendar dates,
 * TDB), daily, clipped to its coverage (ADR 0015): none when the span is outside it.
 */
export async function fetchTrack(
  body: Body,
  start: string,
  stop: string,
): Promise<ElementSample[]> {
  if (!body.track) return [];
  if (body.coverage) {
    if (body.coverage.from > start) start = body.coverage.from;
    if (body.coverage.to < stop) stop = body.coverage.to;
  }
  if (start >= stop) return [];
  const query = elementSeriesQuery({
    horizonsId: body.horizonsId,
    start,
    stop,
    step: '1d',
    center: body.track.centerCode,
  });
  const samples = parseElementSeries(
    await fetchJson(`${HORIZONS_API}?${new URLSearchParams(query)}`),
  );
  samples.forEach((sample, i) => {
    if (!sample.every(Number.isFinite) || (i > 0 && sample[0] <= samples[i - 1]![0])) {
      throw new Error(`${body.id}: track sample ${i} is not in order or not finite`);
    }
  });
  return samples;
}

/** Days either side of an encounter sampled finely, and how finely. */
export const ENCOUNTER_DAYS = 3;
export const ENCOUNTER_STEP = '1h';

const DAY_MS = 86_400_000;
const shiftDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * A body's samples at `step`, with hourly samples for `ENCOUNTER_DAYS` either side of
 * each of its encounters that falls in the span (ADR 0011). Clipped like `fetchSamples`.
 */
export async function fetchWithEncounters(
  body: Body,
  start: string,
  stop: string,
  step: string,
): Promise<Sample[]> {
  let samples = await fetchSamples(body, start, stop, step);
  for (const day of body.encounters ?? []) {
    const from = shiftDays(day, -ENCOUNTER_DAYS);
    const to = shiftDays(day, ENCOUNTER_DAYS);
    if (to <= start || from >= stop) continue;
    const fine = await fetchSamples(
      body,
      from < start ? start : from,
      to > stop ? stop : to,
      ENCOUNTER_STEP,
    );
    samples = mergeSamples(samples, fine);
  }
  if (samples.length > 0) assertValidSamples(samples, body.id);
  return samples;
}
