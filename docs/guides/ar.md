# AR

Two ways to bring Apsis into the room (ADR 0014), both through the phone's own AR:

- **A spacecraft,** from its card: "En tu casa (RA)" shows it at real size, standing on
  the floor.
- **The solar system on a table,** from the tool column: the planets, their orbits and
  every spacecraft as they are at the shown instant, about 1.2 m across.

Neither exists on a desktop; their buttons only appear where a phone can show them.

## Which viewer

| Phone   | A spacecraft                                         | The tabletop                                   |
| ------- | ---------------------------------------------------- | ---------------------------------------------- |
| iPhone  | Quick Look, a USDZ made in the page from the AR copy | Quick Look, a USDZ made in the page            |
| Android | Scene Viewer, a link to the AR copy (a real URL)     | WebXR in the page (Scene Viewer can't take it) |

`main.ts` works out which (`arViewer`): Safari announces Quick Look
(`relList.supports('ar')`), Android shows in its user agent, and the tabletop on Android
needs WebXR's `immersive-ar`. `?ar=quick-look` or `?ar=scene-viewer` forces one, for
tests.

## A spacecraft

Each model has an AR copy (`public/models/ar/`, see [models.md](models.md)): plain glTF,
stood antenna-up on the floor, at real size. Android's link is built by `sceneViewerUrl`
(`core/ar.ts`); an iPhone converts the copy with three's `USDZExporter` and hands the
blob to Quick Look through a link with `rel="ar"` around an image
(`scene/ar-export.ts`).

## The tabletop

`core/tabletop.ts` lays it out, pure and tested: distances from the Sun on the 2D map's
log scale (`core/projection.ts`), so the edge at 200 AU lands 60 cm from the Sun and
Neptune about 45 cm; heights keep each body's real angle above the ecliptic; sizes are
enlarged on a log scale too (the Sun 3 cm, Mercury 6 mm, Jupiter 15 mm), so planets can
be seen and still told apart.

`scene/tabletop.ts` builds it in three.js, in metres with +Y up: textured planets turned
as they are at that instant, a glowing Sun, Saturn's rings, orbits as fine tubes (USDZ
has no lines), spacecraft as beads with their last 30 days as threads, and a dark disc
3.5 cm below, so it reads as one object and the tilted orbits never dip under it.

- **iPhone:** the group goes to Quick Look, like a spacecraft.
- **Android:** `scene/tabletop-xr.ts` opens a WebXR AR session with its own renderer
  (WebGL, which XR needs). A ring marks the surface the phone finds; a tap puts the table
  there; a close button sits over the camera's view. The 3D view pauses meanwhile.

Nothing here can run in a headless browser: the tests check the handoffs (a Scene Viewer
link to a real GLB, a USDZ blob for Quick Look), not the viewers.
