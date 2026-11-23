import type { BodyKind } from '../../src/core/ephemeris.ts';

/** A body whose ephemeris the data script fetches. */
export type Body = {
  id: string;
  horizonsId: string;
  kind: BodyKind;
  /** The span Horizons covers; fetches are clipped to it. Planets have no limit. */
  coverage?: { from: string; to: string };
};

/** The planets: their centres, not their system barycentres (docs/guides/data.md). */
export const PLANETS: readonly Body[] = [
  { id: 'mercury', horizonsId: '199', kind: 'planet' },
  { id: 'venus', horizonsId: '299', kind: 'planet' },
  { id: 'earth', horizonsId: '399', kind: 'planet' },
  { id: 'mars', horizonsId: '499', kind: 'planet' },
  { id: 'jupiter', horizonsId: '599', kind: 'planet' },
  { id: 'saturn', horizonsId: '699', kind: 'planet' },
  { id: 'uranus', horizonsId: '799', kind: 'planet' },
  { id: 'neptune', horizonsId: '899', kind: 'planet' },
];
