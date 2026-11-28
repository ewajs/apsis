/**
 * Wires the app together: picks the language, shows the shell and the map, loads the
 * data, keeps the displayed instant moving, and starts the 3D view the first time it's
 * asked for. Storage, the clock, the address bar and the browser's language
 * preferences are touched only here (the edges, ADR 0001).
 *
 * Address parameters, for links and tests: `t=2026-12-03T16:15Z` (show that instant,
 * paused; the address follows the instant as it moves), `play=day|week|month` (play
 * at that speed, `-day` backwards), `view=3d` (start in 3D), `focus=juno` (what's
 * selected: the map rings it, the 3D camera orbits it; the address follows the
 * selection), `backend=webgl2` (force the 3D fallback).
 */
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './ui/styles.css';
import { pickLocale, setLocale, type Locale } from './i18n/localization.ts';
import { RADIUS_KM, SATURN_RINGS_KM } from './core/bodies.ts';
import { ROTATION } from './core/rotation.ts';
import { bodyName } from './i18n/bodies.ts';
import { SPEEDS, type Playback, type Speed } from './core/playback.ts';
import { parseInstant, tdbSecondsFromUtcMs } from './core/time.ts';
import { TimeController } from './time/controller.ts';
import { ChunkStore, loadCatalogue, loadModels, type Catalogue } from './data/load.ts';
import { instantWithData } from './core/catalogue.ts';
import { earthOrbitFacts, factsAt } from './core/facts.ts';
import {
  positionAt,
  SATELLITE_DAYS,
  trackOffset,
  trackSampleAt,
  velocityAt,
} from './core/positions.ts';
import { elementsFromState, sampleOrbit } from './core/elements.ts';
import { EARTH_MU, gpEpochMs } from './core/earth-orbit.ts';
import { subtract } from './core/math.ts';
import { arFile, quickLookHref, sceneViewerUrl, type ArSize } from './core/ar.ts';
import { stateFromChunks } from './core/interpolate.ts';
import { pickerEntries } from './ui/body-picker.ts';
import { yearsToLoad } from './core/loading.ts';
import type { MapBody } from './map/solar-map.ts';
import type { SolarScene } from './scene/solar-scene.ts';
import {
  arOffline,
  arSizeNotes,
  closeLabel,
  scaleNote,
  sceneFailed,
  sceneLabel,
  sceneLoading,
} from './ui/messages.ts';
import { openInQuickLook } from './scene/quick-look.ts';
import type { ModelEntry } from './core/models.ts';
import { trailPoints } from './core/trails.ts';
import type { TableBody } from './scene/tabletop.ts';
import type { View } from './ui/view-switch.ts';
import './map/solar-map.ts';
import './ui/apsis-app.ts';

const LOCALE_KEY = 'apsis.locale';
/** How long a passing notice (the scale just chosen) stays, in ms. */
const NOTICE_MS = 3_000;
/** How often, at most, the address bar follows the playing instant, in ms. */
const ADDRESS_EVERY_MS = 500;
/** Texture files (public/textures, credited in CREDITS.md), by body id. */
const TEXTURES: Readonly<Record<string, string>> = {
  sun: '2k_sun.jpg',
  mercury: '2k_mercury.jpg',
  venus: '2k_venus_atmosphere.jpg',
  earth: '2k_earth_daymap.jpg',
  mars: '2k_mars.jpg',
  jupiter: '2k_jupiter.jpg',
  saturn: '2k_saturn.jpg',
  uranus: '2k_uranus.jpg',
  neptune: '2k_neptune.jpg',
  // Moons: loaded only when a close-up shows them (never precached).
  moon: 'bodies/2k_moon.jpg',
  io: 'bodies/2k_io.jpg',
  europa: 'bodies/2k_europa.jpg',
  ganymede: 'bodies/2k_ganymede.jpg',
  callisto: 'bodies/2k_callisto.jpg',
  enceladus: 'bodies/2k_enceladus.jpg',
  titan: 'bodies/2k_titan.jpg',
  phobos: 'bodies/2k_phobos.jpg',
  deimos: 'bodies/2k_deimos.jpg',
  triton: 'bodies/2k_triton.jpg',
  charon: 'bodies/2k_charon.jpg',
  pluto: 'bodies/2k_pluto.jpg',
  ceres: 'bodies/2k_ceres.jpg',
  vesta: 'bodies/2k_vesta.jpg',
};
/** Small bodies without a map: a rock colour each (no shape models yet). */
const COLORS: Readonly<Record<string, string>> = {
  'psyche-asteroid': '#8d877d',
  didymos: '#77716b',
  'comet-67p': '#56524d',
  arrokoth: '#a0675c',
};

const params = new URLSearchParams(location.search);
const app = document.createElement('apsis-app');
app.version = __APP_VERSION__;
const map = document.createElement('solar-map');
const sceneView = document.createElement('div');
sceneView.style.cssText =
  'position:relative;display:grid;place-content:center;min-height:0;color:var(--color-muted)';
sceneView.hidden = true;
app.append(map, sceneView);

let data: Catalogue | undefined;
/** The spacecraft models there are (ADR 0013), fetched once at start-up. */
const modelsBase = `${import.meta.env.BASE_URL}models/`;
const modelsLoading = loadModels(modelsBase);
let models: Awaited<typeof modelsLoading> = [];
void modelsLoading.then((loaded) => {
  models = loaded;
  showCard();
});
/** Whether the 3D camera is close up to the selected spacecraft's model. */
let closeUp = false;

/**
 * Which AR viewer this phone has (ADR 0014): Quick Look on an iPhone or iPad (Safari
 * says so through `rel="ar"`), Scene Viewer on Android; none elsewhere. `?ar=` forces
 * one, for tests.
 */
const arViewer = ((): 'quick-look' | 'scene-viewer' | null => {
  const forced = params.get('ar');
  if (forced === 'quick-look' || forced === 'scene-viewer') return forced;
  if (document.createElement('a').relList.supports('ar')) return 'quick-look';
  return /android/i.test(navigator.userAgent) ? 'scene-viewer' : null;
})();

/**
 * How this phone can show the solar system on a table (ADR 0014): Quick Look takes it
 * as a file made in the page; on Android, Scene Viewer can't, so WebXR shows it live,
 * where the browser offers AR. Asked without loading the 3D code.
 */
void (async () => {
  if (arViewer === 'quick-look') app.tabletop = true;
  else if (arViewer === 'scene-viewer') {
    app.tabletop =
      (await navigator.xr?.isSessionSupported('immersive-ar').catch(() => false)) ?? false;
  }
})();

/** Every body as it is at the shown instant, for the tabletop. */
function tableBodies(): TableBody[] {
  const tdb = tdbSecondsFromUtcMs(time.playback.instantMs);
  const bodies: TableBody[] = [
    {
      id: 'sun',
      kind: 'sun',
      at: [0, 0, 0],
      radiusKm: RADIUS_KM.sun!,
      texture: TEXTURES.sun,
      rotation: ROTATION.sun,
    },
  ];
  for (const body of data?.index.bodies ?? []) {
    // At a table's scale a moon sits on its planet.
    if (body.kind === 'moon') continue;
    const chunks = store?.chunks.get(body.id) ?? new Map();
    const state = stateFromChunks(chunks, tdb);
    if (!state) continue;
    const at = [state[1], state[2], state[3]] as const;
    bodies.push(
      body.kind === 'planet'
        ? {
            id: body.id,
            kind: 'planet',
            at,
            radiusKm: RADIUS_KM[body.id] ?? 0,
            texture: TEXTURES[body.id],
            orbit: data!.orbits.planets[body.id],
            rotation: ROTATION[body.id],
            rings:
              body.id === 'saturn'
                ? { innerKm: SATURN_RINGS_KM.inner, outerKm: SATURN_RINGS_KM.outer }
                : undefined,
          }
        : { id: body.id, kind: 'spacecraft', at, radiusKm: 0, trail: trailPoints(chunks, tdb) },
    );
  }
  return bodies;
}

// The tool column's AR tabletop: the solar system at the shown instant, on a table.
app.addEventListener('tabletop', () => {
  void (async () => {
    const { buildTabletop } = await import('./scene/tabletop.ts');
    const craftColor = getComputedStyle(document.documentElement).getPropertyValue('--color-craft');
    const table = await buildTabletop(
      tableBodies(),
      tdbSecondsFromUtcMs(time.playback.instantMs),
      `${import.meta.env.BASE_URL}textures/`,
      craftColor.trim(),
    );
    if (arViewer === 'quick-look') {
      const { openObjectInQuickLook } = await import('./scene/ar-export.ts');
      await openObjectInQuickLook(table);
    } else {
      // The 3D view pauses while AR has the screen.
      scene?.stop();
      const { showInAr } = await import('./scene/tabletop-xr.ts');
      await showInAr(table, closeLabel(), () => {
        if (app.view === 'scene') scene?.start();
      });
    }
  })().catch((error: unknown) => console.error(error));
});

/**
 * On an iPhone, the selected spacecraft's 1 m USDZ, fetched as soon as its card shows so
 * "En tu casa (RA)" opens at once (ADR 0014): whose it is, and the file as a blob URL
 * once it has arrived. One spacecraft at a time. The service worker keeps the last few
 * for offline. (On Android, Scene Viewer fetches files itself: nothing to get ready.)
 */
let arReady: { id: string; href?: string } | undefined;

/** Starts fetching a spacecraft's 1 m USDZ, unless it's already the one getting ready. */
function prepareAr(model: ModelEntry) {
  if (arViewer !== 'quick-look' || arReady?.id === model.id) return;
  if (arReady?.href) URL.revokeObjectURL(arReady.href);
  const ready: { id: string; href?: string } = { id: model.id };
  arReady = ready;
  // A failure (offline, and not kept) leaves it unready: a tap says so, or downloads it.
  void fetch(arUrl(arFile(model.id, 'room', 'usdz')))
    .then((response) => (response.ok ? response.blob() : null))
    .then((blob) => {
      if (!blob || arReady !== ready) return;
      ready.href = URL.createObjectURL(new Blob([blob], { type: 'model/vnd.usdz+zip' }));
    })
    .catch(() => undefined);
}

/** Scene Viewer's links for a spacecraft's two AR sizes, titled with its name and size. */
function sceneViewerHrefs(model: ModelEntry, name: string): Record<ArSize, string> {
  const notes = arSizeNotes(model);
  const href = (size: ArSize) =>
    sceneViewerUrl(
      arUrl(arFile(model.id, size, 'glb')),
      `${name} · ${notes[size]}`,
      location.href,
      size,
    );
  return { room: href('room'), real: href('real') };
}

/** A spacecraft's AR file, as an absolute URL (AR viewers fetch it themselves). */
function arUrl(file: string): string {
  return new URL(`ar/${file}`, new URL(modelsBase, location.href)).href;
}

// The card's "En tu casa" on an iPhone: the AR copy, converted to USDZ, in Quick Look.
app.addEventListener('ar-view', (event) => {
  const model = models.find((entry) => entry.id === selected);
  if (!model) return;
  const size = (event as CustomEvent<ArSize>).detail;
  // Straight from the tap, nothing awaited, so Safari still counts it as the visitor's:
  // the 1 m file if it has arrived, else the file's address for Quick Look to download.
  if (size === 'room' && arReady?.id === model.id && arReady.href) {
    openInQuickLook(arReady.href);
  } else if (!navigator.onLine) {
    say(arOffline());
  } else {
    openInQuickLook(quickLookHref(arUrl(arFile(model.id, size, 'usdz')), size));
  }
});
let store: ChunkStore | undefined;
let scene: SolarScene | undefined;
let sceneStarting: Promise<SolarScene | undefined> | undefined;

async function showLocale(locale: Locale) {
  await setLocale(locale);
  document.documentElement.lang = locale;
  app.locale = locale;
}

app.addEventListener('locale-change', (event) => {
  const locale = (event as CustomEvent<Locale>).detail;
  localStorage.setItem(LOCALE_KEY, locale);
  void showLocale(locale).then(() => {
    scene?.setNames(names());
    fillPicker();
    showCard();
  });
});

app.addEventListener('view-change', (event) => {
  void showView((event as CustomEvent<View>).detail);
});

/** Each view's own scale setting: log or true distances; enlarged or true sizes. */
const trueScale: Record<View, boolean> = { map: false, scene: false };
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
/** Says something briefly under the top controls. */
function say(text: string) {
  clearTimeout(noticeTimer);
  app.notice = text;
  noticeTimer = setTimeout(() => (app.notice = ''), NOTICE_MS);
}

app.addEventListener('true-scale-change', (event) => {
  const value = (event as CustomEvent<boolean>).detail;
  trueScale[app.view] = value;
  app.trueScale = value;
  if (app.view === 'map') map.scale = value ? 'linear' : 'log';
  else if (scene) scene.trueScale = value;
  say(scaleNote(app.view, value));
});

/** The selected body ('sun', a planet, a mission), or none; `?focus=` in the address. */
let selected: string | null = params.get('focus');

/**
 * Selects a body in every view, and the address follows. A mission picked at an instant
 * it has no positions for (Cassini today) takes time to the nearest one it has.
 * @param move Whether the views go to it: the 3D camera flies there, the map brings it
 *   to the middle. A tap on the map selects in place; at start-up, it's simply there.
 */
function select(id: string | null, move: 'fly' | 'jump' | 'stay' = 'fly') {
  const mission = id ? data?.missions.find((entry) => entry.id === id) : undefined;
  const satellite = id ? data?.index.bodies.find((body) => body.id === id)?.satellite : undefined;
  if (satellite) {
    // Its orbital data holds for a few days (ADR 0016): far from them, back to its date.
    const epochMs = gpEpochMs(satellite);
    if (Math.abs(time.playback.instantMs - epochMs) > SATELLITE_DAYS * 86_400_000) {
      time.seek(epochMs);
    }
  } else if (mission) {
    const instant = instantWithData(mission, time.playback.instantMs);
    if (instant !== time.playback.instantMs) time.seek(instant);
  }
  selected = id;
  closeUp = false;
  app.selected = map.selected = id;
  scene?.select(id, move === 'fly');
  showCard();
  if (id && move !== 'stay') map.centreOnSelection();
  const address = new URL(location.href);
  if (id) address.searchParams.set('focus', id);
  else address.searchParams.delete('focus');
  history.replaceState(null, '', address);
}
app.addEventListener('body-select', (event) => {
  // The picker's events reach here retargeted to the shell; the map's come from the map.
  const id = (event as CustomEvent<string | null>).detail;
  select(id, event.target === map ? 'stay' : 'fly');
});

/** The selection's card at the displayed instant: its distances, speed and story. */
function showCard() {
  if (!selected || !data || !store) {
    app.card = undefined;
    return;
  }
  const tdb = tdbSecondsFromUtcMs(time.playback.instantMs);
  const entry = data.index.bodies.find((b) => b.id === selected);
  const kind = selected === 'sun' ? 'sun' : entry?.kind;
  if (!kind) return;
  const world = store.world;
  const at = positionAt(selected, tdb, world);
  const velocity = velocityAt(selected, tdb, world);
  // Computed from orbital elements when its track covers this instant (ADR 0015).
  const track = world.get(selected)?.track;
  const computed = track !== undefined && trackOffset(track.chunks, tdb) !== null;
  const name = names()[selected] ?? selected;
  const model = models.find((entry) => entry.id === selected);
  if (model) prepareAr(model);
  const earth = positionAt('earth', tdb, world);
  const earthVelocity = velocityAt('earth', tdb, world);
  app.card = {
    id: selected,
    kind,
    name,
    mission: data.missions.find((mission) => mission.id === selected),
    facts: at && velocity ? factsAt(at, velocity, earth) : null,
    aroundEarth: entry?.satellite && {
      facts:
        at && velocity && earth && earthVelocity
          ? earthOrbitFacts(at, velocity, earth, earthVelocity)
          : null,
      periodSeconds: 86_400 / entry.satellite.MEAN_MOTION,
      epochMs: gpEpochMs(entry.satellite),
    },
    parent: entry?.track && kind === 'moon' ? names()[entry.track.center] : undefined,
    computed,
    instantMs: time.playback.instantMs,
    model,
    closeUp,
    ar: !model
      ? undefined
      : arViewer === 'scene-viewer'
        ? { viewer: 'scene-viewer', href: sceneViewerHrefs(model, name) }
        : arViewer === 'quick-look'
          ? { viewer: 'quick-look' }
          : undefined,
  };
}

// The card's close-up: dive to the model in 3D (from the map, 3D opens first), or back out.
app.addEventListener('close-up', (event) => {
  const on = (event as CustomEvent<boolean>).detail;
  void (async () => {
    if (on && app.view !== 'scene') await showView('scene');
    closeUp = on;
    scene?.closeUp(on);
    showCard();
  })();
});

/** The picker's list, in the language showing now. */
function fillPicker() {
  if (!data) return;
  const planets = data.index.bodies.filter((body) => body.kind === 'planet');
  const moons = data.index.bodies.flatMap((body) =>
    body.kind === 'moon' && body.track ? [{ id: body.id, parent: body.track.center }] : [],
  );
  const small = data.index.bodies.filter((body) => body.kind === 'small').map((body) => body.id);
  app.pickerEntries = pickerEntries(
    data.missions,
    planets.map((body) => body.id),
    moons,
    small,
  );
}

// Zoom: the tool column's buttons act on whichever view is showing.
app.addEventListener('zoom-by', (event) => {
  const factor = (event as CustomEvent<number>).detail;
  if (app.view === 'map') map.zoomBy(factor);
  else scene?.zoomBy(factor);
});
app.addEventListener('view-home', () => map.goHome());
map.addEventListener('map-view-change', (event) => {
  app.mapAtHome = (event as CustomEvent<boolean>).detail;
});

// The displayed instant: now, or `?t=…` paused there (ADR 0011, docs/guides/time.md).
const time = new TimeController(parseInstant(params.get('t')), showTime);
let addressWrittenAt = 0;

/** Hands the instant to both views, and keeps `?t=` in the address bar in step. */
function showTime(playback: Playback) {
  const tdb = tdbSecondsFromUtcMs(playback.instantMs);
  map.time = tdb;
  if (scene) scene.time = tdb;
  app.playback = playback;
  showCard();
  loadYearsFor(playback);
  const now = performance.now();
  if (playback.rate !== 0 && !playback.live && now - addressWrittenAt < ADDRESS_EVERY_MS) return;
  addressWrittenAt = now;
  const address = new URL(location.href);
  if (playback.live) address.searchParams.delete('t');
  else address.searchParams.set('t', new Date(playback.instantMs).toISOString().slice(0, 16) + 'Z');
  history.replaceState(null, '', address);
}
showTime(time.playback);

/** Loads the years the shown instant needs (ADR 0011), and redraws once they're in. */
function loadYearsFor(playback: Playback) {
  if (!store) return;
  const loading = store.ensure(yearsToLoad(playback.instantMs, playback.rate));
  map.loadingYears = store.loading;
  loading
    .then((arrived) => {
      if (!arrived) return;
      map.requestUpdate();
      showCard();
      scene?.refresh();
    })
    .catch((error: unknown) => console.error(error))
    .finally(() => (map.loadingYears = store!.loading));
}

// The time bar's intents.
app.addEventListener('time-play', (event) => time.play((event as CustomEvent<number>).detail));
app.addEventListener('time-pause', () => time.pause());
app.addEventListener('time-seek', (event) => time.seek((event as CustomEvent<number>).detail));
app.addEventListener('time-live', () => time.goLive());

/**
 * Shows the map or the 3D view; the 3D code loads the first time it's needed.
 * @param notice What to tell the visitor, if anything (why 3D isn't showing).
 */
async function showView(view: View, notice = '') {
  app.view = view;
  app.trueScale = trueScale[view];
  app.notice = notice;
  map.hidden = view !== 'map';
  sceneView.hidden = view !== 'scene';
  if (view === 'map') {
    scene?.stop();
    return;
  }
  const started = await startScene();
  if (!started) {
    await showView('map', sceneFailed());
    return;
  }
  started.start();
}

function startScene(): Promise<SolarScene | undefined> {
  sceneStarting ??= (async () => {
    sceneView.textContent = sceneLoading();
    try {
      // three.js is large: it loads only when someone asks for 3D.
      const { SolarScene } = await import('./scene/solar-scene.ts');
      models = await modelsLoading;
      const created = await SolarScene.create({
        container: sceneView,
        label: sceneLabel(),
        texturesBase: `${import.meta.env.BASE_URL}textures/`,
        backend: params.get('backend') === 'webgl2' ? 'webgl2' : 'auto',
        sky: '2k_stars_milky_way.jpg',
        onPick: (id) => select(id),
        models: { base: modelsBase, entries: models },
      });
      sceneView.firstChild?.remove(); // the loading text
      sceneView.style.cssText = 'position:relative;display:grid;min-height:0';
      scene = created;
      fillScene();
      return created;
    } catch (error) {
      console.error(error);
      sceneView.textContent = '';
      return undefined;
    }
  })();
  return sceneStarting;
}

/** Every body's name in the language showing now: planets translated, missions as named. */
function names(): Record<string, string> {
  const all: Record<string, string> = { sun: bodyName('sun') };
  for (const body of data?.index.bodies ?? []) {
    all[body.id] =
      body.kind === 'planet' || body.kind === 'moon' || body.kind === 'small'
        ? bodyName(body.id)
        : (data!.missions.find((mission) => mission.id === body.id)?.name ?? body.id);
  }
  return all;
}

/**
 * A tracked body's ellipse at an instant, to draw (from its track); for a moon, also its
 * planet. A small body's centre is the Sun: no parent.
 */
function trackExtras(id: string, center: string) {
  return {
    parent: center === 'sun' ? undefined : center,
    localOrbit: (t: number) => {
      const chunks = store!.world.get(id)?.track?.chunks;
      const sample = chunks ? trackSampleAt(chunks, t) : null;
      return sample ? sampleOrbit(sample) : null;
    },
  };
}

/**
 * A satellite's ellipse around Earth at an instant (ADR 0016): the two-body orbit its
 * position and velocity there describe, framed with Earth when it's picked.
 */
function satelliteExtras(id: string) {
  return {
    parent: 'earth',
    framedByParent: true,
    localOrbit: (t: number) => {
      const world = store!.world;
      const [at, velocity] = [positionAt(id, t, world), velocityAt(id, t, world)];
      const [earth, earthVelocity] = [positionAt('earth', t, world), velocityAt('earth', t, world)];
      if (!at || !velocity || !earth || !earthVelocity) return null;
      return elementsFromState(subtract(at, earth), subtract(velocity, earthVelocity), EARTH_MU, t);
    },
  };
}

/** Hands the scene its bodies, once both the scene and the data are there. */
function fillScene() {
  if (!scene || !data) return;
  const named = names();
  scene.setBodies(
    data.index.bodies.map((body) => ({
      id: body.id,
      kind: body.kind,
      name: named[body.id]!,
      // Spacecraft are metres across: always drawn at their minimum size.
      radiusKm: RADIUS_KM[body.id] ?? 0,
      chunks: store!.chunks.get(body.id) ?? new Map(),
      texture: TEXTURES[body.id],
      orbit: data!.orbits.planets[body.id],
      rotation: ROTATION[body.id],
      rings:
        body.id === 'saturn'
          ? {
              innerKm: SATURN_RINGS_KM.inner,
              outerKm: SATURN_RINGS_KM.outer,
              texture: '2k_saturn_ring_alpha.png',
            }
          : undefined,
      // One way to place everything: a track where there is one, else states (ADR 0015).
      place: (t: number) => positionAt(body.id, t, store!.world),
      color: COLORS[body.id],
      ...(body.track && trackExtras(body.id, body.track.center)),
      ...(body.satellite && satelliteExtras(body.id)),
    })),
    {
      name: named.sun!,
      radiusKm: RADIUS_KM.sun!,
      texture: TEXTURES.sun!,
      rotation: ROTATION.sun!,
    },
  );
  scene.select(selected, false);
  scene.trueScale = trueScale.scene;
  showTime(time.playback);
}

await showLocale(pickLocale(localStorage.getItem(LOCALE_KEY), navigator.languages));
document.body.replaceChildren(app);
if (params.get('view') === '3d') void showView('scene');

try {
  const base = `${import.meta.env.BASE_URL}data/`;
  data = await loadCatalogue(base);
  store = new ChunkStore(base, data.index);
  // The map leaves moons and satellites out: at its scale they sit on their planet.
  const onMap = data.index.bodies.filter((body) => body.kind !== 'moon' && !body.satellite);
  const bodies: MapBody[] = onMap.map((body) => ({
    id: body.id,
    kind: body.kind,
    name: data!.missions.find((mission) => mission.id === body.id)?.name ?? body.id,
    chunks: store!.chunks.get(body.id) ?? new Map(),
    years: body.years.map((entry) => entry.year),
    orbit: data!.orbits.planets[body.id],
    ...(body.kind === 'small' && {
      place: (t: number) => positionAt(body.id, t, store!.world),
      orbitAt: trackExtras(body.id, 'sun').localOrbit,
    }),
  }));
  map.bodies = bodies;
  fillPicker();
  if (selected) select(selected, 'jump');
  await store.ensure(yearsToLoad(time.playback.instantMs, time.playback.rate));
  map.status = 'ready';
  showCard();
  app.fetchedAt = data.index.fetchedAt;
  // Playback runs from the first archived year to the end of the live data. The live
  // span's dates are TDB; ending two minutes early keeps clear of the last sample
  // whatever the 69 s offset to UTC.
  const firstYear = Math.min(...data.index.bodies.flatMap((body) => body.years.map((y) => y.year)));
  time.range = app.timeRange = {
    startMs: Date.UTC(firstYear, 0, 1),
    endMs: Date.parse(`${data.index.span.stop}T00:00Z`) - 120_000,
  };
  // `?play=day` (or week, month; `-day` backwards) starts playing from the link.
  const play = params.get('play');
  const speed = play?.replace(/^-/, '') as Speed | undefined;
  if (speed && speed in SPEEDS) time.play((play!.startsWith('-') ? -1 : 1) * SPEEDS[speed]);
  fillScene();
} catch (error) {
  console.error(error);
  map.status = 'failed';
}
