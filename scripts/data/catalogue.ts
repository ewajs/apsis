import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { parseCatalogue, type Mission } from '../../src/core/catalogue.ts';

/** Where the hand-written catalogue lives. */
export const CATALOGUE_FILE = new URL('../../data/catalogue.yaml', import.meta.url);

/**
 * Reads and validates data/catalogue.yaml. YAML's core schema keeps dates as text
 * (2011-08-05 stays a string), which is what the catalogue wants.
 */
export function readCatalogue(file: URL = CATALOGUE_FILE): Mission[] {
  return parseCatalogue(parse(readFileSync(file, 'utf8')));
}
