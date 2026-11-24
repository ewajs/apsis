import { configureLocalization } from '@lit/localize';

/** The languages Apsis speaks (ADR 0006). Spanish is the source; English is translated. */
export type Locale = 'es-AR' | 'en';

/** Every supported locale, in the order the language switch shows them. */
export const LOCALES: readonly Locale[] = ['es-AR', 'en'];

const localization = configureLocalization({
  sourceLocale: 'es-AR',
  targetLocales: ['en'],
  loadLocale: () => import('./locales/en.ts'),
});

/**
 * Switches every localized component to `locale`, loading its translations first.
 * Components that call `updateWhenLocaleChanges` re-render once it resolves.
 */
export function setLocale(locale: Locale): Promise<void> {
  return localization.setLocale(locale);
}

/** The language showing now, for formatting numbers and dates with `Intl`. */
export function currentLocale(): Locale {
  return localization.getLocale() as Locale;
}

/**
 * The locale for this visit: the one the visitor chose before, if valid; otherwise
 * Spanish for any Spanish browser language, English for anything else.
 * @param saved What was stored from a previous choice, if anything.
 * @param languages The browser's preferred languages, most preferred first.
 * @example pickLocale(null, ['es-MX', 'en']) // 'es-AR'
 */
export function pickLocale(saved: string | null, languages: readonly string[]): Locale {
  const chosen = LOCALES.find((locale) => locale === saved);
  if (chosen) return chosen;
  const first = languages[0]?.toLowerCase() ?? '';
  return first === 'es' || first.startsWith('es-') ? 'es-AR' : 'en';
}

/** Text written in both languages, as the catalogue has it (ADR 0009). */
export type Bilingual = { readonly es: string; readonly en: string };

/** The catalogue's text in the language showing now. */
export function localized(text: Bilingual): string {
  return currentLocale() === 'en' ? text.en : text.es;
}
