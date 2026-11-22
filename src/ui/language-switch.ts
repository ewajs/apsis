import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { LOCALES, type Locale } from '../i18n/localization.ts';

/** Each language named in itself, so a visitor finds their own whatever is showing. */
const NAMES: Record<Locale, { short: string; long: string; lang: string }> = {
  'es-AR': { short: 'ES', long: 'Español', lang: 'es' },
  en: { short: 'EN', long: 'English', lang: 'en' },
};

/**
 * @component A two-button switch between Spanish and English.
 *
 * Properties: `locale`, the language showing now.
 * Events: `locale-change` (detail: the chosen `Locale`), only when it differs. The
 * switch doesn't change the language itself; whoever owns it does, then updates `locale`.
 */
@customElement('language-switch')
export class LanguageSwitch extends LitElement {
  /** The language showing now; its button is pressed. */
  @property() locale: Locale = 'es-AR';

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = css`
    :host {
      display: inline-flex;
      border: 1px solid var(--color-line);
      border-radius: 999px;
      padding: 3px;
    }
    button {
      min-width: 44px;
      min-height: 44px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--color-muted);
      font: 600 0.85rem var(--font-ui);
      letter-spacing: 0.05em;
      cursor: pointer;
      transition:
        background var(--dur-fast),
        color var(--dur-fast);
    }
    button[aria-pressed='true'] {
      background: var(--color-surface);
      color: var(--color-text);
    }
    button:focus-visible {
      outline: 2px solid var(--color-craft);
      outline-offset: 2px;
    }
  `;

  override render() {
    return html`<div role="group" aria-label=${msg('Idioma', { id: 'language' })}>
      ${LOCALES.map(
        (locale) =>
          html`<button
            type="button"
            lang=${NAMES[locale].lang}
            title=${NAMES[locale].long}
            aria-label=${NAMES[locale].long}
            aria-pressed=${locale === this.locale}
            @click=${() => this.#choose(locale)}
          >
            ${NAMES[locale].short}
          </button>`,
      )}
    </div>`;
  }

  #choose(locale: Locale) {
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
