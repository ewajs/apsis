import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import type { Locale } from '../i18n/localization.ts';
import './language-switch.ts';

/**
 * @component The app's frame: a top bar with the name and the language switch, and the
 * main area. Until the map and the scene arrive (M1, M2), the main area says what's coming.
 *
 * Properties: `locale`, the language showing now (passed to the switch).
 * Events: `locale-change` bubbles up from the switch.
 */
@customElement('apsis-app')
export class ApsisApp extends LitElement {
  /** The language showing now. */
  @property() locale: Locale = 'es-AR';

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: 100dvh;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
        env(safe-area-inset-left);
      box-sizing: border-box;
    }
    header,
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: calc(var(--space) * 0.75) var(--space);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
    }
    .brand img {
      border-radius: 8px;
    }
    main {
      display: grid;
      place-content: center;
      justify-items: center;
      gap: min(var(--space), 3dvh);
      padding: 0 var(--space);
      text-align: center;
    }
    main img {
      /* Smaller on short screens, such as a phone on its side. */
      width: min(128px, 22dvh);
      height: auto;
      border-radius: 26%;
      box-shadow: 0 0 0 1px var(--color-line);
    }
    h1 {
      margin: 0;
      font-size: clamp(1.6rem, 6vw, 2.4rem);
    }
    p {
      margin: 0;
      max-width: 32rem;
      line-height: 1.5;
      color: var(--color-muted);
    }
    footer {
      font-size: 0.8rem;
      color: var(--color-muted);
    }
  `;

  override render() {
    const icon = `${import.meta.env.BASE_URL}icon.svg`;
    return html`
      <header>
        <span class="brand"><img src=${icon} width="28" height="28" alt="" />APSIS</span>
        <language-switch .locale=${this.locale}></language-switch>
      </header>
      <main>
        <img src=${icon} width="128" height="128" alt="" />
        <h1>${msg('¿Dónde están ahora?', { id: 'tagline' })}</h1>
        <p>
          ${msg(
            'Muy pronto vas a poder ver dónde está cada misión al espacio profundo, en un sistema solar en 3D con datos de la NASA.',
            { id: 'coming-soon' },
          )}
        </p>
      </main>
      <footer>
        ${msg('Posiciones: JPL Horizons, NASA/JPL-Caltech.', { id: 'credit-horizons' })}
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'apsis-app': ApsisApp;
  }
}
