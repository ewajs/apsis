import type { BodyKind } from '../../src/core/ephemeris.ts';

/** A body whose ephemeris the data script fetches. */
export type Body = {
  id: string;
  horizonsId: string;
  kind: BodyKind;
  /** The span Horizons covers; fetches are clipped to it. Planets have no limit. */
  coverage?: { from: string; to: string };
  /**
   * For planets, the Horizons ID whose orbit we draw: the barycentre of the planet and
   * its moons, which follows a smooth orbit. Earth's centre wobbles 4,700 km around the
   * Earth–Moon barycentre every month (ADR 0010).
   */
  orbitId?: string;
};

/** The planets: their centres, not their system barycentres (docs/guides/data.md). */
export const PLANETS: readonly Body[] = [
  { id: 'mercury', horizonsId: '199', kind: 'planet', orbitId: '1' },
  { id: 'venus', horizonsId: '299', kind: 'planet', orbitId: '2' },
  { id: 'earth', horizonsId: '399', kind: 'planet', orbitId: '3' },
  { id: 'mars', horizonsId: '499', kind: 'planet', orbitId: '4' },
  { id: 'jupiter', horizonsId: '599', kind: 'planet', orbitId: '5' },
  { id: 'saturn', horizonsId: '699', kind: 'planet', orbitId: '6' },
  { id: 'uranus', horizonsId: '799', kind: 'planet', orbitId: '7' },
  { id: 'neptune', horizonsId: '899', kind: 'planet', orbitId: '8' },
];
