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
import { factsAt } from './core/facts.ts';
import { sceneViewerUrl } from './core/ar.ts';
import { stateFromChunks } from './core/interpolate.ts';
import { pickerEntries } from './ui/body-picker.ts';
import { yearsToLoad } from './core/loading.ts';
import type { MapBody } from './map/solar-map.ts';
import type { SolarScene } from './scene/solar-scene.ts';
import { scaleNote, sceneFailed, sceneLabel, sceneLoading } from './ui/messages.ts';
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

/** The AR copy of a spacecraft's model, as an absolute URL (AR viewers fetch it themselves). */
function arUrl(file: string): string {
  return new URL(`ar/${file}`, new URL(modelsBase, location.href)).href;
}

// The card's "En tu casa" on an iPhone: the AR copy, converted to USDZ, in Quick Look.
app.addEventListener('ar-view', () => {
  const model = models.find((entry) => entry.id === selected);
  if (!model) return;
  void import('./scene/ar-export.ts')
    .then(({ openInQuickLook }) => openInQuickLook(arUrl(model.file)))
    .catch((error: unknown) => console.error(error));
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
  if (mission) {
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
  const chunks = (id: string) => store!.chunks.get(id) ?? new Map();
  const kind = selected === 'sun' ? 'sun' : data.index.bodies.find((b) => b.id === selected)?.kind;
  if (!kind) return;
  // The Sun sits still at the origin of heliocentric states.
  const state =
    kind === 'sun' ? ([tdb, 0, 0, 0, 0, 0, 0] as const) : stateFromChunks(chunks(selected), tdb);
  const name = names()[selected] ?? selected;
  const model = models.find((entry) => entry.id === selected);
  app.card = {
    id: selected,
    kind,
    name,
    mission: data.missions.find((mission) => mission.id === selected),
    facts: state ? factsAt(state, stateFromChunks(chunks('earth'), tdb)) : null,
    instantMs: time.playback.instantMs,
    model,
    closeUp,
    ar: !model
      ? undefined
      : arViewer === 'scene-viewer'
        ? { viewer: 'scene-viewer', href: sceneViewerUrl(arUrl(model.file), name, location.href) }
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
  app.pickerEntries = pickerEntries(
    data.missions,
    planets.map((body) => body.id),
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
      body.kind === 'planet'
        ? bodyName(body.id)
        : (data!.missions.find((mission) => mission.id === body.id)?.name ?? body.id);
  }
  return all;
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
  const bodies: MapBody[] = data.index.bodies.map((body) => ({
    id: body.id,
    kind: body.kind,
    name: data!.missions.find((mission) => mission.id === body.id)?.name ?? body.id,
    chunks: store!.chunks.get(body.id) ?? new Map(),
    years: body.years.map((entry) => entry.year),
    orbit: data!.orbits.planets[body.id],
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
