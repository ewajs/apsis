# AR

Two ways to bring Apsis into the room (ADR 0014), both through the phone's own AR:

- **A spacecraft,** from its card, in two sizes: "En tu casa (RA)", 1 m along its
  longest side (resizable), and "Tamaño real (RA)", locked at its true size. Under each,
  the card says what to expect: the scale, or the dimensions.
- **The solar system on a table,** from the tool column: the planets, their orbits and
  every spacecraft as they are at the shown instant, about 1.2 m across.

Neither exists on a desktop; their buttons only appear where a phone can show them.

## Which viewer

| Phone   | A spacecraft                                      | The tabletop                                   |
| ------- | ------------------------------------------------- | ---------------------------------------------- |
| iPhone  | Quick Look, a USDZ built ahead (`npm run models`) | Quick Look, a USDZ made in the page            |
| Android | Scene Viewer, a link to the AR copy (a real URL)  | WebXR in the page (Scene Viewer can't take it) |

`main.ts` works out which (`arViewer`): Safari announces Quick Look
(`relList.supports('ar')`), Android shows in its user agent, and the tabletop on Android
needs WebXR's `immersive-ar`. `?ar=quick-look` or `?ar=scene-viewer` forces one, for
tests.

## A spacecraft

Each model has four AR files (`public/models/ar/`, see [models.md](models.md)), named by
`arFile` (`core/ar.ts`):

| File           | What                                                         |
| -------------- | ------------------------------------------------------------ |
| `<id>.glb`     | The AR copy: plain glTF, stood up on the floor, at real size |
| `<id>-1m.glb`  | The same, 1 m along its longest side (`ROOM_LENGTH_M`)       |
| `<id>.usdz`    | The real size for Quick Look, binary USD, built ahead        |
| `<id>-1m.usdz` | The 1 m size for Quick Look                                  |

Android's links are built by `sceneViewerUrl`, resizable only at 1 m, titled with the
name and `arSizeNotes` (`ui/messages.ts`): "Juno · 1 m · escala 1:20". An iPhone's tap
opens the USDZ through a link with `rel="ar"` around an image (`scene/quick-look.ts`),
with `#allowsContentScaling=0` for the real size (`quickLookHref`). The 1 m one is
fetched when the card shows (`prepareAr` in `main.ts`) and opened from a blob once it
has arrived; the service worker keeps the last six (`apsis-ar`, `vite.config.ts`).
Offline with nothing kept, the tap shows a notice instead (`arOffline`).

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

- **iPhone:** the group is converted in the page with three's `USDZExporter`
  (`scene/ar-export.ts`) and handed to Quick Look as a blob: it depends on the instant,
  so it can't be built ahead.
- **Android:** `scene/tabletop-xr.ts` opens a WebXR AR session with its own renderer
  (WebGL, which XR needs). A ring marks the surface the phone finds; a tap puts the table
  there; a close button sits over the camera's view. The 3D view pauses meanwhile.

Nothing here can run in a headless browser: the tests check the handoffs (a Scene Viewer
links to real GLBs, the USDZ links for Quick Look, a blob for the tabletop), not the
viewers. `scripts/models/ar.test.ts` checks the files: all four per model, standing on
the floor, the 1 m copy 1 m long, the USDZ files binary and uncompressed.
