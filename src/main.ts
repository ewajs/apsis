/**
 * Wires the app together: picks the language, shows the shell and the map, loads the
 * data, keeps the displayed instant moving, and starts the 3D view the first time it's
 * asked for. Storage, the clock, the address bar and the browser's language
 * preferences are touched only here (the edges, ADR 0001).
 *
 * Address parameters, for links and tests: `t=2026-12-03T16:15Z` (show that instant,
 * paused; the address follows the instant as it moves), `play=day|week|month` (play
 * at that speed, `-day` backwards), `view=3d` (start in 3D), `focus=neptune` (what the
 * 3D camera orbits), `backend=webgl2` (force the 3D fallback).
 */
import './ui/styles.css';
import { pickLocale, setLocale, type Locale } from './i18n/localization.ts';
import { RADIUS_KM, SATURN_RINGS_KM } from './core/bodies.ts';
import { ROTATION } from './core/rotation.ts';
import { bodyName } from './i18n/bodies.ts';
import { SPEEDS, type Playback, type Speed } from './core/playback.ts';
import { parseInstant, tdbSecondsFromUtcMs } from './core/time.ts';
import { TimeController } from './time/controller.ts';
import { loadLiveData, type LiveData } from './data/load.ts';
import type { MapBody } from './map/solar-map.ts';
import type { SolarScene } from './scene/solar-scene.ts';
import { sceneFailed, sceneLabel, sceneLoading } from './ui/messages.ts';
import type { View } from './ui/view-switch.ts';
import './map/solar-map.ts';
import './ui/apsis-app.ts';

const LOCALE_KEY = 'apsis.locale';
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
const map = document.createElement('solar-map');
const sceneView = document.createElement('div');
sceneView.style.cssText =
  'position:relative;display:grid;place-content:center;min-height:0;color:var(--color-muted)';
sceneView.hidden = true;
app.append(map, sceneView);

let data: LiveData | undefined;
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
  void showLocale(locale).then(() => scene?.setNames(names()));
});

app.addEventListener('view-change', (event) => {
  void showView((event as CustomEvent<View>).detail);
});

/** Each view's own scale setting: log or true distances; enlarged or true sizes. */
const trueScale: Record<View, boolean> = { map: false, scene: false };
app.addEventListener('true-scale-change', (event) => {
  const value = (event as CustomEvent<boolean>).detail;
  trueScale[app.view] = value;
  app.trueScale = value;
  if (app.view === 'map') map.scale = value ? 'linear' : 'log';
  else if (scene) scene.trueScale = value;
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
  const now = performance.now();
  if (playback.rate !== 0 && !playback.live && now - addressWrittenAt < ADDRESS_EVERY_MS) return;
  addressWrittenAt = now;
  const address = new URL(location.href);
  if (playback.live) address.searchParams.delete('t');
  else address.searchParams.set('t', new Date(playback.instantMs).toISOString().slice(0, 16) + 'Z');
  history.replaceState(null, '', address);
}
showTime(time.playback);

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
      const created = await SolarScene.create({
        container: sceneView,
        label: sceneLabel(),
        texturesBase: `${import.meta.env.BASE_URL}textures/`,
        backend: params.get('backend') === 'webgl2' ? 'webgl2' : 'auto',
        sky: '2k_stars_milky_way.jpg',
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
      chunks: data!.chunks.get(body.id) ?? new Map(),
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
  scene.focus = params.get('focus') ?? 'sun';
  scene.trueScale = trueScale.scene;
  showTime(time.playback);
}

await showLocale(pickLocale(localStorage.getItem(LOCALE_KEY), navigator.languages));
document.body.replaceChildren(app);
if (params.get('view') === '3d') void showView('scene');

try {
  data = await loadLiveData(`${import.meta.env.BASE_URL}data/`);
  const bodies: MapBody[] = data.index.bodies.map((body) => ({
    id: body.id,
    kind: body.kind,
    name: data!.missions.find((mission) => mission.id === body.id)?.name ?? body.id,
    chunks: data!.chunks.get(body.id) ?? new Map(),
    orbit: data!.orbits.planets[body.id],
  }));
  map.bodies = bodies;
  map.status = 'ready';
  app.fetchedAt = data.index.fetchedAt;
  // Playback stops at the edges of the data. The span's dates are TDB; ending two
  // minutes early keeps clear of the last sample whatever the 69 s offset to UTC.
  time.range = app.timeRange = {
    startMs: Date.parse(`${data.index.span.start}T00:00Z`),
    endMs: Date.parse(`${data.index.span.stop}T00:00Z`) - 120_000,
  };
  // `?play=day` (or week, month; `-day` backwards) starts playing, until the slider exists.
  const play = params.get('play');
  const speed = play?.replace(/^-/, '') as Speed | undefined;
  if (speed && speed in SPEEDS) time.play((play!.startsWith('-') ? -1 : 1) * SPEEDS[speed]);
  fillScene();
} catch (error) {
  console.error(error);
  map.status = 'failed';
}
