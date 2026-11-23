import { describe, expect, it } from 'vitest';
import { LABEL_GAP, placeLabels, type LabelRequest } from './labels.ts';

const bounds = { left: -200, top: -200, width: 400, height: 400 };
const label = (id: string, x: number, y: number, width = 40): LabelRequest => ({
  id,
  x,
  y,
  radius: 4,
  width,
  height: 14,
});

describe('placeLabels', () => {
  it('puts a lone label to the right of its marker', () => {
    expect(placeLabels([label('earth', 0, 0)], bounds).get('earth')).toEqual({
      left: 4 + LABEL_GAP,
      top: -7,
      width: 40,
      height: 14,
    });
  });

  it('moves the second of two neighbours to another side', () => {
    // Juno and Jupiter sit almost on top of each other.
    const placed = placeLabels([label('juno', 0, 0), label('jupiter', 2, 1)], bounds);
    expect(placed.size).toBe(2);
    const [juno, jupiter] = [placed.get('juno')!, placed.get('jupiter')!];
    expect(
      jupiter.left + jupiter.width <= juno.left ||
        jupiter.top + jupiter.height <= juno.top ||
        jupiter.top >= juno.top + juno.height,
    ).toBe(true);
  });

  it('flips a label inward at the edge of the map', () => {
    const box = placeLabels([label('voyager', 190, 0)], bounds).get('voyager')!;
    expect(box.left + box.width).toBeLessThanOrEqual(190);
  });

  it('hides a label with nowhere to go, keeping the more important one', () => {
    const crowd = [
      label('a', 0, 0, 120),
      label('b', 0, 0, 120),
      label('c', 0, 0, 120),
      label('d', 0, 0, 120),
      label('e', 0, 0, 120),
    ];
    const placed = placeLabels(crowd, bounds);
    expect(placed.has('a')).toBe(true);
    expect(placed.has('e')).toBe(false);
  });

  it('keeps off obstacles such as ring labels', () => {
    const ring = { left: 0, top: -20, width: 60, height: 40 };
    const box = placeLabels([label('earth', 0, 0)], bounds, [ring]).get('earth')!;
    expect(box.left + box.width).toBeLessThanOrEqual(0);
  });

  it('tries the diagonals when the four sides are taken', () => {
    // A 10 × 14 label beside a marker of radius 4, so 8 px from its centre.
    const sides = [
      { left: 8, top: -7, width: 10, height: 14 },
      { left: -18, top: -7, width: 10, height: 14 },
      { left: -5, top: -22, width: 10, height: 14 },
      { left: -5, top: 8, width: 10, height: 14 },
    ];
    expect(placeLabels([label('mars', 0, 0, 10)], bounds, sides).get('mars')).toEqual({
      left: 8,
      top: -22,
      width: 10,
      height: 14,
    });
  });

  it('never covers another marker', () => {
    // The label to the right of `a` would sit on marker `b`.
    const placed = placeLabels([label('a', 0, 0), label('b', 20, 0)], bounds);
    expect(placed.get('a')!.left).toBeLessThan(0);
  });
});
