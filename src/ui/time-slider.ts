import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { SPEEDS, type Playback, type Range, type Speed } from '../core/playback.ts';
import { currentLocale } from '../i18n/localization.ts';

/**
 * @component The time bar: play or pause, direction, speed, "now", and a slider across
 * the span there's data for, with the shown date and time (ADR 0011,
 * docs/guides/time.md).
 *
 * Properties: `playback`, where time is and how it moves; `range`, the span with data
 * (the slider is disabled until it's set).
 * Events (intents; the host drives the time controller):
 * `time-play` (detail: rate in simulated seconds per real second, negative backwards),
 * `time-pause`, `time-seek` (detail: an instant, UTC ms), `time-live`.
 */
@customElement('time-slider')
export class TimeSlider extends LitElement {
  /** Where time is and how it moves. */
  @property({ attribute: false }) playback: Playback | undefined;
  /** The span there's data for, in UTC ms. */
  @property({ attribute: false }) range: Range | undefined;

  /** The speed and direction the play button uses; remembered while paused. */
  @state() private speed: Speed = 'day';
  @state() private backwards = false;

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = css`
    /* Phones: the buttons on one row, the slider and the date below. */
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'buttons buttons' 'slider date';
      align-items: center;
      gap: 6px var(--space);
      padding: 6px var(--space);
      border-top: 1px solid var(--color-line);
    }
    @media (min-width: 760px) {
      :host {
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'buttons slider date';
      }
    }
    .buttons {
      grid-area: buttons;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    input[type='range'] {
      grid-area: slider;
      width: 100%;
      min-height: 44px;
      margin: 0;
      accent-color: var(--color-craft);
    }
    time {
      grid-area: date;
      justify-self: end;
      color: var(--color-text);
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    button,
    select {
      min-width: 44px;
      min-height: 44px;
      padding: 0 10px;
      border: 1px solid var(--color-line);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font: 600 0.85rem var(--font-ui);
      cursor: pointer;
    }
    select {
      padding: 0 8px;
    }
    button[aria-pressed='true'] {
      border-color: var(--color-craft);
      color: var(--color-craft);
    }
    button:focus-visible,
    select:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--color-craft);
      outline-offset: 2px;
    }
    button:disabled,
    select:disabled,
    input:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `;

  override render() {
    const playback = this.playback;
    const ready = playback !== undefined && this.range !== undefined;
    const playingNow = playback !== undefined && playback.rate !== 0 && !playback.live;
    const following = playback?.live ?? false;
    const speeds: [Speed, string][] = [
      ['realTime', msg('Tiempo real', { id: 'speed-real-time' })],
      ['day', msg('1 día/s', { id: 'speed-day' })],
      ['week', msg('1 semana/s', { id: 'speed-week' })],
      ['month', msg('1 mes/s', { id: 'speed-month' })],
    ];
    return html`
      <div class="buttons">
        <button
          type="button"
          aria-pressed=${this.backwards}
          aria-label=${
            this.backwards
              ? msg('Hacia atrás en el tiempo', { id: 'time-backwards' })
              : msg('Hacia adelante en el tiempo', { id: 'time-forwards' })
          }
          title=${msg('Cambiar de sentido', { id: 'time-direction' })}
          ?disabled=${!ready}
          @click=${this.#flip}
        >
          ${this.backwards ? '←' : '→'}
        </button>
        <button
          type="button"
          aria-label=${
            playingNow
              ? msg('Pausar', { id: 'time-pause' })
              : msg('Reproducir', { id: 'time-play' })
          }
          ?disabled=${!ready}
          @click=${playingNow ? this.#pause : this.#play}
        >
          ${playingNow ? '❚❚' : '▶'}
        </button>
        <select
          aria-label=${msg('Velocidad', { id: 'time-speed' })}
          ?disabled=${!ready}
          @change=${this.#chooseSpeed}
        >
          ${speeds.map(
            ([speed, label]) =>
              html`<option value=${speed} ?selected=${speed === this.speed}>${label}</option>`,
          )}
        </select>
        <button
          type="button"
          aria-pressed=${following}
          ?disabled=${!ready}
          @click=${() => this.#emit('time-live')}
        >
          ${msg('Ahora', { id: 'time-now' })}
        </button>
      </div>
      <input
        type="range"
        aria-label=${msg('Fecha mostrada', { id: 'time-instant' })}
        min=${this.range?.startMs ?? 0}
        max=${this.range?.endMs ?? 1}
        step="60000"
        .value=${live(String(playback?.instantMs ?? 0))}
        ?disabled=${!ready}
        @input=${this.#seek}
      />
      <time datetime=${playback ? new Date(playback.instantMs).toISOString() : ''}
        >${playback ? this.#format(playback.instantMs) : ''}</time
      >
    `;
  }

  /** The instant in the visitor's language and time zone. */
  #format(instantMs: number): string {
    return new Intl.DateTimeFormat(currentLocale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(instantMs));
  }

  #rate(): number {
    return (this.backwards ? -1 : 1) * SPEEDS[this.speed];
  }

  #play() {
    this.#emit('time-play', this.#rate());
  }

  #pause() {
    this.#emit('time-pause');
  }

  #flip() {
    this.backwards = !this.backwards;
    if (this.#isPlaying()) this.#play();
  }

  #chooseSpeed(event: Event) {
    this.speed = (event.target as HTMLSelectElement).value as Speed;
    if (this.#isPlaying()) this.#play();
  }

  #seek(event: Event) {
    this.#emit('time-seek', Number((event.target as HTMLInputElement).value));
  }

  #isPlaying(): boolean {
    return this.playback !== undefined && this.playback.rate !== 0 && !this.playback.live;
  }

  #emit(type: string, detail?: number) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'time-slider': TimeSlider;
  }
}
