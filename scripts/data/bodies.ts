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
  track?: {
    center: string;
    centerCode: string;
    /** The sampling step; daily when absent. Small bodies' slow ellipses take 10 days. */
    step?: string;
    /** Only between these days (an orbiter's time at its planet); always when absent. */
    from?: string;
    to?: string;
  };
};

/** Kinds that have only a track (ADR 0015): no heliocentric states are fetched for them. */
export const TRACK_ONLY: readonly BodyKind[] = ['moon', 'small'];

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
  {
    id: 'phobos',
    horizonsId: '401',
    kind: 'moon',
    track: { center: 'mars', centerCode: '500@499' },
  },
  {
    id: 'deimos',
    horizonsId: '402',
    kind: 'moon',
    track: { center: 'mars', centerCode: '500@499' },
  },
  {
    id: 'triton',
    horizonsId: '801',
    kind: 'moon',
    track: { center: 'neptune', centerCode: '500@899' },
  },
  {
    id: 'charon',
    horizonsId: '901',
    kind: 'moon',
    track: { center: 'pluto', centerCode: '500@999' },
  },
];

/** Around the Sun on slow ellipses: elements every 10 days are plenty (ADR 0015). */
const SUN_TRACK = { center: 'sun', centerCode: '500@10', step: '10d' };

/**
 * Dwarf planets, asteroids, a comet and a Kuiper belt object: where missions went. 67P has
 * one orbit solution per apparition; `CAP` picks the closest.
 */
export const SMALL_BODIES: readonly Body[] = [
  { id: 'pluto', horizonsId: '999', kind: 'small', track: SUN_TRACK },
  { id: 'ceres', horizonsId: '1;', kind: 'small', track: SUN_TRACK },
  { id: 'vesta', horizonsId: '4;', kind: 'small', track: SUN_TRACK },
  { id: 'psyche-asteroid', horizonsId: '16;', kind: 'small', track: SUN_TRACK },
  { id: 'didymos', horizonsId: '65803;', kind: 'small', track: SUN_TRACK },
  { id: 'comet-67p', horizonsId: 'DES=1000012;CAP;', kind: 'small', track: SUN_TRACK },
  { id: 'arrokoth', horizonsId: '486958;', kind: 'small', track: SUN_TRACK },
];

/**
 * Every body with an ephemeris: the planets, their moons, then the catalogue's missions
 * in order.
 */
export function allBodies(missions: readonly Mission[]): Body[] {
  return [
    ...PLANETS,
    ...SMALL_BODIES,
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
              ...(mission.orbiting && { track: orbiterTrack(mission.orbiting) }),
            },
          ],
    ),
  ];
}

/** An orbiter's track around its planet (ADR 0015): that planet's centre, for its dates. */
function orbiterTrack(orbiting: { body: string; from: string; to?: string }) {
  const planet = PLANETS.find((p) => p.id === orbiting.body);
  if (!planet) throw new Error(`orbiting: no planet "${orbiting.body}"`);
  return {
    center: planet.id,
    centerCode: `500@${planet.horizonsId}`,
    from: orbiting.from,
    ...(orbiting.to && { to: orbiting.to }),
  };
}
