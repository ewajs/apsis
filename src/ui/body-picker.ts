import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { msg, str, updateWhenLocaleChanges } from '@lit/localize';
import type { Mission } from '../core/catalogue.ts';
import { bodyName } from '../i18n/bodies.ts';
import { localized } from '../i18n/localization.ts';
import { glass } from './glass.ts';
import { icons } from './icons.ts';
import { bestMatch, matches } from './search.ts';

/** One line of the picker's list. */
export type PickerEntry = {
  id: string;
  name: string;
  /** Which part of the list it's in. */
  group: 'active' | 'ended' | 'planets';
  /** A second line: the agency and the target; for an ended mission, its years. */
  detail: string;
};

/**
 * The picker's list, in the language showing now: missions under way, then ended ones,
 * each in catalogue order, then the Sun and the planets.
 * @param planets The planets' ids, from the Sun outwards.
 * @param moons The moons and the planet each circles; listed after their planet.
 */
export function pickerEntries(
  missions: readonly Mission[],
  planets: readonly string[],
  moons: readonly { id: string; parent: string }[] = [],
) {
  const entries: PickerEntry[] = missions.map((mission) => {
    const detail = `${mission.agency} · ${localized(mission.target)}`;
    const end = mission.coverage?.to.slice(0, 4);
    return {
      id: mission.id,
      name: mission.name,
      group: mission.status,
      detail:
        mission.status === 'ended' ? `${detail} · ${mission.launch.slice(0, 4)}–${end}` : detail,
    };
  });
  // Each planet followed by its moons.
  for (const id of ['sun', ...planets]) {
    entries.push({ id, name: bodyName(id), group: 'planets', detail: '' });
    for (const moon of moons.filter((entry) => entry.parent === id)) {
      const parent = bodyName(id);
      entries.push({
        id: moon.id,
        name: bodyName(moon.id),
        group: 'planets',
        detail: msg(str`Luna de ${parent}`, { id: 'card-moon-of' }),
      });
    }
  }
  return entries;
}

/**
 * @component The search pill at the top, and the list it opens (a popover: Escape or a
 * tap outside closes it): every mission and planet, filtered as you type, accents and
 * case aside. The pill shows the selection's name, with a button to clear it.
 *
 * Properties: `entries` (from `pickerEntries`), `selected` (an id, or `null`).
 * Events: `body-select` (detail: the id picked, or `null` when cleared).
 */
@customElement('body-picker')
export class BodyPicker extends LitElement {
  /** Everything that can be picked, in list order. */
  @property({ attribute: false }) entries: PickerEntry[] = [];
  /** The selected body's id, if any. */
  @property() selected: string | null = null;
  @state() private search = '';
  @query('[popover]') private panel!: HTMLElement;
  @query('input') private input!: HTMLInputElement;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = [
    glass,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .trigger {
        display: flex;
        align-items: center;
        height: 44px;
        min-width: 0;
        max-width: 300px;
        padding: 0 2px 0 0;
      }
      .open {
        display: flex;
        flex: 1;
        align-items: center;
        gap: 8px;
        min-width: 0;
        height: 100%;
        padding: 0 14px 0 13px;
        border: 0;
        border-radius: 999px;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .open span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .open .placeholder {
        color: var(--color-muted);
      }
      .clear {
        width: 40px;
        height: 40px;
        flex: none;
      }
      /* A phone's top row is narrow: once there's a name, it takes the icon's room
         (tapping it still searches). */
      @media (max-width: 600px) {
        .open.named {
          padding: 0 4px 0 16px;
        }
        .open.named svg {
          display: none;
        }
      }
      [popover]:popover-open {
        display: flex;
      }
      [popover] {
        position: fixed;
        inset: auto;
        top: calc(var(--hud-top) + env(safe-area-inset-top));
        left: calc(12px + env(safe-area-inset-left));
        flex-direction: column;
        width: min(360px, calc(100vw - 24px));
        max-height: calc(100dvh - var(--hud-top) - var(--hud-bottom) - 12px);
        margin: 0;
        padding: 8px;
        box-sizing: border-box;
        border-radius: 18px;
        color: var(--color-text);
        overflow: hidden;
      }
      input {
        height: 44px;
        padding: 0 14px;
        border: 1px solid var(--glass-line);
        border-radius: 12px;
        background: rgb(255 255 255 / 0.06);
        color: inherit;
        font: inherit;
      }
      input::placeholder {
        color: var(--color-muted);
      }
      .list {
        overflow-y: auto;
        overscroll-behavior: contain;
        margin-top: 6px;
      }
      h2 {
        margin: 12px 10px 4px;
        font: 600 0.68rem var(--font-display);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-muted);
      }
      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li button {
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: 100%;
        min-height: 44px;
        padding: 6px 10px;
        border: 0;
        border-radius: 10px;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      @media (hover: hover) {
        li button:hover {
          background: var(--glass-press);
        }
      }
      li button[aria-current='true'] {
        background: var(--glass-press);
        font-weight: 600;
      }
      .detail {
        font-size: 0.78rem;
        font-weight: 400;
        color: var(--color-muted);
      }
      .none {
        margin: 16px 10px;
        color: var(--color-muted);
      }
    `,
  ];

  override render() {
    const name = this.entries.find((entry) => entry.id === this.selected)?.name;
    const shown = this.entries.filter((entry) => matches(this.search, [entry.name, entry.detail]));
    const groups = [
      { key: 'active', title: msg('Misiones en curso', { id: 'picker-active' }) },
      { key: 'ended', title: msg('Misiones terminadas', { id: 'picker-ended' }) },
      { key: 'planets', title: msg('El Sol, los planetas y sus lunas', { id: 'picker-planets' }) },
    ] as const;
    const clear = msg('Quitar la selección', { id: 'picker-clear' });
    return html`
      <div class="glass pill trigger">
        <button
          type="button"
          class="open ${name ? 'named' : ''}"
          popovertarget="panel"
          aria-label=${
            name
              ? msg(str`Elegido: ${name}. Buscar otro`, { id: 'picker-open-selected' })
              : msg('Buscar una misión o un planeta', { id: 'picker-open' })
          }
        >
          ${icons.search()}
          ${
            name
              ? html`<span>${name}</span>`
              : html`<span class="placeholder"
                  >${msg('Buscar', { id: 'picker-placeholder' })}</span
                >`
          }
        </button>
        ${
          name
            ? html`<button
                type="button"
                class="icon-button clear"
                aria-label=${clear}
                title=${clear}
                @click=${() => this.#pick(null)}
              >
                ${icons.close()}
              </button>`
            : nothing
        }
      </div>
      <div id="panel" class="glass" popover @toggle=${this.#toggled}>
        <input
          autofocus
          type="search"
          enterkeyhint="go"
          autocomplete="off"
          aria-label=${msg('Buscar una misión o un planeta', { id: 'picker-open' })}
          placeholder=${msg('Juno, Saturno, NASA…', { id: 'picker-hint' })}
          .value=${live(this.search)}
          @input=${(event: Event) => (this.search = (event.target as HTMLInputElement).value)}
          @keydown=${(event: KeyboardEvent) => {
            // An exact name, then one that starts with the search, beats a mention: "io"
            // means Ío, not Mercurio; "jupi" means Jupiter, not Juno.
            const first = bestMatch(this.search, shown);
            if (event.key !== 'Enter' || !first) return;
            // Closing hands focus back to the pill; without this, WebKit lets the same
            // Enter press it and the list opens again.
            event.preventDefault();
            this.#pick(first.id);
          }}
        />
        <div class="list">
          ${groups.map(({ key, title }) => {
            const entries = shown.filter((entry) => entry.group === key);
            return entries.length === 0
              ? nothing
              : html`<h2>${title}</h2>
                  <ul>
                    ${entries.map(
                      (entry) =>
                        html`<li>
                          <button
                            type="button"
                            data-pick=${entry.id}
                            aria-current=${entry.id === this.selected ? 'true' : 'false'}
                            @click=${() => this.#pick(entry.id)}
                          >
                            ${entry.name}
                            ${
                              entry.detail
                                ? html`<span class="detail">${entry.detail}</span>`
                                : nothing
                            }
                          </button>
                        </li>`,
                    )}
                  </ul>`;
          })}
          ${
            shown.length === 0
              ? html`<p class="none">
                  ${msg(str`Nada coincide con «${this.search}».`, { id: 'picker-none' })}
                </p>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  /**
   * The list opens with the keyboard in its search (`autofocus`, applied as it shows)
   * and closes forgetting it. Clearing on close, not on open: the toggle event comes a
   * moment after the list shows, and the first letters may already be in.
   */
  #toggled(event: ToggleEvent) {
    if (event.newState === 'closed') this.search = '';
    else if (!this.input.matches(':focus')) this.input.focus();
  }

  #pick(id: string | null) {
    if (this.panel.matches(':popover-open')) this.panel.hidePopover();
    this.dispatchEvent(
      new CustomEvent<string | null>('body-select', { detail: id, bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'body-picker': BodyPicker;
  }
}
