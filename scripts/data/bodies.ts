import type { BodyKind } from '../../src/core/ephemeris.ts';

/** A body whose ephemeris the data script fetches. */
export type Body = { id: string; horizonsId: string; kind: BodyKind };

/**
 * The planets (their centres, not their system barycentres) and the first five
 * spacecraft, IDs checked against Horizons on 2026-11-22. Step 1.2 moves the
 * spacecraft into data/catalogue.yaml.
 */
export const BODIES: readonly Body[] = [
  { id: 'mercury', horizonsId: '199', kind: 'planet' },
  { id: 'venus', horizonsId: '299', kind: 'planet' },
  { id: 'earth', horizonsId: '399', kind: 'planet' },
  { id: 'mars', horizonsId: '499', kind: 'planet' },
  { id: 'jupiter', horizonsId: '599', kind: 'planet' },
  { id: 'saturn', horizonsId: '699', kind: 'planet' },
  { id: 'uranus', horizonsId: '799', kind: 'planet' },
  { id: 'neptune', horizonsId: '899', kind: 'planet' },
  { id: 'juno', horizonsId: '-61', kind: 'spacecraft' },
  { id: 'europa-clipper', horizonsId: '-159', kind: 'spacecraft' },
  { id: 'psyche', horizonsId: '-255', kind: 'spacecraft' },
  { id: 'parker-solar-probe', horizonsId: '-96', kind: 'spacecraft' },
  { id: 'voyager-1', horizonsId: '-31', kind: 'spacecraft' },
];
