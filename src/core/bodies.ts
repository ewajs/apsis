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
  // Moons (NASA fact sheets).
  moon: 1_737.4,
  io: 1_821.6,
  europa: 1_560.8,
  ganymede: 2_634.1,
  callisto: 2_410.3,
  enceladus: 252.1,
  titan: 2_574.7,
};

/**
 * Saturn's main rings, in km from its centre: from the inner edge of the C ring to the
 * outer edge of the A ring (NASA Saturn fact sheet).
 */
export const SATURN_RINGS_KM = { inner: 74_658, outer: 136_775 } as const;
