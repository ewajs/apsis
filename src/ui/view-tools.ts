import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { glass } from './glass.ts';
import { icons } from './icons.ts';
import type { View } from './view-switch.ts';

/**
 * @component The tool column along the right edge of the view: the scale (on the map,
 * log or true distances; in 3D, enlarged or true sizes, ADR 0005). Zoom joins it in 4.0c.
 *
 * Properties: `view`, which view it's for; `trueScale`, whether true scale is showing.
 * Events: `true-scale-change` (detail: the new `trueScale`).
 */
@customElement('view-tools')
export class ViewTools extends LitElement {
  /** The view showing, which decides the wording. */
  @property() view: View = 'map';
  /** Whether true scale is showing. */
  @property({ type: Boolean }) trueScale = false;

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
    `,
  ];

  override render() {
    const label =
      this.view === 'map'
        ? this.trueScale
          ? msg('Ver escala logarítmica', { id: 'map-scale-to-log' })
          : msg('Ver distancias reales', { id: 'map-scale-to-linear' })
        : this.trueScale
          ? msg('Agrandar los planetas', { id: 'scene-scale-to-enlarged' })
          : msg('Ver tamaños reales', { id: 'scene-scale-to-true' });
    return html`<div class="glass pill" role="toolbar" aria-orientation="vertical">
      <button
        type="button"
        class="icon-button"
        title=${label}
        aria-label=${label}
        aria-pressed=${this.trueScale}
        @click=${this.#toggle}
      >
        ${icons.scale()}
      </button>
    </div>`;
  }

  #toggle() {
    this.dispatchEvent(
      new CustomEvent<boolean>('true-scale-change', {
        detail: !this.trueScale,
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-tools': ViewTools;
  }
}
