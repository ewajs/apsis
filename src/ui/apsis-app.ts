import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import type { Playback, Range } from '../core/playback.ts';
import type { Locale } from '../i18n/localization.ts';
import { glass } from './glass.ts';
import { icons } from './icons.ts';
import type { InfoPanel } from './info-panel.ts';
import type { View } from './view-switch.ts';
import './info-panel.ts';
import './language-switch.ts';
import './time-slider.ts';
import './view-switch.ts';
import './view-tools.ts';

/**
 * @component The app's frame (the Glass look, after gravitas): the view (slotted in by
 * main.ts: the map or the 3D scene) fills the screen, and everything else floats over
 * it. Top: the name, then the view switch, the language and the info button; under
 * them, a notice when there is one. Right edge: the tool column. Bottom: the time dock.
 *
 * Properties: `locale`; `view` (the map or the 3D scene); `trueScale` (for the tool
 * column); `fetchedAt` and `version` (for the info panel); `notice`, a short message
 * for the visitor, if any; `playback` and `timeRange`, for the time dock.
 * Events: `locale-change`, `view-change` and `true-scale-change` bubble up from the
 * switches and tools, and `time-play`, `time-pause`, `time-seek` and `time-live` from
 * the time dock.
 */
@customElement('apsis-app')
export class ApsisApp extends LitElement {
  /** The language showing now. */
  @property() locale: Locale = 'es-AR';
  /** When the data shown was fetched from Horizons, ISO 8601. */
  @property() fetchedAt = '';
  /** The app's version, as in package.json. */
  @property() version = '';
  /** Which view is showing. */
  @property() view: View = 'map';
  /** Whether the view showing is at true scale. */
  @property({ type: Boolean }) trueScale = false;
  /** A short message for the visitor, shown under the top controls. */
  @property() notice = '';
  /** Where time is and how it moves, for the time dock. */
  @property({ attribute: false }) playback: Playback | undefined;
  /** The span there's data for, for the time dock. */
  @property({ attribute: false }) timeRange: Range | undefined;

  @query('info-panel') private info!: InfoPanel;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = [
    glass,
    css`
      :host {
        position: relative;
        display: block;
        height: 100dvh;
        overflow: hidden;
      }
      /* The view: the whole screen, under everything. */
      main {
        position: absolute;
        inset: 0;
        display: grid;
      }
      .top {
        position: absolute;
        top: calc(12px + env(safe-area-inset-top));
        left: calc(12px + env(safe-area-inset-left));
        right: calc(12px + env(safe-area-inset-right));
        display: flex;
        align-items: flex-start;
        gap: 8px;
        pointer-events: none;
      }
      .top > * {
        pointer-events: auto;
      }
      h1 {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 44px;
        margin: 0;
        padding: 0 14px 0 10px;
        font: 600 0.8rem var(--font-display);
        letter-spacing: 0.22em;
      }
      .tagline {
        font: 400 0.82rem var(--font-ui);
        letter-spacing: normal;
        color: var(--color-muted);
      }
      @media (max-width: 600px) {
        .tagline {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(50%);
        }
      }
      .spacer {
        flex: 1;
      }
      .notice {
        position: absolute;
        top: calc(var(--hud-top) + env(safe-area-inset-top));
        left: 50%;
        transform: translateX(-50%);
        max-width: calc(100% - 24px);
        margin: 0;
        padding: 8px 14px;
        font-size: 0.85rem;
        text-align: center;
      }
      .notice:empty {
        visibility: hidden;
      }
      view-tools {
        position: absolute;
        right: calc(12px + env(safe-area-inset-right));
        top: 50%;
        transform: translateY(-50%);
      }
      .dock {
        position: absolute;
        left: calc(12px + env(safe-area-inset-left));
        right: calc(12px + env(safe-area-inset-right));
        bottom: calc(12px + env(safe-area-inset-bottom));
        border-radius: 18px;
      }
      @media (min-width: 760px) {
        .dock {
          left: 50%;
          right: auto;
          width: min(680px, calc(100% - 24px));
          transform: translateX(-50%);
        }
      }
    `,
  ];

  override render() {
    const icon = `${import.meta.env.BASE_URL}icon.svg`;
    const infoLabel = msg('Acerca de Apsis', { id: 'info-open' });
    return html`
      <main><slot></slot></main>
      <div class="top">
        <h1 class="glass pill">
          <img src=${icon} width="26" height="26" alt="" />APSIS
          <span class="tagline">${msg('¿Dónde están ahora?', { id: 'tagline' })}</span>
        </h1>
        <span class="spacer"></span>
        <view-switch .view=${this.view}></view-switch>
        <language-switch .locale=${this.locale}></language-switch>
        <button
          type="button"
          class="glass pill icon-button"
          aria-label=${infoLabel}
          title=${infoLabel}
          @click=${() => this.info.open()}
        >
          ${icons.info()}
        </button>
      </div>
      <p class="glass pill notice" role="status">${this.notice}</p>
      <view-tools .view=${this.view} ?trueScale=${this.trueScale}></view-tools>
      <time-slider
        class="glass dock"
        .playback=${this.playback}
        .range=${this.timeRange}
      ></time-slider>
      <info-panel .fetchedAt=${this.fetchedAt} .version=${this.version}></info-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'apsis-app': ApsisApp;
  }
}
