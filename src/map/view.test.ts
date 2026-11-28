import { describe, expect, it } from 'vitest';
import {
  centredOn,
  CENTRING_ZOOM,
  fromScreen,
  HOME_VIEW,
  isHome,
  MAX_ZOOM,
  panBy,
  toScreen,
  zoomAt,
} from './view.ts';

const R = 300;

describe('the map view', () => {
  it('puts the Sun in the middle and the edge at the radius at home', () => {
    expect(toScreen(HOME_VIEW, { x: 0, y: 0 }, R)).toEqual({ x: 0, y: -0 });
    // The map's +y is up; the screen's is down.
    expect(toScreen(HOME_VIEW, { x: 1, y: 1 }, R)).toEqual({ x: 300, y: -300 });
  });

  it('finds the map point under a screen point', () => {
    const view = { zoom: 8, centre: { x: 0.3, y: -0.2 } };
    const point = { x: 0.31, y: -0.17 };
    const back = fromScreen(view, toScreen(view, point, R), R);
    expect(back.x).toBeCloseTo(point.x, 12);
    expect(back.y).toBeCloseTo(point.y, 12);
  });

  it('keeps the point under the anchor still while zooming', () => {
    const anchor = { x: 120, y: -45 };
    const before = fromScreen(HOME_VIEW, anchor, R);
    const view = zoomAt(HOME_VIEW, 4, anchor, R);
    expect(view.zoom).toBe(4);
    const after = toScreen(view, before, R);
    expect(after.x).toBeCloseTo(anchor.x, 9);
    expect(after.y).toBeCloseTo(anchor.y, 9);
  });

  it('never zooms out past the whole disc, or in past the closest zoom', () => {
    const out = zoomAt({ zoom: 2, centre: { x: 0.4, y: 0 } }, 0.1, { x: 50, y: 50 }, R);
    expect(out).toEqual(HOME_VIEW);
    expect(isHome(out)).toBe(true);
    expect(zoomAt(HOME_VIEW, 1e9, { x: 0, y: 0 }, R).zoom).toBe(MAX_ZOOM);
  });

  it('moves with a drag, and can’t lose the disc', () => {
    const view = panBy({ zoom: 4, centre: { x: 0, y: 0 } }, -60, 30, R);
    // Dragging left and down brings what was right and up to the middle.
    expect(view.centre.x).toBeCloseTo(0.05, 12);
    expect(view.centre.y).toBeCloseTo(0.025, 12);
    // At zoom 1 there's nowhere to go; at 4, at most 3/4 of the way out.
    expect(panBy(HOME_VIEW, 500, 500, R)).toEqual(HOME_VIEW);
    const far = panBy({ zoom: 4, centre: { x: 0, y: 0 } }, -1e6, 0, R);
    expect(far.centre.x).toBeCloseTo(0.75, 12);
  });

  it('centres on a point, zooming in only as far as that needs', () => {
    const earth = { x: 0.3, y: -0.4 };
    expect(centredOn({ zoom: 8, centre: { x: 0, y: 0 } }, earth)).toEqual({
      zoom: 8,
      centre: earth,
    });
    const fromHome = centredOn(HOME_VIEW, earth);
    expect(fromHome.zoom).toBeCloseTo(2, 12);
    expect(fromHome.centre.x).toBeCloseTo(0.3, 12);
    expect(fromHome.centre.y).toBeCloseTo(-0.4, 12);
    expect(centredOn(HOME_VIEW, { x: 0, y: 0 })).toEqual(HOME_VIEW);
    // Near the edge it stops at CENTRING_ZOOM, as near the middle as that allows.
    const voyager = centredOn(HOME_VIEW, { x: 0, y: -0.95 });
    expect(voyager.zoom).toBe(CENTRING_ZOOM);
    expect(voyager.centre.y).toBeCloseTo(-0.75, 12);
  });
});
