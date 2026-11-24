/**
 * What part of the 2D map shows: how much it's enlarged and which point sits in the
 * middle, and the moves that change it (docs/guides/map.md). Pure: views in, new views
 * out. Screen points are CSS px from the middle of the map's free area, y down.
 */
import type { MapPoint } from './projection.ts';

/** How the map is framed: `centre` is the unit-disc point in the middle of the screen. */
export type MapView = { zoom: number; centre: MapPoint };

/** A point on screen, in CSS px from the middle of the free area; y grows downwards. */
export type ScreenPoint = { x: number; y: number };

/** The whole disc, centred on the Sun. */
export const HOME_VIEW: MapView = { zoom: 1, centre: { x: 0, y: 0 } };

/** The closest zoom: the inner planets at true distances, Parker's loops on the log map. */
export const MAX_ZOOM = 1000;

/** Where a map point appears on screen. `radius` is the disc's radius in px at zoom 1. */
export function toScreen(view: MapView, point: MapPoint, radius: number): ScreenPoint {
  const k = radius * view.zoom;
  return { x: (point.x - view.centre.x) * k, y: -(point.y - view.centre.y) * k };
}

/** The map point under a screen point: the inverse of `toScreen`. */
export function fromScreen(view: MapView, screen: ScreenPoint, radius: number): MapPoint {
  const k = radius * view.zoom;
  return { x: view.centre.x + screen.x / k, y: view.centre.y - screen.y / k };
}

/**
 * Zooms by `factor` (2 is twice as close), keeping the map point under `anchor` where
 * it is on screen: the point under the mouse, between the fingers, or the middle.
 */
export function zoomAt(
  view: MapView,
  factor: number,
  anchor: ScreenPoint,
  radius: number,
): MapView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom * factor));
  const under = fromScreen(view, anchor, radius);
  const k = radius * zoom;
  return clamp({ zoom, centre: { x: under.x - anchor.x / k, y: under.y + anchor.y / k } });
}

/** Moves the map with a drag of `dx`, `dy` px: what was under the finger stays under it. */
export function panBy(view: MapView, dx: number, dy: number, radius: number): MapView {
  const k = radius * view.zoom;
  return clamp({ ...view, centre: { x: view.centre.x - dx / k, y: view.centre.y + dy / k } });
}

/** Whether the view shows the whole disc, centred. */
export function isHome(view: MapView): boolean {
  return view.zoom === 1 && view.centre.x === 0 && view.centre.y === 0;
}

/**
 * Keeps part of the disc on screen: the middle may wander from the Sun by at most
 * `1 − 1/zoom`, so at zoom 1 the disc stays centred and close up any of it can be
 * reached, out to the edge.
 */
function clamp(view: MapView): MapView {
  const reach = 1 - 1 / view.zoom;
  const distance = Math.hypot(view.centre.x, view.centre.y);
  if (distance <= reach) return view;
  if (reach === 0) return { ...view, centre: { x: 0, y: 0 } };
  const k = reach / distance;
  return { ...view, centre: { x: view.centre.x * k, y: view.centre.y * k } };
}
