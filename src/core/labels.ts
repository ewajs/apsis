/**
 * Places map labels so they don't overlap each other, the markers or fixed obstacles
 * (such as the scale rings' labels): each label tries the right of its marker, then
 * the left, above, below and the four diagonals, and hides if none is free.
 * Pure and greedy: labels earlier in the list win.
 */

/** A rectangle in map pixels. */
export type Box = { left: number; top: number; width: number; height: number };

/** A marker that needs a label, in map pixels. */
export type LabelRequest = {
  id: string;
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
};

/** Gap between a marker's edge and its label, in px. */
export const LABEL_GAP = 4;

const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;

const inside = (box: Box, bounds: Box) =>
  box.left >= bounds.left &&
  box.top >= bounds.top &&
  box.left + box.width <= bounds.left + bounds.width &&
  box.top + box.height <= bounds.top + bounds.height;

/**
 * Where each label goes, by id. A label missing from the result is hidden.
 * @param requests In order of importance: the first ones get the best spots.
 * @param bounds The visible area; labels stay inside it.
 * @param obstacles Areas no label may cover.
 */
export function placeLabels(
  requests: readonly LabelRequest[],
  bounds: Box,
  obstacles: readonly Box[] = [],
): Map<string, Box> {
  const blocked: Box[] = [...obstacles];
  const markers: Box[] = requests.map(({ x, y, radius }) => ({
    left: x - radius,
    top: y - radius,
    width: radius * 2,
    height: radius * 2,
  }));
  const placed = new Map<string, Box>();
  for (const { id, x, y, radius, width, height } of requests) {
    const reach = radius + LABEL_GAP;
    const candidates: Box[] = [
      { left: x + reach, top: y - height / 2, width, height },
      { left: x - reach - width, top: y - height / 2, width, height },
      { left: x - width / 2, top: y - reach - height, width, height },
      { left: x - width / 2, top: y + reach, width, height },
      { left: x + reach, top: y - reach - height, width, height },
      { left: x + reach, top: y + reach, width, height },
      { left: x - reach - width, top: y - reach - height, width, height },
      { left: x - reach - width, top: y + reach, width, height },
    ];
    const free = candidates.find(
      (box) =>
        inside(box, bounds) &&
        ![...placed.values()].some((other) => overlaps(box, other)) &&
        !markers.some((marker) => overlaps(box, marker)) &&
        !blocked.some((obstacle) => overlaps(box, obstacle)),
    );
    if (free) placed.set(id, free);
  }
  return placed;
}
