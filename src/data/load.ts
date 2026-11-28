/**
 * Loads what `npm run data` built (ADR 0011): first the index, the catalogue and the
 * planet orbits, then each body's years on demand, as the shown instant needs them
 * (`ChunkStore`). See docs/guides/data.md.
 */
import type { Mission } from '../core/catalogue.ts';
import {
  CHUNK_FORMAT,
  chunkPath,
  DATA_FORMAT,
  TRACK_FORMAT,
  trackPath,
  type Chunk,
  type DataIndex,
  type TrackChunk,
  type YearEntry,
} from '../core/ephemeris.ts';
import type { World } from '../core/positions.ts';
import { parseModelIndex, type ModelEntry } from '../core/models.ts';
import { assertOrbitFile, type OrbitFile } from '../core/orbit-file.ts';

/** What's known before any positions load. */
export type Catalogue = { index: DataIndex; missions: Mission[]; orbits: OrbitFile };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Fetches the index, the catalogue and the orbits under `base` (the site's base URL plus
 * `data/`). Right after an app update, the service worker may still hold an index in
 * the previous format: then a fresh one is fetched, past the cache (the query string
 * makes it a different address).
 */
export async function loadCatalogue(base: string): Promise<Catalogue> {
  const [cached, missions, orbits] = await Promise.all([
    getJson<DataIndex>(`${base}index.json`),
    getJson<Mission[]>(`${base}catalogue.json`),
    getJson<unknown>(`${base}orbits.json`),
  ]);
  const index =
    cached.format === DATA_FORMAT
      ? cached
      : await getJson<DataIndex>(`${base}index.json?format=${DATA_FORMAT}`);
  if (index.format !== DATA_FORMAT) throw new Error(`index.json: format ${index.format}`);
  const planets = index.bodies.filter((body) => body.kind === 'planet').map((body) => body.id);
  assertOrbitFile(orbits, planets);
  return { index, missions, orbits };
}

/** Bodies' yearly chunks, fetched on demand and kept for the visit. */
export class ChunkStore {
  /**
   * Each body's loaded chunks, by year. The views hold these very maps, so a year that
   * arrives is there for them at once (then call their refresh).
   */
  readonly chunks = new Map<string, Map<number, Chunk>>();
  /** Each body's loaded track chunks (orbital elements around a parent), by year. */
  readonly tracks = new Map<string, Map<number, TrackChunk>>();
  /** Everything loaded, as `positionAt` reads it; it fills in as years arrive. */
  readonly world: World;
  #base: string;
  #index: DataIndex;
  #requested = new Set<string>();
  #pending = 0;

  constructor(base: string, index: DataIndex) {
    this.#base = base;
    this.#index = index;
    const world = new Map<string, World extends ReadonlyMap<string, infer D> ? D : never>();
    for (const body of index.bodies) {
      this.chunks.set(body.id, new Map());
      if (body.track) this.tracks.set(body.id, new Map());
      world.set(body.id, {
        states: this.chunks.get(body.id)!,
        track: body.track && { center: body.track.center, chunks: this.tracks.get(body.id)! },
      });
    }
    this.world = world;
  }

  /** Whether any year is still on its way. */
  get loading(): boolean {
    return this.#pending > 0;
  }

  /**
   * Makes sure every body's chunks for `years` are loaded (those it has). Resolves to
   * whether anything new arrived. Cheap to call often: years already loaded or on
   * their way are skipped.
   */
  async ensure(years: readonly number[]): Promise<boolean> {
    const wanted = (entries: readonly YearEntry[]) =>
      entries.filter((entry) => years.includes(entry.year));
    const loads = this.#index.bodies.flatMap((body) => [
      ...wanted(body.years).map((entry) =>
        this.#load(
          `${body.id}/${entry.year}`,
          chunkPath(body.id, entry),
          CHUNK_FORMAT,
          (chunk: Chunk) => this.chunks.get(body.id)!.set(entry.year, chunk),
        ),
      ),
      ...wanted(body.track?.years ?? []).map((entry) =>
        this.#load(
          `${body.id}/${entry.year}.track`,
          trackPath(body.id, entry),
          TRACK_FORMAT,
          (chunk: TrackChunk) => this.tracks.get(body.id)!.set(entry.year, chunk),
        ),
      ),
    ]);
    const arrived = await Promise.all(loads);
    return arrived.some(Boolean);
  }

  /** Fetches one file unless it's loaded or on its way; resolves to whether it fetched. */
  async #load<T extends { format: number }>(
    key: string,
    path: string,
    format: number,
    keep: (chunk: T) => void,
  ): Promise<boolean> {
    if (this.#requested.has(key)) return false;
    this.#requested.add(key);
    this.#pending++;
    try {
      const chunk = await getJson<T>(`${this.#base}${path}`);
      if (chunk.format !== format) throw new Error(`${key}: format ${chunk.format}`);
      keep(chunk);
      return true;
    } catch (error) {
      // Let a later call try again.
      this.#requested.delete(key);
      throw error;
    } finally {
      this.#pending--;
    }
  }
}

/**
 * The spacecraft models there are (`npm run models`, ADR 0013), from the models folder
 * `base`. Without the index (or if it fails to load), none: every spacecraft stays a
 * marker.
 */
export async function loadModels(base: string): Promise<ModelEntry[]> {
  try {
    return parseModelIndex(await getJson<unknown>(`${base}index.json`)).models;
  } catch (error) {
    console.error(error);
    return [];
  }
}
