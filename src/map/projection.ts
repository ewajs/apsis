/**
 * Where a body goes on the 2D map: a top-down view of the ecliptic plane, with
 * distances from the Sun on a logarithmic or a linear scale (docs/guides/map.md).
 * Pure: positions in, unit-disc coordinates out.
 */
import { KM_PER_AU } from '../core/units.ts';

/** How the map turns distance from the Sun into distance from the centre. */
export type MapScale = 'log' | 'linear';

/**
 * Below this distance the log scale turns almost linear, so the Sun's neighbourhood
 * (Parker at 0.05 AU) doesn't collapse into the centre.
 */
export const LOG_KNEE_AU = 0.1;

/** The log map's edge: room for Voyager 1 and 2 for years to come. */
export const LOG_EDGE_AU = 200;

/** Distances that get a labelled ring on the log map. */
export const LOG_RINGS_AU = [0.1, 1, 10, 100] as const;

/**
 * How far out a distance sits, from 0 at the Sun to 1 at the map's edge.
 * @param linearEdgeAu The distance at the edge of the linear map.
 * @example radialFraction(LOG_EDGE_AU, 'log', 1) // 1
 */
export function radialFraction(au: number, scale: MapScale, linearEdgeAu: number): number {
  if (scale === 'linear') return au / linearEdgeAu;
  return Math.log10(1 + au / LOG_KNEE_AU) / Math.log10(1 + LOG_EDGE_AU / LOG_KNEE_AU);
}

/** A point on the map's unit disc: +x along the vernal equinox, +y 90° ahead in the ecliptic. */
export type MapPoint = { x: number; y: number };

/**
 * A heliocentric ecliptic position (km) seen from above the ecliptic's north pole.
 * Height above the plane is dropped; the direction is kept and the in-plane distance
 * goes through the scale.
 */
export function mapPoint(
  xKm: number,
  yKm: number,
  scale: MapScale,
  linearEdgeAu: number,
): MapPoint {
  const km = Math.hypot(xKm, yKm);
  if (km === 0) return { x: 0, y: 0 };
  const fraction = radialFraction(km / KM_PER_AU, scale, linearEdgeAu);
  return { x: (xKm / km) * fraction, y: (yKm / km) * fraction };
}
