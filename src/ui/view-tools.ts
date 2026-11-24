import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { glass } from './glass.ts';
import { icons } from './icons.ts';
import type { View } from './view-switch.ts';

/** How much closer, or farther, each press of + or − goes. */
const ZOOM_STEP = 2;

/**
 * @component The tool column along the right edge of the view: zoom in and out, back
 * to the whole map (on the map only), and the scale (on the map, log or true distances;
 * in 3D, enlarged or true sizes, ADR 0005).
 *
 * Properties: `view`, which view it's for; `trueScale`, whether true scale is showing;
 * `atHome`, whether the map already shows all of itself.
 * Events: `zoom-by` (detail: the factor, 2 is twice as close), `view-home`, and
 * `true-scale-change` (detail: the new `trueScale`).
 */
@customElement('view-tools')
export class ViewTools extends LitElement {
  /** The view showing, which decides the wording. */
  @property() view: View = 'map';
  /** Whether true scale is showing. */
  @property({ type: Boolean }) trueScale = false;
  /** Whether the map shows all of itself, centred: nothing to go back to. */
  @property({ type: Boolean }) atHome = true;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = [
    glass,
    css`
      div {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px;
      }
      hr {
        width: 60%;
        margin: 2px auto;
        border: 0;
        border-top: 1px solid var(--glass-line);
      }
    `,
  ];

  override render() {
    const scale =
      this.view === 'map'
        ? this.trueScale
          ? msg('Ver escala logarítmica', { id: 'map-scale-to-log' })
          : msg('Ver distancias reales', { id: 'map-scale-to-linear' })
        : this.trueScale
          ? msg('Agrandar los planetas', { id: 'scene-scale-to-enlarged' })
          : msg('Ver tamaños reales', { id: 'scene-scale-to-true' });
    const zoomIn = msg('Acercar', { id: 'zoom-in' });
    const zoomOut = msg('Alejar', { id: 'zoom-out' });
    const home = msg('Ver todo el mapa', { id: 'map-home' });
    return html`<div class="glass pill" role="toolbar" aria-orientation="vertical">
      <button
        type="button"
        class="icon-button"
        title=${zoomIn}
        aria-label=${zoomIn}
        @click=${() => this.#send('zoom-by', ZOOM_STEP)}
      >
        ${icons.zoomIn()}
      </button>
      <button
        type="button"
        class="icon-button"
        title=${zoomOut}
        aria-label=${zoomOut}
        @click=${() => this.#send('zoom-by', 1 / ZOOM_STEP)}
      >
        ${icons.zoomOut()}
      </button>
      ${
        this.view === 'map'
          ? html`<button
              type="button"
              class="icon-button"
              title=${home}
              aria-label=${home}
              ?disabled=${this.atHome}
              @click=${() => this.#send('view-home', undefined)}
            >
              ${icons.recentre()}
            </button>`
          : nothing
      }
      <hr />
      <button
        type="button"
        class="icon-button"
        title=${scale}
        aria-label=${scale}
        aria-pressed=${this.trueScale}
        @click=${() => this.#send('true-scale-change', !this.trueScale)}
      >
        ${icons.scale()}
      </button>
    </div>`;
  }

  #send<T>(name: string, detail: T) {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-tools': ViewTools;
  }
}
