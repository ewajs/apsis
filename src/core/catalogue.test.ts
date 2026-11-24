import { describe, expect, it } from 'vitest';
import {
  CatalogueError,
  instantWithData,
  looseDateStart,
  milestonesAround,
  parseCatalogue,
  type Mission,
} from './catalogue.ts';

const valid = () => ({
  id: 'juno',
  name: 'Juno',
  agency: 'NASA',
  launch: '2011-08-05',
  target: { es: 'Júpiter', en: 'Jupiter' },
  status: 'active',
  horizons: '-61',
  coverage: { from: '2011-08-06', to: '2028-09-01' },
  milestones: [
    { date: '2016-07-05', es: 'Llega', en: 'Arrives' },
    { date: '2029', es: 'Algo', en: 'Something' },
  ],
  blurb: { es: 'Orbita Júpiter.', en: 'Orbits Jupiter.' },
  links: ['https://science.nasa.gov/mission/juno/'],
});

function problemsOf(data: unknown): string[] {
  try {
    parseCatalogue(data);
    return [];
  } catch (error) {
    if (error instanceof CatalogueError) return error.problems;
    throw error;
  }
}

describe('parseCatalogue', () => {
  it('accepts a complete entry', () => {
    expect(parseCatalogue([valid()])).toHaveLength(1);
  });

  it('accepts a mission without a public ephemeris, if it says why', () => {
    const rest: Record<string, unknown> = { ...valid(), horizons: null };
    delete rest.coverage;
    const entry = { ...rest, noEphemeris: { es: 'Sin datos.', en: 'No data.' } };
    expect(parseCatalogue([entry])).toHaveLength(1);
    expect(problemsOf([{ ...rest, horizons: null }])).toEqual([
      'entry 1 (juno): horizons is null, so noEphemeris must say why',
    ]);
  });

  it('requires both languages everywhere', () => {
    const entry = valid();
    expect(problemsOf([{ ...entry, blurb: { es: 'Hola' } }])).toEqual([
      'entry 1 (juno): blurb.en is missing',
    ]);
    expect(
      problemsOf([{ ...entry, milestones: [{ date: '2016', es: '', en: 'Arrives' }] }]),
    ).toEqual(['entry 1 (juno): milestones[0].es is missing']);
  });

  it('catches the usual YAML slips', () => {
    // An unquoted year is a number, and an unquoted negative ID is too.
    expect(problemsOf([{ ...valid(), horizons: -61 }])).toEqual([
      'entry 1 (juno): horizons must be an ID such as "-61" (quoted), or null',
    ]);
    expect(problemsOf([{ ...valid(), milestones: [{ date: 2029, es: 'a', en: 'b' }] }])).toEqual([
      'entry 1 (juno): milestones[0].date must be YYYY-MM-DD, YYYY-MM or YYYY',
    ]);
  });

  it('reports every problem at once, with where it is', () => {
    const second = {
      ...valid(),
      launch: '2011',
      coverage: { from: '2028-01-01', to: '2011-01-01' },
    };
    const third = { ...valid(), id: 'Juno 2', status: 'lost', links: ['http://x'] };
    expect(problemsOf([valid(), second, third])).toEqual([
      'entry 2 (juno): id is used twice',
      'entry 2 (juno): launch must be YYYY-MM-DD',
      'entry 2 (juno): coverage.from must come before coverage.to',
      'entry 3 (Juno 2): id must be lowercase words joined by hyphens',
      'entry 3 (Juno 2): status must be active or ended',
      'entry 3 (Juno 2): links must list at least one https:// address',
    ]);
  });

  it('wants an exact day for an encounter', () => {
    const entry = {
      ...valid(),
      milestones: [{ date: '2026-12', encounter: true, es: 'a', en: 'b' }],
    };
    expect(problemsOf([entry])).toEqual([
      'entry 1 (juno): milestones[0] is an encounter, so its date needs a day (YYYY-MM-DD)',
    ]);
    const exact = {
      ...valid(),
      milestones: [{ date: '2026-12-02', encounter: true, es: 'a', en: 'b' }],
    };
    expect(problemsOf([exact])).toEqual([]);
  });

  it('wants milestones in date order', () => {
    const entry = valid();
    entry.milestones.reverse();
    expect(problemsOf([entry])).toEqual(['entry 1 (juno): milestones[1] is out of date order']);
  });

  it('refuses something that is not a list', () => {
    expect(problemsOf({ juno: valid() })).toEqual(['the catalogue must be a list of missions']);
  });
});

describe('instantWithData', () => {
  const cassini = {
    ...valid(),
    coverage: { from: '1997-10-16', to: '2017-09-15' },
  } as Mission;

  it('keeps an instant the mission has data for', () => {
    const instant = Date.UTC(2004, 6, 1, 3, 12);
    expect(instantWithData(cassini, instant)).toBe(instant);
  });

  it('moves an instant after the end to a day before it, and one before launch to a day after', () => {
    expect(instantWithData(cassini, Date.UTC(2026, 10, 23))).toBe(Date.UTC(2017, 8, 14));
    expect(instantWithData(cassini, Date.UTC(1990, 0, 1))).toBe(Date.UTC(1997, 9, 17));
  });

  it('keeps the instant when the coverage isn’t known', () => {
    const unknown: Mission = { ...cassini };
    delete unknown.coverage;
    expect(instantWithData(unknown, 0)).toBe(0);
  });
});

describe('milestones around an instant', () => {
  const milestones = [
    { date: '2016-07-05', es: 'Llega', en: 'Arrives' },
    { date: '2026-12', es: 'Algo', en: 'Something' },
    { date: '2029', es: 'Otra', en: 'Another' },
  ];

  it('reads loose dates from their start', () => {
    expect(looseDateStart('2029')).toBe(Date.UTC(2029, 0, 1));
    expect(looseDateStart('2026-12')).toBe(Date.UTC(2026, 11, 1));
    expect(looseDateStart('2016-07-05')).toBe(Date.UTC(2016, 6, 5));
  });

  it('finds the last and the next', () => {
    expect(milestonesAround(milestones, Date.UTC(2020, 0, 1))).toEqual({
      last: milestones[0],
      next: milestones[1],
    });
    expect(milestonesAround(milestones, Date.UTC(2010, 0, 1))).toEqual({ next: milestones[0] });
    expect(milestonesAround(milestones, Date.UTC(2030, 0, 1))).toEqual({ last: milestones[2] });
    // A day's milestone has started from its midnight.
    expect(milestonesAround(milestones, Date.UTC(2016, 6, 5)).last).toBe(milestones[0]);
    expect(milestonesAround([], 0)).toEqual({});
  });
});
