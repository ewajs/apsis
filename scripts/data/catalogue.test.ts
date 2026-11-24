import { describe, expect, it } from 'vitest';
import { readCatalogue } from './catalogue.ts';

describe('data/catalogue.yaml', () => {
  it('passes validation', () => {
    expect(() => readCatalogue()).not.toThrow();
  });

  it('has a public ephemeris for every mission in it so far', () => {
    const missions = readCatalogue();
    expect(missions.map((m) => m.id)).toEqual([
      'juno',
      'europa-clipper',
      'psyche',
      'parker-solar-probe',
      'voyager-1',
      'cassini',
    ]);
    for (const mission of missions) expect(mission.horizons).not.toBeNull();
  });
});
