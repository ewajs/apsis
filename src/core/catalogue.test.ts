import { describe, expect, it } from 'vitest';
import { CatalogueError, parseCatalogue } from './catalogue.ts';

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

  it('wants milestones in date order', () => {
    const entry = valid();
    entry.milestones.reverse();
    expect(problemsOf([entry])).toEqual(['entry 1 (juno): milestones[1] is out of date order']);
  });

  it('refuses something that is not a list', () => {
    expect(problemsOf({ juno: valid() })).toEqual(['the catalogue must be a list of missions']);
  });
});
