import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, str, updateWhenLocaleChanges } from '@lit/localize';
import { currentLocale, type Locale } from '../i18n/localization.ts';
import './language-switch.ts';
import './scale-switch.ts';
import './time-slider.ts';
import type { Playback, Range } from '../core/playback.ts';
import './view-switch.ts';
import type { View } from './view-switch.ts';

/**
 * @component The app's frame: a top bar with the name and the language switch, the
 * main view (slotted in by main.ts: the map now, the 3D scene later) and a footer
 * with the data's source and date.
 *
 * Properties: `locale`, the language showing now; `view`, the map or the 3D scene;
 * `trueScale`, whether that view shows true scale (all passed to their switches);
 * `fetchedAt`, when the data was fetched (ISO 8601); `notice`, a short message for
 * the visitor, if any; `playback` and `timeRange`, for the time bar.
 * Events: `locale-change`, `view-change` and `true-scale-change` bubble up from the
 * switches, and `time-play`, `time-pause`, `time-seek` and `time-live` from the time bar.
 */
@customElement('apsis-app')
export class ApsisApp extends LitElement {
  /** The language showing now. */
  @property() locale: Locale = 'es-AR';
  /** When the data shown was fetched from Horizons, ISO 8601. */
  @property() fetchedAt = '';
  /** Which view is showing. */
  @property() view: View = 'map';
  /** Whether the view showing is at true scale. */
  @property({ type: Boolean }) trueScale = false;
  /** A short message for the visitor, shown under the header. */
  @property() notice = '';
  /** Where time is and how it moves, for the time bar. */
  @property({ attribute: false }) playback: Playback | undefined;
  /** The span there's data for, for the time bar. */
  @property({ attribute: false }) timeRange: Range | undefined;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto auto;
      height: 100dvh;
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
        env(safe-area-inset-left);
      box-sizing: border-box;
    }
    .controls {
      display: flex;
      gap: 8px;
    }
    .notice {
      margin: 0 var(--space);
      color: var(--color-muted);
      font-size: 0.85rem;
    }
    header,
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space);
      padding: calc(var(--space) * 0.5) var(--space);
    }
    h1 {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.12em;
    }
    h1 img {
      border-radius: 8px;
    }
    .tagline {
      color: var(--color-muted);
      font-weight: 400;
      letter-spacing: normal;
    }
    @media (max-width: 480px) {
      .tagline {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
    }
    main {
      position: relative;
      display: grid;
      min-height: 0;
    }
    footer {
      flex-wrap: wrap;
      font-size: 0.75rem;
      color: var(--color-muted);
    }
  `;

  override render() {
    const icon = `${import.meta.env.BASE_URL}icon.svg`;
    return html`
      <div>
        <header>
          <h1>
            <img src=${icon} width="28" height="28" alt="" />APSIS
            <span class="tagline">${msg('¿Dónde están ahora?', { id: 'tagline' })}</span>
          </h1>
          <span class="controls">
            <view-switch .view=${this.view}></view-switch>
            <language-switch .locale=${this.locale}></language-switch>
          </span>
        </header>
        <p class="notice" role="status">${this.notice}</p>
      </div>
      <main>
        <slot></slot>
        <scale-switch .view=${this.view} ?trueScale=${this.trueScale}></scale-switch>
      </main>
      <time-slider .playback=${this.playback} .range=${this.timeRange}></time-slider>
      <footer>
        <span
          >${msg('Posiciones: JPL Horizons, NASA/JPL-Caltech.', { id: 'credit-horizons' })}</span
        >
        ${this.fetchedAt ? html`<span>${this.#dataDate()}</span>` : nothing}
      </footer>
    `;
  }

  #dataDate() {
    const date = new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'medium' }).format(
      new Date(this.fetchedAt),
    );
    return msg(str`Datos del ${date}`, { id: 'data-date' });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'apsis-app': ApsisApp;
  }
}
