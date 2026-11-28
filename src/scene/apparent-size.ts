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
/** Moons, smaller still: they sit beside their planet and shouldn't crowd it. */
export const MOON_MIN_DIAMETER_PX = 4;

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

/**
 * How many CSS px a length spans on screen at `distance` (same units for both).
 * @example apparentPx(0.02, 1, 45, 800) // a 20 m spacecraft 1 km away: ≈ 19 px
 */
export function apparentPx(
  length: number,
  distance: number,
  fovDeg: number,
  viewportHeightPx: number,
): number {
  return length / unitsPerPixel(distance, fovDeg, viewportHeightPx);
}

/**
 * Whether a spacecraft's model should replace its marker: once the model, at true
 * size, spans more on screen than the marker does. Below that it would be a speck.
 */
export function modelShows(lengthKm: number, distanceKm: number, fovDeg: number, heightPx: number) {
  return apparentPx(lengthKm, distanceKm, fovDeg, heightPx) >= CRAFT_MIN_DIAMETER_PX;
}

/**
 * The camera's near plane for a camera `distanceKm` from what it looks at: a thousandth
 * of that, between 1 mm and 1 km. Close to a spacecraft it must be millimetres; across
 * the solar system 1 km keeps the depth buffer comfortable (with its logarithmic depth).
 */
export function nearPlaneKm(distanceKm: number): number {
  return Math.min(1, Math.max(1e-6, distanceKm / 1000));
}
