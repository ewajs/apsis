/**
 * Wires the app together: picks the language, then shows the shell. Storage and the
 * browser's language preferences are touched only here (the edges, ADR 0001).
 */
import './ui/styles.css';
import { pickLocale, setLocale, type Locale } from './i18n/localization.ts';
import './ui/apsis-app.ts';

const LOCALE_KEY = 'apsis.locale';

async function showLocale(app: HTMLElementTagNameMap['apsis-app'], locale: Locale) {
  await setLocale(locale);
  document.documentElement.lang = locale;
  app.locale = locale;
}

const app = document.createElement('apsis-app');
app.addEventListener('locale-change', (event) => {
  const locale = (event as CustomEvent<Locale>).detail;
  localStorage.setItem(LOCALE_KEY, locale);
  void showLocale(app, locale);
});

await showLocale(app, pickLocale(localStorage.getItem(LOCALE_KEY), navigator.languages));
document.body.replaceChildren(app);
