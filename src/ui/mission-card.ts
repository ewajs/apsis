import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg, str, updateWhenLocaleChanges } from '@lit/localize';
import { milestonesAround, type Milestone, type Mission } from '../core/catalogue.ts';
import type { EarthOrbitFacts, Facts } from '../core/facts.ts';
import type { ModelEntry } from '../core/models.ts';
import { lightTimeSeconds } from '../core/units.ts';
import { bodyType } from '../i18n/bodies.ts';
import { currentLocale, localized } from '../i18n/localization.ts';
import { formatDistance, formatDuration, formatLooseDate, formatSpeed } from './format.ts';
import { glass } from './glass.ts';
import { icons } from './icons.ts';

/** What the card shows: the selection at the displayed instant. */
export type Card = {
  id: string;
  kind: 'sun' | 'planet' | 'spacecraft' | 'moon' | 'small';
  /** In the language showing. */
  name: string;
  /** The catalogue's entry, for a spacecraft. */
  mission?: Mission | undefined;
  /** Distances and speed now; `null` when there's no position for this instant. */
  facts: Facts | null;
  /** For a moon: its planet's name. */
  parent?: string | undefined;
  /** Whether the position is computed from daily orbital elements (ADR 0015). */
  computed?: boolean | undefined;
  /**
   * For a satellite around Earth (ADR 0016): its height and speed there (`null` when its
   * orbital data is too old or too new for the instant), the time a turn takes, and the
   * data's date.
   */
  aroundEarth?:
    { facts: EarthOrbitFacts | null; periodSeconds: number; epochMs: number } | undefined;
  /** The displayed instant, UTC ms: which milestones are past. */
  instantMs: number;
  /** Its 3D model, if it has one: the close-up button and the credit. */
  model?: ModelEntry | undefined;
  /** Whether the 3D view is close up to the model. */
  closeUp: boolean;
  /**
   * How this phone shows the model in AR (its own viewer, ADR 0014): a link that opens
   * Android's Scene Viewer, or Quick Look on an iPhone (the model is converted first,
   * so a button); none elsewhere.
   */
  ar?: { viewer: 'scene-viewer'; href: string } | { viewer: 'quick-look' } | undefined;
};

/**
 * @component The card for the selection: what it is, how far it is from the Sun and
 * from Earth, how long a signal takes, how fast it goes, and for a mission its last
 * and next milestones, what it's for and where to read more. Top left on wide
 * screens; above the time dock on phones, with the mission's story behind "More".
 *
 * Properties: `card` (see `Card`).
 * Events: `body-select` with `null` when closed (closing clears the selection);
 * `close-up` (detail: whether to go close up to the model, or back out); `ar-view`
 * (show the model in the room in Quick Look; Scene Viewer is a plain link).
 */
@customElement('mission-card')
export class MissionCard extends LitElement {
  /** What to show. */
  @property({ attribute: false }) card: Card | undefined;
  /** Whether a phone shows the mission's story too. */
  @state() private expanded = false;
  /**
   * Whether the card is folded into a pill (name, close-up, unfold, ×), out of the way of
   * what it describes; the selection stays. Going close up folds it.
   */
  @state() private folded = false;

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
      .close + .close {
        margin-left: -4px;
      }
      .folded {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        max-width: 100%;
        padding: 0 4px 0 0;
      }
      .unfold {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        height: 44px;
        padding: 0 10px 0 16px;
        border: 0;
        border-radius: 999px;
        background: none;
        color: inherit;
        font: 600 0.95rem var(--font-display);
        cursor: pointer;
      }
      .unfold span:not(.visually-hidden) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
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
      .close-up {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        min-height: 44px;
        margin-top: 14px;
        border: 1px solid var(--glass-line);
        border-radius: 999px;
        background: rgb(255 255 255 / 0.06);
        color: var(--color-text);
        font: 600 0.88rem var(--font-ui);
        cursor: pointer;
      }
      .close-up[aria-pressed='true'] {
        background: var(--color-craft);
        border-color: transparent;
        color: var(--color-bg);
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 14px;
      }
      .actions .close-up {
        flex: 1;
        margin-top: 0;
      }
      a.close-up {
        text-decoration: none;
      }
      .note {
        margin: 10px 0 0;
        font-size: 0.72rem;
        color: var(--color-muted);
      }
      .credit {
        margin: 12px 0 0;
        font-size: 0.72rem;
        color: var(--color-muted);
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
    if (!changed.has('card')) return;
    const before = changed.get('card') as Card | undefined;
    // Each new selection opens whole, with its story folded.
    if (before?.id !== this.card?.id) {
      this.expanded = false;
      this.folded = false;
    }
    // Arriving close up, the card steps aside so the spacecraft can be seen.
    else if (!before?.closeUp && this.card?.closeUp) this.folded = true;
  }

  override render() {
    const card = this.card;
    if (!card) return nothing;
    const locale = currentLocale();
    const au = msg('UA', { id: 'unit-au' });
    const { mission, facts } = card;
    const close = msg('Quitar la selección', { id: 'picker-clear' });
    const fold = msg('Plegar la ficha', { id: 'card-fold' });
    if (this.folded) return this.#pill(card, close);
    const rows: [string, string][] = [];
    const aroundEarth = card.aroundEarth;
    if (aroundEarth?.facts) {
      rows.push(
        [
          msg('Altura sobre la Tierra', { id: 'card-altitude' }),
          formatDistance(aroundEarth.facts.altitudeKm, locale, au),
        ],
        [
          msg('Velocidad respecto de la Tierra', { id: 'card-speed-earth' }),
          formatSpeed(aroundEarth.facts.speedKmS, locale),
        ],
        [
          msg('Da una vuelta a la Tierra en', { id: 'card-period' }),
          formatDuration(aroundEarth.periodSeconds, locale),
        ],
      );
    } else if (facts) {
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
          aria-label=${fold}
          title=${fold}
          @click=${() => (this.folded = true)}
        >
          ${icons.fold()}
        </button>
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
        rows.length > 0
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
      ${aroundEarth ? this.#aroundEarthNote(aroundEarth, locale) : nothing}
      ${
        card.computed && card.facts
          ? html`<p class="note">
              ${msg('Posición calculada a partir de elementos orbitales diarios de JPL Horizons.', {
                id: 'card-computed',
              })}
            </p>`
          : nothing
      }
      ${
        card.model
          ? html`<div class="actions">
              <button
                type="button"
                class="close-up"
                aria-pressed=${card.closeUp}
                @click=${() => this.#closeUp(!card.closeUp)}
              >
                ${
                  card.closeUp
                    ? msg('Volver a su vecindario', { id: 'card-close-up-out' })
                    : msg('Ver la nave de cerca', { id: 'card-close-up' })
                }
              </button>
              ${
                card.ar?.viewer === 'scene-viewer'
                  ? html`<a class="close-up" href=${card.ar.href}>
                      ${msg('En tu casa (RA)', { id: 'card-ar' })}
                    </a>`
                  : card.ar?.viewer === 'quick-look'
                    ? html`<button
                        type="button"
                        class="close-up"
                        @click=${() =>
                          this.dispatchEvent(
                            new CustomEvent('ar-view', { bubbles: true, composed: true }),
                          )}
                      >
                        ${msg('En tu casa (RA)', { id: 'card-ar' })}
                      </button>`
                    : nothing
              }
            </div>`
          : nothing
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
                ${card.model ? html`<p class="credit">${this.#credit(card.model)}</p>` : nothing}
              </div>`
          : nothing
      }
    </article>`;
  }

  /** Where a satellite's position comes from, and how far to trust it (ADR 0016). */
  #aroundEarthNote(aroundEarth: NonNullable<Card['aroundEarth']>, locale: string) {
    const date = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(aroundEarth.epochMs);
    return html`<p class="note">
      ${
        aroundEarth.facts
          ? msg(str`Órbita aproximada, calculada con datos de CelesTrak del ${date}.`, {
              id: 'card-celestrak',
            })
          : msg(
              str`Su órbita se calcula solo unos días antes y después del ${date}, la fecha de sus datos.`,
              {
                id: 'card-celestrak-window',
              },
            )
      }
    </p>`;
  }

  /** The line under the name: the agency, the target and how it stands; or what it is. */
  #about(card: Card) {
    if (card.kind === 'sun') return msg('Nuestra estrella', { id: 'card-star' });
    if (card.kind === 'small') return bodyType(card.id);
    if (card.kind === 'moon') {
      return card.parent ? msg(str`Luna de ${card.parent}`, { id: 'card-moon-of' }) : '';
    }
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

  /**
   * The folded card: a pill with the name (tap to unfold), the close-up toggle when
   * there's a model, and ×.
   */
  #pill(card: Card, close: string) {
    const unfold = msg('Abrir la ficha', { id: 'card-unfold' });
    return html`<div class="glass pill folded">
      <button
        type="button"
        class="unfold"
        aria-expanded="false"
        @click=${() => (this.folded = false)}
      >
        <span class="visually-hidden">${unfold}:</span>
        <span>${card.name}</span>
        ${icons.unfold()}
      </button>
      ${
        card.model
          ? html`<button
              type="button"
              class="icon-button"
              aria-pressed=${card.closeUp}
              aria-label=${
                card.closeUp
                  ? msg('Volver a su vecindario', { id: 'card-close-up-out' })
                  : msg('Ver la nave de cerca', { id: 'card-close-up' })
              }
              title=${
                card.closeUp
                  ? msg('Volver a su vecindario', { id: 'card-close-up-out' })
                  : msg('Ver la nave de cerca', { id: 'card-close-up' })
              }
              @click=${() => this.#closeUp(!card.closeUp)}
            >
              ${card.closeUp ? icons.closeOut() : icons.closeIn()}
            </button>`
          : nothing
      }
      <button
        type="button"
        class="icon-button"
        aria-label=${close}
        title=${close}
        @click=${this.#close}
      >
        ${icons.close()}
      </button>
    </div>`;
  }

  /** Who made the model, and its licence; or that we made it, simplified. */
  #credit(model: ModelEntry) {
    if (model.ours) {
      return msg('Modelo 3D simplificado, hecho para Apsis.', { id: 'card-model-ours' });
    }
    const licence =
      model.licence === 'Public domain'
        ? msg('dominio público', { id: 'licence-public-domain' })
        : model.licence;
    return html`${msg('Modelo 3D:', { id: 'card-model' })}
    ${
      model.source
        ? html`<a href=${model.source} target="_blank" rel="noopener">${model.credit}</a>`
        : model.credit
    }
    · ${licence}`;
  }

  #closeUp(on: boolean) {
    this.dispatchEvent(
      new CustomEvent<boolean>('close-up', { detail: on, bubbles: true, composed: true }),
    );
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
