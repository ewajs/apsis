# The 2D map

The solar system seen from above the ecliptic's north pole: the Sun, the planets with
their orbits (see [orbits.md](orbits.md)) and the spacecraft at one instant, with each
spacecraft's last 30 days as a trail. The scale rings are dashed, so they don't read
as orbits. Code:
`src/map/` (projection, labels, the `<solar-map>` component), `src/data/load.ts`,
`src/main.ts`.

| Phone, log scale (Spanish)           | Phone, true distances                              |
| ------------------------------------ | -------------------------------------------------- |
| ![The map on a phone](map-phone.png) | ![True distances on a phone](map-phone-linear.png) |

![The map on a desktop, in English](map-desktop.png)

All three at `?t=2026-11-23T12:00Z`.

## From data to the screen

1. `main.ts` loads everything `npm run data` wrote (`loadLiveData`): the index, the
   catalogue and every chunk. Two years of data, about 260 KB, so all at once.
2. It sets the map's `time` to now (TDB, `tdbSecondsFromUtcMs`) and moves it forward
   every 10 s. `?t=2026-12-03T16:15Z` in the address shows that instant instead and
   stops the clock; it's for tests and links, and the time slider (M3) will grow from it.
3. For each body, `<solar-map>` asks `stateFromChunks` for the state at `time`. A body
   without data at that instant isn't drawn, and the map lists it as "no data for this
   date". Nothing is ever placed by guesswork.
4. `mapPoint` turns each position into a point on the map (below), labels are placed
   (`placeLabels`), and Lit renders the SVG.

## Looking from above

The map drops each position's height above the ecliptic and keeps its direction in the
plane: +x points to the vernal equinox, +y is 90° ahead along Earth's orbit, so the
planets go round anticlockwise. Most bodies sit close to the plane; Voyager 1 is 35°
above it, so its distance on the map (141 AU in the plane) is shorter than its real one
(172 AU). The mission card (M4) will show real distances.

## Two scales

On a true (linear) scale, with Voyager 1 at the edge, everything inside Uranus's orbit
collapses into the middle. The map's button switches to it on purpose: it shows why
the default is logarithmic.

The log scale places a body at a radius proportional to `log10(1 + d / 0.1 AU)`:

- **Far out it's logarithmic:** each factor of 10 in distance gets about the same room
  (rings at 0.1, 1, 10 and 100 AU).
- **Near the Sun it turns linear,** thanks to the `1 +`: a plain logarithm would send
  anything closer than the innermost ring off to minus infinity, and Parker at
  perihelion (0.05 AU) would vanish into the Sun.
- **Directions never change,** only distances. The browser test that compares Earth's
  angle on the map with Horizons relies on that.

## Labels

Labels can't overlap each other, the markers, or the rings' own labels. `placeLabels`
goes through them in order of importance (spacecraft first, then planets) and tries
eight spots around each marker: right, left, above, below, then the diagonals. The
first free spot inside the visible area wins; with none free, the label hides.
Hovering or long-pressing any marker still names it (its SVG `<title>`). On a crowded
phone screen Mars may lose its label next to Psyche; the picker (M4) will name
everything.

The width of a label is estimated (6.6 px per character at 12 px), not measured:
measuring text in the DOM on every frame would cost more than an occasional loose fit.

## Layout

The map is centred in the space above its scale note and button, unless the screen is
wide enough for those to sit in the corners beside the circle (desktop, a phone on its
side). A `ResizeObserver` keeps the SVG's coordinates in CSS pixels, so text and
markers keep their size on any screen.

## Offline

The service worker caches each data file the first time it's loaded, and from then on
answers from that cache at once while refreshing it in the background
(stale-while-revalidate, ADR 0007). So the map opens offline, showing the last data
fetched.
