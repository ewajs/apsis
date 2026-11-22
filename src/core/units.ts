/**
 * Kilometres in one astronomical unit (exact, IAU 2012). Data and logic use km;
 * AU is a display format only (ADR 0004).
 */
export const KM_PER_AU = 149_597_870.7;

/** Speed of light in km/s (exact, by the definition of the metre). */
export const SPEED_OF_LIGHT_KM_S = 299_792.458;

/**
 * Kilometres to astronomical units, for display.
 * @example kmToAu(KM_PER_AU) // 1
 */
export function kmToAu(km: number): number {
  return km / KM_PER_AU;
}

/**
 * Seconds that light takes to cross a distance: how old a signal from a spacecraft
 * that far away is when it arrives.
 * @example lightTimeSeconds(KM_PER_AU) // ≈ 499 (8 min 19 s, Sun to Earth)
 */
export function lightTimeSeconds(distanceKm: number): number {
  return distanceKm / SPEED_OF_LIGHT_KM_S;
}
