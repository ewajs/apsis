/**
 * The spacecraft models the app can show (`public/models/index.json`, written by
 * `npm run models`; ADR 0013) and their validation. Pure.
 *
 * Every model shares one body frame, so the scene can turn any of them the same way:
 * metres, centred on the spacecraft's bus, **+Z along the high-gain antenna's
 * boresight** (where it points to talk to Earth) and **+Y along the solar arrays' axis**
 * where it has them.
 */

/** One spacecraft's model. */
export type ModelEntry = {
  /** The mission's catalogue id. */
  id: string;
  /** The GLB file, relative to the models folder. */
  file: string;
  /** Its largest dimension, in metres: how big it looks on screen. */
  lengthM: number;
  /**
   * Its size standing in AR, in metres: across, up, and front to back (`npm run models`
   * measures the AR copy). The card shows it before the real-size AR.
   */
  dimensionsM: [number, number, number];
  /** Who made it, as their credit asks: "NASA/JPL-Caltech". */
  credit: string;
  /** The licence, by name: "Public domain", "CC BY 4.0". */
  licence: string;
  /** Where it came from; absent for our own. */
  source?: string;
  /** Built by us, simplified, because no free model exists: the card says so. */
  ours: boolean;
  /**
   * What its +Z faces in flight: Earth (its antenna, most spacecraft) or the Sun (a heat
   * shield or sunshield: Parker, James Webb). Earth when absent.
   */
  pointing?: 'earth' | 'sun';
};

/** The models index. */
export type ModelIndex = { version: 1; models: ModelEntry[] };

/**
 * Checks a parsed `index.json` and returns it typed; throws with every problem found.
 */
export function parseModelIndex(data: unknown): ModelIndex {
  const problems: string[] = [];
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!record(data) || data.version !== 1 || !Array.isArray(data.models)) {
    throw new Error('models index: needs { version: 1, models: [...] }');
  }
  data.models.forEach((entry: unknown, i) => {
    const where = `models[${i}]`;
    if (!record(entry)) return problems.push(`${where} is not an object`);
    for (const key of ['id', 'file', 'credit', 'licence']) {
      if (typeof entry[key] !== 'string' || entry[key] === '')
        problems.push(`${where}.${key} is missing`);
    }
    if (typeof entry.lengthM !== 'number' || !(entry.lengthM > 0)) {
      problems.push(`${where}.lengthM must be a positive number of metres`);
    }
    const dimensions = entry.dimensionsM;
    if (
      !Array.isArray(dimensions) ||
      dimensions.length !== 3 ||
      !dimensions.every((size) => typeof size === 'number' && size > 0)
    ) {
      problems.push(`${where}.dimensionsM must be three positive numbers of metres`);
    }
    if (typeof entry.ours !== 'boolean') problems.push(`${where}.ours must be true or false`);
    if (entry.pointing !== undefined && entry.pointing !== 'earth' && entry.pointing !== 'sun') {
      problems.push(`${where}.pointing must be earth or sun`);
    }
    if (entry.source !== undefined && typeof entry.source !== 'string') {
      problems.push(`${where}.source must be a URL`);
    }
    return undefined;
  });
  if (problems.length > 0) throw new Error(`models index:\n  ${problems.join('\n  ')}`);
  return data as ModelIndex;
}
