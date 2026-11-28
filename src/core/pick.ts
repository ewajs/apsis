/**
 * Which body a tap means, on the map and in 3D alike. Pure: screen positions in, an id
 * out.
 */

/** A body drawn on screen: its centre and its drawn radius, in CSS px. */
export type ScreenMark = { id: string; x: number; y: number; radius: number };

/**
 * How far from a marker's edge a tap still picks it, in CSS px: markers are a few px
 * across, fingers about 44 (WCAG's target size).
 */
export const PICK_REACH_PX = 22;

/**
 * The body a tap at `x`, `y` means: of the markers within `reach` px of their edge, the
 * nearest; `undefined` when there's none.
 * @example pickAt([{ id: 'earth', x: 10, y: 0, radius: 4 }], 0, 0) // 'earth'
 */
export function pickAt(
  marks: readonly ScreenMark[],
  x: number,
  y: number,
  reach = PICK_REACH_PX,
): string | undefined {
  let best: { id: string; gap: number } | undefined;
  for (const mark of marks) {
    const gap = Math.hypot(mark.x - x, mark.y - y) - mark.radius;
    if (gap <= reach && (!best || gap < best.gap)) best = { id: mark.id, gap };
  }
  return best?.id;
}
