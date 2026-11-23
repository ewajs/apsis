/**
 * Loads what `npm run data` wrote: the index, the catalogue, the planet orbits and
 * every chunk the index lists.
 * The live window is small (two years, about 260 KB), so everything loads at once;
 * loading years on demand comes with the time slider (M3).
 */
import type { Mission } from '../core/catalogue.ts';
import { DATA_FORMAT, type Chunk, type DataIndex } from '../core/ephemeris.ts';
import { assertOrbitFile, type OrbitFile } from '../core/orbit-file.ts';

/** Everything the app knows, ready to use. */
export type LiveData = {
  index: DataIndex;
  missions: Mission[];
  orbits: OrbitFile;
  /** Each body's chunks, by body id and then by year. */
  chunks: Map<string, Map<number, Chunk>>;
};

/**
 * Fetches the data under `base` (the site's base URL plus `data/`).
 * Throws when a file is missing or in a format this build doesn't read.
 */
export async function loadLiveData(base: string): Promise<LiveData> {
  const get = async <T>(file: string): Promise<T> => {
    const response = await fetch(`${base}${file}`);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return (await response.json()) as T;
  };

  const [index, missions, orbits] = await Promise.all([
    get<DataIndex>('index.json'),
    get<Mission[]>('catalogue.json'),
    get<unknown>('orbits.json'),
  ]);
  if (index.format !== DATA_FORMAT) throw new Error(`index.json: format ${index.format}`);
  const planets = index.bodies.filter((body) => body.kind === 'planet').map((body) => body.id);
  assertOrbitFile(orbits, planets);

  const chunks = new Map<string, Map<number, Chunk>>();
  await Promise.all(
    index.bodies.flatMap((body) =>
      body.years.map(async (year) => {
        const chunk = await get<Chunk>(`${body.id}/${year}.json`);
        if (chunk.format !== DATA_FORMAT)
          throw new Error(`${body.id}/${year}: format ${chunk.format}`);
        const years = chunks.get(body.id) ?? new Map<number, Chunk>();
        years.set(year, chunk);
        chunks.set(body.id, years);
      }),
    ),
  );
  return { index, missions, orbits, chunks };
}
