import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { LOCALES, type Locale } from '../i18n/localization.ts';
import { glass } from './glass.ts';

/** Each language named in itself, so a visitor finds their own whatever is showing. */
const NAMES: Record<Locale, { short: string; long: string; lang: string }> = {
  'es-AR': { short: 'ES', long: 'Español', lang: 'es' },
  en: { short: 'EN', long: 'English', lang: 'en' },
};

/**
 * @component A small glass pill showing the language ("ES ▾"); a native select under it
 * lists every language by its own name.
 *
 * Properties: `locale`, the language showing now.
 * Events: `locale-change` (detail: the chosen `Locale`), only when it differs. The
 * switch doesn't change the language itself; whoever owns it does, then updates `locale`.
 */
@customElement('language-switch')
export class LanguageSwitch extends LitElement {
  /** The language showing now. */
  @property() locale: Locale = 'es-AR';

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = [
    glass,
    css`
      label {
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
        height: 44px;
        padding: 0 12px;
        font: 600 0.8rem var(--font-display);
        letter-spacing: 0.04em;
      }
      /* The select covers the pill, invisible: tapping anywhere opens the native list. */
      select {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
        font-size: 16px;
      }
      label:has(select:focus-visible) {
        outline: 2px solid var(--color-craft);
        outline-offset: 2px;
      }
      span[aria-hidden] {
        color: var(--color-muted);
        font-size: 0.7rem;
      }
    `,
  ];

  override render() {
    return html`<label class="glass pill">
      ${NAMES[this.locale].short}<span aria-hidden="true">▾</span>
      <select aria-label=${msg('Idioma', { id: 'language' })} @change=${this.#choose}>
        ${LOCALES.map(
          (locale) =>
            html`<option
              value=${locale}
              lang=${NAMES[locale].lang}
              ?selected=${locale === this.locale}
            >
              ${NAMES[locale].long}
            </option>`,
        )}
      </select>
    </label>`;
  }

  #choose(event: Event) {
    const locale = (event.target as HTMLSelectElement).value as Locale;
    if (locale === this.locale) return;
    this.dispatchEvent(
      new CustomEvent<Locale>('locale-change', { detail: locale, bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'language-switch': LanguageSwitch;
  }
}
