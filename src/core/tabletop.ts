/**
 * The solar system laid out on a table, for AR (ADR 0014): where each body goes and how
 * big it's drawn, in metres. Distances from the Sun use the map's log scale, so Mercury
 * to Neptune fits on a table; sizes are enlarged, on a log scale too, so a planet is
 * something you can see and still tell from the others. Pure.
 */
import type { Vector3 } from './math.ts';
import { radialFraction } from './projection.ts';

/** The table's radius in metres: the log scale's edge (200 AU) lands here. */
export const TABLE_RADIUS_M = 0.6;
/** The Sun, drawn this big. */
const SUN_RADIUS_M = 0.03;
/** A spacecraft, drawn this big (a bead). */
export const CRAFT_RADIUS_M = 0.003;

/**
 * Where a body at `position` (heliocentric ecliptic km) goes on the table, in metres in
 * the same axes (x and y across the table, z up). Its height keeps the real angle above
 * the ecliptic: Voyager 1 still climbs away at 35°.
 */
export function tableSpot([x, y, z]: Vector3): Vector3 {
  const inPlaneKm = Math.hypot(x, y);
  if (inPlaneKm === 0) return [0, 0, 0];
  const radiusM = radialFraction(inPlaneKm / 149_597_870.7, 'log', 1) * TABLE_RADIUS_M;
  const k = radiusM / inPlaneKm;
  return [x * k, y * k, z * k];
}

/**
 * How big a body is drawn on the table, in metres: the Sun 3 cm, a planet from 6 mm
 * (Mercury) to 15 mm (Jupiter), in step with the logarithm of its true radius.
 */
export function tableRadius(id: string, radiusKm: number): number {
  if (id === 'sun') return SUN_RADIUS_M;
  return 0.004 + 0.006 * Math.log10(radiusKm / 1000);
}
