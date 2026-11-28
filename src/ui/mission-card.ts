import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { milestonesAround, type Milestone, type Mission } from '../core/catalogue.ts';
import type { Facts } from '../core/facts.ts';
import { lightTimeSeconds } from '../core/units.ts';
import { currentLocale, localized } from '../i18n/localization.ts';
import { formatDistance, formatDuration, formatLooseDate, formatSpeed } from './format.ts';
import { glass } from './glass.ts';
import { icons } from './icons.ts';

/** What the card shows: the selection at the displayed instant. */
export type Card = {
  id: string;
  kind: 'sun' | 'planet' | 'spacecraft';
  /** In the language showing. */
  name: string;
  /** The catalogue's entry, for a spacecraft. */
  mission?: Mission | undefined;
  /** Distances and speed now; `null` when there's no position for this instant. */
  facts: Facts | null;
  /** The displayed instant, UTC ms: which milestones are past. */
  instantMs: number;
};

/**
 * @component The card for the selection: what it is, how far it is from the Sun and
 * from Earth, how long a signal takes, how fast it goes, and for a mission its last
 * and next milestones, what it's for and where to read more. Top left on wide
 * screens; above the time dock on phones, with the mission's story behind "More".
 *
 * Properties: `card` (see `Card`).
 * Events: `body-select` with `null` when closed (closing clears the selection).
 */
@customElement('mission-card')
export class MissionCard extends LitElement {
  /** What to show. */
  @property({ attribute: false }) card: Card | undefined;
  /** Whether a phone shows the mission's story too. */
  @state() private expanded = false;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = [
    glass,
    css`
      :host {
        display: block;
      }
      article {
        display: flex;
        flex-direction: column;
        max-height: inherit;
        box-sizing: border-box;
        padding: 14px 16px 16px;
        border-radius: 18px;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      header {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      header div {
        flex: 1;
        min-width: 0;
      }
      h2 {
        margin: 4px 0 2px;
        font: 600 1.15rem var(--font-display);
        letter-spacing: 0.02em;
      }
      .about {
        margin: 0;
        font-size: 0.82rem;
        color: var(--color-muted);
      }
      .status {
        color: var(--color-craft);
      }
      .close {
        flex: none;
        margin: -6px -8px 0 0;
      }
      dl {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 12px;
        margin: 14px 0 0;
      }
      dt {
        font-size: 0.72rem;
        color: var(--color-muted);
      }
      dd {
        margin: 2px 0 0;
        font-variant-numeric: tabular-nums;
      }
      .none {
        margin: 14px 0 0;
        color: var(--color-muted);
      }
      .milestones {
        margin: 14px 0 0;
        padding: 0;
        list-style: none;
        font-size: 0.85rem;
      }
      .milestones li + li {
        margin-top: 8px;
      }
      .milestones span {
        display: block;
        font-size: 0.72rem;
        color: var(--color-muted);
      }
      .story p {
        margin: 14px 0 0;
        font-size: 0.88rem;
        line-height: 1.45;
      }
      .story ul {
        margin: 10px 0 0;
        padding: 0;
        list-style: none;
      }
      a {
        color: var(--color-craft);
        font-size: 0.85rem;
      }
      .more {
        display: none;
        align-self: flex-start;
        margin-top: 10px;
        padding: 6px 0;
        border: 0;
        background: none;
        color: var(--color-craft);
        font: inherit;
        font-size: 0.85rem;
        cursor: pointer;
      }
      /* A phone keeps the card short above the dock; the story waits behind "More". */
      @media (max-width: 600px) {
        .more {
          display: block;
        }
        .story:not(.open) {
          display: none;
        }
      }
    `,
  ];

  override willUpdate(changed: Map<PropertyKey, unknown>) {
    // Each new selection starts folded.
    const before = changed.get('card') as Card | undefined;
    if (changed.has('card') && before?.id !== this.card?.id) this.expanded = false;
  }

  override render() {
    const card = this.card;
    if (!card) return nothing;
    const locale = currentLocale();
    const au = msg('UA', { id: 'unit-au' });
    const { mission, facts } = card;
    const close = msg('Quitar la selección', { id: 'picker-clear' });
    const rows: [string, string][] = [];
    if (facts) {
      if (card.kind !== 'sun') {
        rows.push([
          msg('Distancia al Sol', { id: 'card-from-sun' }),
          formatDistance(facts.fromSunKm, locale, au),
        ]);
      }
      if (card.id !== 'earth' && facts.fromEarthKm !== null) {
        rows.push(
          [
            msg('Distancia a la Tierra', { id: 'card-from-earth' }),
            formatDistance(facts.fromEarthKm, locale, au),
          ],
          [
            msg('Una señal desde la Tierra tarda', { id: 'card-light-time' }),
            formatDuration(lightTimeSeconds(facts.fromEarthKm), locale),
          ],
        );
      }
      if (card.kind !== 'sun') {
        rows.push([
          msg('Velocidad respecto del Sol', { id: 'card-speed' }),
          formatSpeed(facts.speedKmS, locale),
        ]);
      }
    }
    const around = mission ? milestonesAround(mission.milestones, card.instantMs) : {};
    return html`<article class="glass" aria-labelledby="name">
      <header>
        <div>
          <h2 id="name">${card.name}</h2>
          <p class="about">${this.#about(card)}</p>
        </div>
        <button
          type="button"
          class="icon-button close"
          aria-label=${close}
          title=${close}
          @click=${this.#close}
        >
          ${icons.close()}
        </button>
      </header>
      ${
        facts
          ? html`<dl>
              ${rows.map(
                ([term, value]) =>
                  html`<div>
                    <dt>${term}</dt>
                    <dd>${value}</dd>
                  </div>`,
              )}
            </dl>`
          : html`<p class="none">
              ${msg('Sin posición para esta fecha.', { id: 'card-no-position' })}
            </p>`
      }
      ${
        around.last || around.next
          ? html`<ul class="milestones">
              ${this.#milestone(msg('Último hito', { id: 'card-last' }), around.last)}
              ${this.#milestone(msg('Próximo hito', { id: 'card-next' }), around.next)}
            </ul>`
          : nothing
      }
      ${
        mission
          ? html`<button
                type="button"
                class="more"
                aria-expanded=${this.expanded}
                aria-controls="story"
                @click=${() => (this.expanded = !this.expanded)}
              >
                ${
                  this.expanded
                    ? msg('Menos', { id: 'card-less' })
                    : msg('Más sobre la misión', { id: 'card-more' })
                }
              </button>
              <div id="story" class="story ${this.expanded ? 'open' : ''}">
                <p>${localized(mission.blurb)}</p>
                <ul>
                  ${mission.links.map(
                    (link) =>
                      html`<li>
                        <a href=${link} target="_blank" rel="noopener"
                          >${new URL(link).hostname} ↗</a
                        >
                      </li>`,
                  )}
                </ul>
              </div>`
          : nothing
      }
    </article>`;
  }

  /** The line under the name: the agency, the target and how it stands; or what it is. */
  #about(card: Card) {
    if (card.kind === 'sun') return msg('Nuestra estrella', { id: 'card-star' });
    if (!card.mission) return msg('Planeta', { id: 'card-planet' });
    const { agency, target, status } = card.mission;
    return html`${agency} · ${localized(target)} ·
      <span class="status">
        ${
          status === 'active'
            ? msg('En curso', { id: 'card-active' })
            : msg('Terminada', { id: 'card-ended' })
        }
      </span>`;
  }

  #milestone(title: string, milestone: Milestone | undefined) {
    if (!milestone) return nothing;
    return html`<li>
      <span>${title} · ${formatLooseDate(milestone.date, currentLocale())}</span>
      ${localized(milestone)}
    </li>`;
  }

  #close() {
    this.dispatchEvent(
      new CustomEvent<null>('body-select', { detail: null, bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mission-card': MissionCard;
  }
}
