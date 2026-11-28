/**
 * Loads what `npm run data` built (ADR 0011): first the index, the catalogue and the
 * planet orbits, then each body's years on demand, as the shown instant needs them
 * (`ChunkStore`). See docs/guides/data.md.
 */
import type { Mission } from '../core/catalogue.ts';
import { chunkPath, DATA_FORMAT, type Chunk, type DataIndex } from '../core/ephemeris.ts';
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
  #base: string;
  #index: DataIndex;
  #requested = new Set<string>();
  #pending = 0;

  constructor(base: string, index: DataIndex) {
    this.#base = base;
    this.#index = index;
    for (const body of index.bodies) this.chunks.set(body.id, new Map());
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
    const loads = this.#index.bodies.flatMap((body) =>
      body.years
        .filter((entry) => years.includes(entry.year))
        .filter((entry) => !this.#requested.has(`${body.id}/${entry.year}`))
        .map(async (entry) => {
          this.#requested.add(`${body.id}/${entry.year}`);
          this.#pending++;
          try {
            const chunk = await getJson<Chunk>(`${this.#base}${chunkPath(body.id, entry)}`);
            if (chunk.format !== DATA_FORMAT) {
              throw new Error(`${body.id}/${entry.year}: format ${chunk.format}`);
            }
            this.chunks.get(body.id)!.set(entry.year, chunk);
          } catch (error) {
            // Let a later call try again.
            this.#requested.delete(`${body.id}/${entry.year}`);
            throw error;
          } finally {
            this.#pending--;
          }
        }),
    );
    await Promise.all(loads);
    return loads.length > 0;
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
