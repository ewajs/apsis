import { describe, expect, it } from 'vitest';
import { pickAt, PICK_REACH_PX } from './pick.ts';

describe('pickAt', () => {
  const marks = [
    { id: 'sun', x: 0, y: 0, radius: 7 },
    { id: 'earth', x: 40, y: 0, radius: 4 },
    { id: 'europa-clipper', x: 48, y: 0, radius: 3 },
  ];

  it('picks the marker under the tap', () => {
    expect(pickAt(marks, 1, 1)).toBe('sun');
    expect(pickAt(marks, 40, 0)).toBe('earth');
  });

  it('picks the nearest of close markers, edge to edge', () => {
    expect(pickAt(marks, 45, 0)).toBe('europa-clipper');
    expect(pickAt(marks, 43, 0)).toBe('earth');
  });

  it('forgives a finger, up to its reach', () => {
    expect(pickAt(marks, 0, 7 + PICK_REACH_PX)).toBe('sun');
    expect(pickAt(marks, 0, 7 + PICK_REACH_PX + 1)).toBeUndefined();
    expect(pickAt([], 0, 0)).toBeUndefined();
  });
});
