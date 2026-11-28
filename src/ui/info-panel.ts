import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { msg, str, updateWhenLocaleChanges } from '@lit/localize';
import { currentLocale } from '../i18n/localization.ts';
import { glass } from './glass.ts';
import { icons } from './icons.ts';

/**
 * @component What Apsis is, where its data and pictures come from, how fresh the data
 * is and which version is running: a native modal `<dialog>` (focus and the inert page
 * come with it), opened from the "i" button.
 *
 * Properties: `fetchedAt`, when the data was fetched (ISO 8601); `version`.
 * Methods: `open()`.
 */
@customElement('info-panel')
export class InfoPanel extends LitElement {
  /** When the data shown was fetched from Horizons, ISO 8601. */
  @property() fetchedAt = '';
  /** The app's version, as in package.json. */
  @property() version = '';

  @query('dialog') private dialog!: HTMLDialogElement;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  /** Shows the panel. */
  open(): void {
    this.dialog.showModal();
  }

  static override styles = [
    glass,
    css`
      dialog {
        width: min(420px, calc(100vw - 24px));
        max-height: calc(100dvh - 24px);
        padding: 20px 20px 16px;
        overflow: auto;
        background: var(--glass-bg);
        -webkit-backdrop-filter: var(--glass-blur);
        backdrop-filter: var(--glass-blur);
        border: 1px solid var(--glass-line);
        border-radius: 18px;
        color: var(--color-text);
        font: 0.9rem/1.5 var(--font-ui);
      }
      dialog::backdrop {
        background: rgba(3, 6, 12, 0.55);
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: -6px -8px 6px 0;
      }
      h2 {
        margin: 0;
        font: 600 1.2rem var(--font-display);
        letter-spacing: 0.14em;
      }
      p {
        margin: 0 0 12px;
        color: #c6cfdf;
      }
      h3 {
        margin: 16px 0 4px;
        font: 600 0.7rem var(--font-display);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-muted);
      }
      ul {
        margin: 0;
        padding-left: 1.1em;
        color: #c6cfdf;
      }
      a {
        color: var(--color-craft);
      }
      .facts {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 16px;
        color: var(--color-muted);
        font-size: 0.8rem;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  override render() {
    return html`<dialog aria-labelledby="title">
      <header>
        <h2 id="title">APSIS</h2>
        <button
          type="button"
          class="icon-button"
          aria-label=${msg('Cerrar', { id: 'close' })}
          title=${msg('Cerrar', { id: 'close' })}
          @click=${() => this.dialog.close()}
        >
          ${icons.close()}
        </button>
      </header>
      <p>
        ${msg(
          'Dónde están, y dónde estuvieron, las misiones al espacio profundo: en un mapa o en un sistema solar en 3D, desde 1977 hasta dos meses adelante.',
          { id: 'info-about' },
        )}
      </p>
      <h3>${msg('De dónde sale todo', { id: 'info-sources' })}</h3>
      <ul>
        <li>${msg('Posiciones: JPL Horizons, NASA/JPL-Caltech.', { id: 'credit-horizons' })}</li>
        <li>
          ${msg('Texturas: Solar System Scope, CC BY 4.0, a partir de datos de la NASA.', {
            id: 'credit-textures',
          })}
        </li>
      </ul>
      <h3>${msg('Código abierto', { id: 'info-code' })}</h3>
      <p>
        <a href="https://github.com/ewajs/apsis" target="_blank" rel="noopener"
          >github.com/ewajs/apsis</a
        >
      </p>
      <div class="facts">
        <span>${this.fetchedAt ? this.#dataDate() : ''}</span>
        <span>v${this.version}</span>
      </div>
    </dialog>`;
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
    'info-panel': InfoPanel;
  }
}
