import { describe, expect, it } from 'vitest';
import { add, combine, cross, distance, dot, length, radians, scale, subtract } from './math.ts';

describe('vectors', () => {
  it('add, subtract and scale', () => {
    expect(add([1, 2, 3], [10, 20, 30])).toEqual([11, 22, 33]);
    expect(subtract([10, 20, 30], [1, 2, 3])).toEqual([9, 18, 27]);
    expect(scale([1, -2, 3], 2)).toEqual([2, -4, 6]);
  });

  it('combine two axes', () => {
    expect(combine(3, [1, 0, 0], 4, [0, 1, 0])).toEqual([3, 4, 0]);
  });

  it('dot and cross follow the right-hand rule', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it('measure lengths and distances', () => {
    expect(length([3, 4, 12])).toBe(13);
    expect(distance([1, 1, 1], [4, 5, 1])).toBe(5);
  });
});

describe('radians', () => {
  it('converts degrees', () => {
    expect(radians(180)).toBe(Math.PI);
    expect(radians(-90)).toBe(-Math.PI / 2);
  });
});
