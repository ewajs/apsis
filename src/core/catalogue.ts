/**
 * The mission catalogue (ADR 0009): what `data/catalogue.yaml` holds, and its
 * validation. Pure: the YAML is parsed at the edge and handed in as plain data.
 */

/** Text in both languages Apsis speaks (ADR 0006). */
export type Localized = { es: string; en: string };

/**
 * A date as precise as we know it: `YYYY-MM-DD`, `YYYY-MM` or `YYYY`. Plans are often
 * only known to the month or the year ("arrives in 2029").
 */
export type LooseDate = string;

/**
 * Something that happened or will happen to a mission. An `encounter` (a flyby, a
 * perihelion, an arrival) gets hourly samples for three days either side, so close
 * passes are drawn right (ADR 0011); it needs an exact day.
 */
export type Milestone = { date: LooseDate; encounter?: boolean } & Localized;

/** One spacecraft, as the catalogue describes it. */
export type Mission = {
  /** Stable slug, used in URLs and data file names. */
  id: string;
  name: string;
  agency: string;
  launch: string;
  target: Localized;
  status: 'active' | 'ended';
  /** The Horizons ID, or `null` when there is no public ephemeris. */
  horizons: string | null;
  /** Why there is no ephemeris; present exactly when `horizons` is `null`. */
  noEphemeris?: Localized;
  /** The span Horizons covers, as calendar dates; fetches are clipped to it. */
  coverage?: { from: string; to: string };
  /** In date order. The UI shows the ones around the displayed instant. */
  milestones: Milestone[];
  blurb: Localized;
  links: string[];
};

/** The catalogue failed validation; `problems` lists every reason, with its place. */
export class CatalogueError extends Error {
  override name = 'CatalogueError';
  /** Every problem found, each starting with the entry it is in. */
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Catalogue has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    this.problems = problems;
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LOOSE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HORIZONS_ID = /^-?\d+$/;

/**
 * Checks parsed catalogue data and returns it typed. Collects every problem before
 * throwing a `CatalogueError`, so one run shows everything to fix.
 */
export function parseCatalogue(data: unknown): Mission[] {
  const problems: string[] = [];
  if (!Array.isArray(data)) throw new CatalogueError(['the catalogue must be a list of missions']);

  const seen = new Set<string>();
  data.forEach((entry: unknown, index) => {
    const where = `entry ${index + 1}${isRecord(entry) && typeof entry.id === 'string' ? ` (${entry.id})` : ''}`;
    const problem = (text: string) => problems.push(`${where}: ${text}`);
    if (!isRecord(entry)) return problem('must be a mapping');

    const text = (key: string) => {
      if (typeof entry[key] !== 'string' || entry[key].trim() === '') problem(`${key} is required`);
    };
    const localized = (value: unknown, key: string) => {
      if (!isRecord(value)) return problem(`${key} needs es and en`);
      for (const lang of ['es', 'en']) {
        if (typeof value[lang] !== 'string' || value[lang].trim() === '') {
          problem(`${key}.${lang} is missing`);
        }
      }
    };

    text('id');
    if (typeof entry.id === 'string') {
      if (!SLUG.test(entry.id)) problem('id must be lowercase words joined by hyphens');
      if (seen.has(entry.id)) problem('id is used twice');
      seen.add(entry.id);
    }
    text('name');
    text('agency');
    if (typeof entry.launch !== 'string' || !DAY.test(entry.launch)) {
      problem('launch must be YYYY-MM-DD');
    }
    localized(entry.target, 'target');
    if (entry.status !== 'active' && entry.status !== 'ended') {
      problem('status must be active or ended');
    }

    if (entry.horizons === null) {
      if (entry.noEphemeris === undefined) problem('horizons is null, so noEphemeris must say why');
      else localized(entry.noEphemeris, 'noEphemeris');
    } else if (typeof entry.horizons !== 'string' || !HORIZONS_ID.test(entry.horizons)) {
      problem('horizons must be an ID such as "-61" (quoted), or null');
    } else {
      if (entry.noEphemeris !== undefined) problem('noEphemeris is only for horizons: null');
      const coverage = entry.coverage;
      if (!isRecord(coverage) || !isDay(coverage.from) || !isDay(coverage.to)) {
        problem('coverage needs from and to, as YYYY-MM-DD');
      } else if (coverage.from >= coverage.to) {
        problem('coverage.from must come before coverage.to');
      }
    }

    if (!Array.isArray(entry.milestones)) {
      problem('milestones must be a list (it can be empty)');
    } else {
      let previous = '';
      entry.milestones.forEach((milestone: unknown, i) => {
        const key = `milestones[${i}]`;
        if (!isRecord(milestone)) return problem(`${key} must be a mapping`);
        if (milestone.encounter !== undefined && typeof milestone.encounter !== 'boolean') {
          problem(`${key}.encounter must be true or false`);
        }
        if (typeof milestone.date !== 'string' || !LOOSE.test(milestone.date)) {
          problem(`${key}.date must be YYYY-MM-DD, YYYY-MM or YYYY`);
        } else if (milestone.encounter === true && !DAY.test(milestone.date)) {
          problem(`${key} is an encounter, so its date needs a day (YYYY-MM-DD)`);
        } else {
          if (milestone.date < previous) problem(`${key} is out of date order`);
          previous = milestone.date;
        }
        localized(milestone, key);
      });
    }

    localized(entry.blurb, 'blurb');
    if (
      !Array.isArray(entry.links) ||
      entry.links.length === 0 ||
      !entry.links.every((link) => typeof link === 'string' && link.startsWith('https://'))
    ) {
      problem('links must list at least one https:// address');
    }
  });

  if (problems.length > 0) throw new CatalogueError(problems);
  return data as Mission[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDay(value: unknown): value is string {
  return typeof value === 'string' && DAY.test(value);
}

const DAY_MS = 86_400_000;

/**
 * The instant nearest `instantMs` (UTC ms) that the mission has positions for: itself
 * when it's inside the coverage, or else a day inside its nearer end, clear of the last
 * sample. A mission without a known coverage keeps the instant.
 * @example instantWithData(cassini, Date.UTC(2026, 0, 1)) // 2017-09-14, its last day
 */
export function instantWithData(mission: Mission, instantMs: number): number {
  if (!mission.coverage) return instantMs;
  const from = Date.parse(`${mission.coverage.from}T00:00Z`) + DAY_MS;
  const to = Date.parse(`${mission.coverage.to}T00:00Z`) - DAY_MS;
  return Math.min(to, Math.max(from, instantMs));
}
