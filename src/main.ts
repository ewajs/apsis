/**
 * Wires the app together: picks the language, shows the shell and the map, loads the
 * data and keeps the displayed instant moving. Storage, the clock, the address bar and
 * the browser's language preferences are touched only here (the edges, ADR 0001).
 */
import './ui/styles.css';
import { pickLocale, setLocale, type Locale } from './i18n/localization.ts';
import { parseInstant, tdbSecondsFromUtcMs } from './core/time.ts';
import { loadLiveData } from './data/load.ts';
import type { MapBody } from './map/solar-map.ts';
import './map/solar-map.ts';
import './ui/apsis-app.ts';

const LOCALE_KEY = 'apsis.locale';
/** How often "now" moves forward, in ms. Spacecraft move a few pixels a day on the map. */
const CLOCK_TICK_MS = 10_000;

const app = document.createElement('apsis-app');
const map = document.createElement('solar-map');
app.append(map);

async function showLocale(locale: Locale) {
  await setLocale(locale);
  document.documentElement.lang = locale;
  app.locale = locale;
}

app.addEventListener('locale-change', (event) => {
  const locale = (event as CustomEvent<Locale>).detail;
  localStorage.setItem(LOCALE_KEY, locale);
  void showLocale(locale);
});

// `?t=2026-12-03T16:15Z` shows that instant instead of now, and stops the clock.
const fixedTime = parseInstant(new URLSearchParams(location.search).get('t'));
const showTime = () => (map.time = tdbSecondsFromUtcMs(fixedTime ?? Date.now()));
showTime();
if (fixedTime === null) setInterval(showTime, CLOCK_TICK_MS);

await showLocale(pickLocale(localStorage.getItem(LOCALE_KEY), navigator.languages));
document.body.replaceChildren(app);

try {
  const data = await loadLiveData(`${import.meta.env.BASE_URL}data/`);
  const bodies: MapBody[] = data.index.bodies.map((body) => ({
    id: body.id,
    kind: body.kind,
    name: data.missions.find((mission) => mission.id === body.id)?.name ?? body.id,
    chunks: data.chunks.get(body.id) ?? new Map(),
    orbit: data.orbits.planets[body.id],
  }));
  map.bodies = bodies;
  map.status = 'ready';
  app.fetchedAt = data.index.fetchedAt;
} catch (error) {
  console.error(error);
  map.status = 'failed';
}
