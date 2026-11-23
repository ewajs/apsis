import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';

/** The two ways of looking at the solar system. */
export type View = 'map' | 'scene';

/**
 * @component A two-button switch between the 2D map and the 3D view.
 *
 * Properties: `view`, the one showing now.
 * Events: `view-change` (detail: the chosen `View`), only when it differs.
 */
@customElement('view-switch')
export class ViewSwitch extends LitElement {
  /** The view showing now; its button is pressed. */
  @property() view: View = 'map';

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
    const views: [View, string, string][] = [
      ['map', '2D', msg('Mapa en 2D', { id: 'view-map' })],
      ['scene', '3D', msg('Vista en 3D', { id: 'view-scene' })],
    ];
    return html`<div role="group" aria-label=${msg('Vista', { id: 'view' })}>
      ${views.map(
        ([view, short, long]) =>
          html`<button
            type="button"
            title=${long}
            aria-label=${long}
            aria-pressed=${view === this.view}
            @click=${() => this.#choose(view)}
          >
            ${short}
          </button>`,
      )}
    </div>`;
  }

  #choose(view: View) {
    if (view === this.view) return;
    this.dispatchEvent(
      new CustomEvent<View>('view-change', { detail: view, bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-switch': ViewSwitch;
  }
}
