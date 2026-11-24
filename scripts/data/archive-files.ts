/** The committed archive (ADR 0011): `data/archive/<body>/<year>.json`. */
import { existsSync, readdirSync } from 'node:fs';

/** Where the archive is committed. */
export const ARCHIVE_DIR = new URL('../../data/archive/', import.meta.url);

/** The years already archived for a body, in order. */
export function archivedYears(body: string): number[] {
  const dir = new URL(`${body}/`, ARCHIVE_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((file) => /^(\d{4})\.json$/.exec(file)?.[1])
    .filter((year): year is string => year !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}
