/**
 * CelesTrak's orbital data for satellites around Earth (ADR 0016): one request per
 * satellite per data run, as CelesTrak asks (its data changes a few times a day at
 * most); any answer but 200 stops the run rather than retrying.
 */
import { parseGp, type GpElements } from '../../src/core/earth-orbit.ts';

const GP_URL = 'https://celestrak.org/NORAD/elements/gp.php';

/** One satellite's latest GP elements, by its catalogue number. */
export async function fetchSatellite(catalogueNumber: number, label: string): Promise<GpElements> {
  const url = `${GP_URL}?CATNR=${catalogueNumber}&FORMAT=json`;
  const response = await fetch(url, { headers: { 'User-Agent': 'apsis-data' } });
  if (!response.ok) throw new Error(`${label}: CelesTrak answered ${response.status} for ${url}`);
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // CelesTrak answers a plain sentence when it has nothing for a number.
    throw new Error(`${label}: CelesTrak said "${text.trim().slice(0, 120)}"`);
  }
  return parseGp(json, label);
}
