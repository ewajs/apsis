import { describe, expect, it } from 'vitest';
import earth from '../../tests/fixtures/horizons/earth-new-year.json';
import juno from '../../tests/fixtures/horizons/juno.json';
import noSuchRecord from '../../tests/fixtures/horizons/error-no-such-record.json';
import outsideCoverage from '../../tests/fixtures/horizons/error-outside-coverage.json';
import { HorizonsError, parseVectors, vectorsQuery } from './horizons.ts';

// Recorded answers (tests/fixtures/horizons), never the live API.
describe('parseVectors', () => {
  it('reads every row of a spacecraft answer', () => {
    const samples = parseVectors(juno);
    expect(samples).toHaveLength(4);
    // 2026-11-20 00:00 TDB is JD 2461364.5: 9819.5 days after J2000.
    expect(samples[0]).toEqual([
      848_404_800, -563_198_494.673, 561_968_630.525, 6_031_336.169, -8.243378, -9.616886,
      -3.388053,
    ]);
    expect(samples[3]![0] - samples[0]![0]).toBe(3 * 86_400);
  });

  it('reads a planet answer', () => {
    const samples = parseVectors(earth);
    expect(samples).toHaveLength(4);
    // Earth stays within 0.98–1.02 AU of the Sun.
    for (const [, x, y, z] of samples) {
      expect(Math.hypot(x, y, z) / 149_597_870.7).toBeGreaterThan(0.98);
      expect(Math.hypot(x, y, z) / 149_597_870.7).toBeLessThan(1.02);
    }
  });

  it('reports Horizons refusals with its own words', () => {
    expect(() => parseVectors(noSuchRecord)).toThrow(HorizonsError);
    expect(() => parseVectors(outsideCoverage)).toThrow(/No ephemeris for target "Psyche/);
  });

  it('refuses an answer from an unknown API version', () => {
    expect(() => parseVectors({ ...juno, signature: { version: '2.0' } })).toThrow(/version/);
  });

  it('refuses an answer without data markers or with a broken row', () => {
    expect(() => parseVectors({ ...juno, result: 'Something else' })).toThrow(HorizonsError);
    const broken = juno.result.replace(/\$\$SOE\n[^\n]*/, '$$$$SOE\n2461364.5, A.D., x, y,');
    expect(() => parseVectors({ ...juno, result: broken })).toThrow(/Unreadable/);
  });
});

describe('vectorsQuery', () => {
  it('asks for heliocentric ecliptic state vectors in km and km/s, quoted', () => {
    const query = vectorsQuery({
      horizonsId: '-61',
      start: '2026-11-20',
      stop: '2026-11-23',
      step: '1d',
    });
    expect(query).toMatchObject({
      format: 'json',
      COMMAND: "'-61'",
      EPHEM_TYPE: "'VECTORS'",
      CENTER: "'500@10'",
      REF_PLANE: "'ECLIPTIC'",
      VEC_TABLE: "'2'",
      OUT_UNITS: "'KM-S'",
      START_TIME: "'2026-11-20'",
      STEP_SIZE: "'1d'",
    });
  });
});
