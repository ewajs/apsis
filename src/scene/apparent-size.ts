/**
 * The minimum on-screen size (ADR 0005): every body is drawn at its true size or at
 * `MIN_DIAMETER_PX` on screen, whichever is larger. Pure.
 */

/** Smallest a planet ever looks, in CSS px across. */
export const MIN_DIAMETER_PX = 7;
/** The Sun stays a little larger, so it reads as the Sun from anywhere. */
export const SUN_MIN_DIAMETER_PX = 12;
/** Spacecraft are metres across: always this size, a little smaller than planets. */
export const CRAFT_MIN_DIAMETER_PX = 6;

/**
 * How many world units one screen pixel spans at `distance` from a perspective camera.
 * @param fovDeg The camera's vertical field of view.
 * @param viewportHeightPx The drawing's height in CSS px.
 */
export function unitsPerPixel(distance: number, fovDeg: number, viewportHeightPx: number): number {
  return (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / viewportHeightPx;
}

/**
 * The radius to draw a body at: its true radius, unless that would be smaller than
 * `minDiameterPx` on screen. With `trueScale`, always the true radius.
 */
export function displayRadius(
  trueRadius: number,
  distance: number,
  fovDeg: number,
  viewportHeightPx: number,
  minDiameterPx: number,
  trueScale: boolean,
): number {
  if (trueScale) return trueRadius;
  const minimum = (minDiameterPx / 2) * unitsPerPixel(distance, fovDeg, viewportHeightPx);
  return Math.max(trueRadius, minimum);
}
