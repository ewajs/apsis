import { SphereGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { cross, dot } from '../core/math.ts';
import { bodyAxes, ROTATION } from '../core/rotation.ts';
import { sphereBasis } from './sphere-basis.ts';

describe('three.js sphere texture convention', () => {
  // If three.js ever changes how it wraps a texture, Earth would turn the wrong way.
  it('puts longitude 0 along +x, 90° east along −z and the north pole along +y', () => {
    const sphere = new SphereGeometry(1, 8, 4);
    const { position, uv } = sphere.attributes;
    const at = (u: number, v: number) => {
      for (let i = 0; i < uv!.count; i++) {
        if (Math.abs(uv!.getX(i) - u) < 1e-9 && Math.abs(uv!.getY(i) - v) < 1e-9) {
          return [position!.getX(i), position!.getY(i), position!.getZ(i)].map((n) => n + 0);
        }
      }
      throw new Error(`no vertex at ${u}, ${v}`);
    };
    expect(at(0.5, 0.5).map((n) => Math.round(n))).toEqual([1, 0, 0]);
    expect(at(0.75, 0.5).map((n) => Math.round(n))).toEqual([0, 0, -1]);
    // The top row of the texture (v = 1) is the north pole; three.js offsets its u.
    for (let i = 0; i < uv!.count; i++) {
      if (uv!.getY(i) === 1) expect(position!.getY(i)).toBeCloseTo(1, 9);
    }
  });
});

describe('sphereBasis', () => {
  it('is a rotation: x × y = z, so textures are never mirrored', () => {
    const [x, y, z] = sphereBasis(bodyAxes(ROTATION.earth!, 0));
    cross(x, y).forEach((value, i) => expect(value).toBeCloseTo(z[i]!, 12));
    expect(dot(x, y)).toBeCloseTo(0, 12);
  });
});
