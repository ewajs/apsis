/** Physical facts about the bodies Apsis draws. */

/**
 * Mean radii in km (IAU / NASA planetary fact sheets). Gas giants' radii are at the
 * 1-bar level.
 */
export const RADIUS_KM: Readonly<Record<string, number>> = {
  sun: 695_700,
  mercury: 2_439.7,
  venus: 6_051.8,
  earth: 6_371.0,
  mars: 3_389.5,
  jupiter: 69_911,
  saturn: 58_232,
  uranus: 25_362,
  neptune: 24_622,
};
