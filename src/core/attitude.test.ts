import { describe, expect, it } from 'vitest';
import { defaultAttitude, isFrame } from './attitude.ts';
import { dot, normalize, subtract, type Vector3 } from './math.ts';

describe('defaultAttitude', () => {
  const earth: Vector3 = [1.5e8, 0, 0];

  it('points the antenna at Earth, with the Sun across the arrays’ axis', () => {
    const at: Vector3 = [0, 3e8, 2e7];
    const axes = defaultAttitude(at, earth);
    expect(isFrame(axes)).toBe(true);
    const toEarth = normalize(subtract(earth, at));
    expect(dot(axes.z, toEarth)).toBeCloseTo(1, 12);
    // The Sun has no component along y.
    expect(dot(axes.y, normalize([-at[0], -at[1], -at[2]]))).toBeCloseTo(0, 12);
  });

  it('still makes a frame when the Sun and Earth line up', () => {
    // Beyond Earth on the Sun–Earth line: Earth and the Sun in the same direction.
    const axes = defaultAttitude([7.8e8, 0, 0], earth);
    expect(isFrame(axes)).toBe(true);
    expect(dot(axes.z, [-1, 0, 0])).toBeCloseTo(1, 12);
  });

  it('turns a shield to the Sun, with Earth across, for spacecraft that fly that way', () => {
    const at: Vector3 = [3e7, 4e7, 0];
    const axes = defaultAttitude(at, earth, 'sun');
    expect(isFrame(axes)).toBe(true);
    expect(dot(axes.z, normalize([-3, -4, 0]))).toBeCloseTo(1, 12);
    expect(dot(axes.y, normalize(subtract(earth, at)))).toBeCloseTo(0, 12);
  });
});
