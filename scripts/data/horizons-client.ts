/**
 * Talking to Horizons from the data scripts: one request at a time, a generic
 * User-Agent, retries with backoff on 500/503 and network errors (ADR 0002).
 */
import { assertValidSamples, type Sample } from '../../src/core/ephemeris.ts';
import { HORIZONS_API, parseVectors, vectorsQuery } from '../../src/core/horizons.ts';
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
