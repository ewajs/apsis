import type { Mission } from '../../src/core/catalogue.ts';
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
  /** Days of close passes (YYYY-MM-DD), sampled hourly around them (ADR 0011). */
  encounters?: string[];
  /**
   * Orbital elements around a parent, fetched daily (ADR 0015): the parent's id and its
   * centre as Horizons names it (`500@599`, Jupiter's). A moon has only this.
   */
  track?: { center: string; centerCode: string };
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

/** The moons the close-ups show, each on a track around its planet (ADR 0015). */
export const MOONS: readonly Body[] = [
  {
    id: 'moon',
    horizonsId: '301',
    kind: 'moon',
    track: { center: 'earth', centerCode: '500@399' },
  },
  {
    id: 'io',
    horizonsId: '501',
    kind: 'moon',
    track: { center: 'jupiter', centerCode: '500@599' },
  },
  {
    id: 'europa',
    horizonsId: '502',
    kind: 'moon',
    track: { center: 'jupiter', centerCode: '500@599' },
  },
  {
    id: 'ganymede',
    horizonsId: '503',
    kind: 'moon',
    track: { center: 'jupiter', centerCode: '500@599' },
  },
  {
    id: 'callisto',
    horizonsId: '504',
    kind: 'moon',
    track: { center: 'jupiter', centerCode: '500@599' },
  },
  {
    id: 'enceladus',
    horizonsId: '602',
    kind: 'moon',
    track: { center: 'saturn', centerCode: '500@699' },
  },
  {
    id: 'titan',
    horizonsId: '606',
    kind: 'moon',
    track: { center: 'saturn', centerCode: '500@699' },
  },
];

/**
 * Every body with an ephemeris: the planets, their moons, then the catalogue's missions
 * in order.
 */
export function allBodies(missions: readonly Mission[]): Body[] {
  return [
    ...PLANETS,
    ...MOONS,
    ...missions.flatMap((mission) =>
      mission.horizons === null
        ? []
        : [
            {
              id: mission.id,
              horizonsId: mission.horizons,
              kind: 'spacecraft' as const,
              ...(mission.coverage && { coverage: mission.coverage }),
              encounters: mission.milestones.filter((m) => m.encounter).map((m) => m.date),
            },
          ],
    ),
  ];
}
