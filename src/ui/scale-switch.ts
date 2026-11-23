import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import type { View } from './view-switch.ts';

/**
 * @component The scale note and button at the bottom of the view: on the map, log or
 * true distances; in 3D, enlarged or true sizes (ADR 0005). It says which is showing
 * and offers the other.
 *
 * Properties: `view`, which view it's for; `trueScale`, whether true scale is showing.
 * Events: `true-scale-change` (detail: the new `trueScale`), when its button is pressed.
 */
@customElement('scale-switch')
export class ScaleSwitch extends LitElement {
  /** The view showing, which decides the wording. */
  @property() view: View = 'map';
  /** Whether true scale is showing. */
  @property({ type: Boolean }) trueScale = false;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = css`
    :host {
      position: absolute;
      left: var(--space);
      right: var(--space);
      bottom: calc(var(--space) * 0.5);
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: var(--space);
      pointer-events: none;
    }
    .note {
      color: var(--color-muted);
      font-size: 0.8rem;
      text-shadow: 0 0 4px var(--color-bg);
    }
    button {
      pointer-events: auto;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid var(--color-line);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font: 600 0.8rem var(--font-ui);
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid var(--color-craft);
      outline-offset: 2px;
    }
  `;

  override render() {
    const [note, action] = this.#texts();
    return html`<span class="note">${note}</span>
      <button type="button" @click=${this.#toggle}>${action}</button>`;
  }

  /** What's showing, and what the button offers instead. */
  #texts(): [string, string] {
    if (this.view === 'map') {
      return this.trueScale
        ? [
            msg('Distancias reales', { id: 'map-scale-linear-note' }),
            msg('Ver escala logarítmica', { id: 'map-scale-to-log' }),
          ]
        : [
            msg('Distancias en escala logarítmica', { id: 'map-scale-log-note' }),
            msg('Ver distancias reales', { id: 'map-scale-to-linear' }),
          ];
    }
    return this.trueScale
      ? [
          msg('Tamaños reales: casi todo es espacio vacío', { id: 'scene-scale-true-note' }),
          msg('Agrandar los planetas', { id: 'scene-scale-to-enlarged' }),
        ]
      : [
          msg('Planetas agrandados para que se vean', { id: 'scene-scale-enlarged-note' }),
          msg('Ver tamaños reales', { id: 'scene-scale-to-true' }),
        ];
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
    'scale-switch': ScaleSwitch;
  }
}
