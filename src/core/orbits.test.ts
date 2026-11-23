import { describe, expect, it } from 'vitest';
import embElements from '../../tests/fixtures/horizons/emb-elements.json';
import embVectors from '../../tests/fixtures/horizons/emb-vectors.json';
import marsElements from '../../tests/fixtures/horizons/mars-elements.json';
import marsVectors from '../../tests/fixtures/horizons/mars-vectors.json';
import { parseElements, parseVectors } from './horizons.ts';
import { distance, length, radians } from './math.ts';
import { orbitPath, orbitPoint } from './orbits.ts';
import { position } from './ephemeris.ts';
import { KM_PER_AU } from './units.ts';

describe('parseElements', () => {
  it('reads the Earth–Moon barycentre’s orbit', () => {
    const elements = parseElements(embElements);
    expect(elements.semiMajorAxisKm / KM_PER_AU).toBeCloseTo(1, 3);
    expect(elements.eccentricity).toBeCloseTo(0.0167, 4);
    // 2026-01-01 00:00 TDB: 9,496.5 days after J2000, which began at noon.
    expect(elements.epoch).toBe(9_496.5 * 86_400);
  });
});

// Osculating elements describe the same state as the position at their epoch, so the
// point at the elements' own true anomaly must be where Horizons' vector says.
describe('orbitPoint', () => {
  for (const [name, elementsAnswer, vectorsAnswer] of [
    ['Earth–Moon barycentre', embElements, embVectors],
    ['Mars', marsElements, marsVectors],
  ] as const) {
    it(`puts ${name} where Horizons does, to within 1 km`, () => {
      const elements = parseElements(elementsAnswer);
      const sample = parseVectors(vectorsAnswer)[0]!;
      expect(sample[0]).toBe(elements.epoch);
      const point = orbitPoint(elements, radians(elements.trueAnomalyDeg));
      expect(distance(point, position(sample))).toBeLessThan(1);
    });
  }
});

describe('orbitPath', () => {
  const elements = parseElements(marsElements);
  const path = orbitPath(elements, 360);
  const { semiMajorAxisKm: a, eccentricity: e } = elements;

  it('is closed, and starts at perihelion', () => {
    expect(path).toHaveLength(361);
    path[0]!.forEach((value, i) => expect(path[360]![i]).toBeCloseTo(value, 3));
    orbitPoint(elements, 0).forEach((value, i) => expect(path[0]![i]).toBeCloseTo(value, 3));
  });

  it('stays between perihelion and aphelion distance', () => {
    for (const point of path) {
      const r = length(point);
      expect(r).toBeGreaterThanOrEqual(a * (1 - e) - 1);
      expect(r).toBeLessThanOrEqual(a * (1 + e) + 1);
    }
  });

  it('passes through the planet', () => {
    const mars = position(parseVectors(marsVectors)[0]!);
    const nearest = Math.min(...path.map((point) => distance(point, mars)));
    // 360 points around Mars's orbit are about 6 million km apart; the planet sits
    // between two of them, so within half that of the nearest.
    expect(nearest).toBeLessThan(3.5e6);
  });
});
