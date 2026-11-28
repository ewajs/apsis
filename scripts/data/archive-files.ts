/**
 * The committed archive (ADR 0011): `data/archive/<body>/<year>.json`, and a track's
 * orbital elements beside it, `<year>.track.json` (ADR 0015).
 */
import { existsSync, readdirSync } from 'node:fs';

/** Where the archive is committed. */
export const ARCHIVE_DIR = new URL('../../data/archive/', import.meta.url);

/** The years already archived for a body, in order: its states, or its track. */
export function archivedYears(body: string, what: 'states' | 'track' = 'states'): number[] {
  const dir = new URL(`${body}/`, ARCHIVE_DIR);
  if (!existsSync(dir)) return [];
  const pattern = what === 'track' ? /^(\d{4})\.track\.json$/ : /^(\d{4})\.json$/;
  return readdirSync(dir)
    .map((file) => pattern.exec(file)?.[1])
    .filter((year): year is string => year !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}
