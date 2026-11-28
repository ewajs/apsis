import { describe, expect, it } from 'vitest';
import io from '../../tests/fixtures/horizons/io-elements.json';
import ioVectors from '../../tests/fixtures/horizons/io-vectors.json';
import juno from '../../tests/fixtures/horizons/juno-jupiter-elements.json';
import junoVectors from '../../tests/fixtures/horizons/juno-jupiter-vectors.json';
import {
  eccentricAnomaly,
  periapsisTimes,
  positionFromSamples,
  propagate,
  sampleOrbit,
} from './elements.ts';
import { parseElementSeries, parseVectors } from './horizons.ts';
import { distance } from './math.ts';
import { orbitPoint } from './orbits.ts';

// Recorded answers: Io and Juno around Jupiter's centre, 1–3 November 2026.
const series = {
  io: { elements: parseElementSeries(io), truth: parseVectors(ioVectors) },
  juno: { elements: parseElementSeries(juno), truth: parseVectors(junoVectors) },
};

describe('Kepler’s equation', () => {
  it('is solved for round orbits and long, thin ones, at any mean anomaly', () => {
    for (const e of [0, 0.05, 0.6, 0.973, 0.999]) {
      for (const m of [-7, -3, -0.2, 0, 0.1, 2, 3.8554, 9]) {
        const E = eccentricAnomaly(m, e);
        const wrapped = m - 2 * Math.PI * Math.round(m / (2 * Math.PI));
        expect(E - e * Math.sin(E)).toBeCloseTo(wrapped, 9);
      }
    }
  });
});

describe('positions from daily elements', () => {
  it('reads Horizons’ element columns', () => {
    const [first] = series.juno.elements;
    // Juno's 33-day orbit: very eccentric, about 2.9 million km across its long half.
    expect(first![2]).toBeCloseTo(0.9728, 4);
    expect(first![1]).toBeCloseTo(2_945_850, 0);
    expect(series.io.elements).toHaveLength(3);
  });

  it('is where Horizons says at each sample, and close in between', () => {
    for (const [body, limitKm] of [
      ['io', 400],
      ['juno', 50],
    ] as const) {
      const { elements, truth } = series[body];
      for (const sample of truth) {
        const at = positionFromSamples(elements, sample[0])!;
        const error = distance(at, [sample[1], sample[2], sample[3]]);
        const onEpoch = elements.some((element) => element[0] === sample[0]);
        expect(error, `${body} at ${sample[0]}`).toBeLessThan(onEpoch ? 1 : limitKm);
      }
    }
  });

  it('knows nothing outside its samples', () => {
    const { elements } = series.io;
    expect(positionFromSamples(elements, elements[0]![0] - 1)).toBeNull();
    expect(positionFromSamples([], 0)).toBeNull();
  });

  it('draws the ellipse each sample describes, through the body', () => {
    const sample = series.juno.elements[0]!;
    const orbit = sampleOrbit(sample);
    const onOrbit = orbitPoint(orbit, (orbit.trueAnomalyDeg * Math.PI) / 180);
    expect(distance(onOrbit, propagate(sample, sample[0]))).toBeLessThan(1e-3);
  });
});

describe('periapsisTimes', () => {
  it('finds the next close pass after each sample, once', () => {
    const [first] = series.juno.elements;
    const times = periapsisTimes(series.juno.elements);
    // Juno's next perijove after 1 November 2026, the same from all three days.
    expect(times).toHaveLength(1);
    const at = times[0]!;
    expect(at).toBeGreaterThan(first![0]);
    // At periapsis its distance is the orbit's smallest, a(1 − e).
    const [, a, e] = first!;
    const distance = Math.hypot(...propagate(first!, at));
    expect(distance).toBeCloseTo(a * (1 - e), -2);
  });
});
