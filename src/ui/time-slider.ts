import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { SPEEDS, type Playback, type Range, type Speed } from '../core/playback.ts';
import { currentLocale } from '../i18n/localization.ts';
import { formatInstant } from './format.ts';
import { glass } from './glass.ts';
import { icons } from './icons.ts';

/** A speed with its direction: what the speed menu lists. */
type Pace = { speed: Speed; backwards: boolean };

const PACES: readonly Pace[] = [
  { speed: 'month', backwards: true },
  { speed: 'week', backwards: true },
  { speed: 'day', backwards: true },
  { speed: 'realTime', backwards: false },
  { speed: 'day', backwards: false },
  { speed: 'week', backwards: false },
  { speed: 'month', backwards: false },
];
const paceKey = ({ speed, backwards }: Pace) => `${backwards ? '-' : ''}${speed}`;

/**
 * @component The time dock (ADR 0011, 0012): a scrubber across the span there's data
 * for, with a mark at today; then play or pause, the date and time shown (fixed width,
 * "23 nov 2026 · 20:32"), the pace (speed and direction in one menu) and "Ahora".
 *
 * Properties: `playback`, where time is and how it moves; `range`, the span with data
 * (controls are disabled until it's set).
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

  /** The pace the play button uses; remembered while paused. */
  @state() private pace: Pace = { speed: 'day', backwards: false };

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  static override styles = [
    glass,
    css`
      :host {
        display: block;
        padding: 6px 10px 8px;
      }
      .track {
        position: relative;
        height: 22px;
        margin: 0 4px;
      }
      input[type='range'] {
        position: absolute;
        inset: 0;
        width: 100%;
        margin: 0;
        background: transparent;
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
      }
      input[type='range']::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: 4px;
        background: linear-gradient(
          to right,
          var(--color-craft) var(--progress),
          rgba(255, 255, 255, 0.14) var(--progress)
        );
      }
      input[type='range']::-moz-range-track {
        height: 4px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.14);
      }
      input[type='range']::-moz-range-progress {
        height: 4px;
        border-radius: 4px;
        background: var(--color-craft);
      }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        margin-top: -6px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 0 4px rgba(92, 200, 255, 0.25);
      }
      input[type='range']::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border: 0;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 0 4px rgba(92, 200, 255, 0.25);
      }
      /* Today, on the track. */
      .today {
        position: absolute;
        top: 6px;
        width: 2px;
        height: 10px;
        border-radius: 2px;
        background: var(--color-sun);
        pointer-events: none;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .play {
        flex: none;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border: 0;
        border-radius: 50%;
        background: var(--color-craft);
        color: var(--color-on-accent);
        cursor: pointer;
      }
      .date {
        flex: 1;
        min-width: 0;
        line-height: 1.15;
        white-space: nowrap;
      }
      .date small {
        display: block;
        font: 600 0.62rem var(--font-display);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-muted);
      }
      .date small.live {
        color: var(--color-sun);
      }
      time {
        font: 500 0.88rem var(--font-ui);
        font-variant-numeric: tabular-nums;
      }
      .chip {
        flex: none;
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
        height: 36px;
        padding: 0 10px;
        border: 1px solid var(--glass-line);
        border-radius: 999px;
        background: transparent;
        color: var(--color-text);
        font: 600 0.76rem var(--font-display);
        white-space: nowrap;
        cursor: pointer;
      }
      .chip[aria-pressed='true'] {
        border-color: rgba(255, 181, 71, 0.5);
        color: var(--color-sun);
      }
      /* The pace menu: a native select under the chip, invisible, tapped through. */
      .chip select {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
        font-size: 16px;
      }
      .chip:has(select:focus-visible) {
        outline: 2px solid var(--color-craft);
        outline-offset: 2px;
      }
      .caret {
        color: var(--color-muted);
        font-size: 0.65rem;
      }
      button:disabled,
      select:disabled,
      input:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ];

  override render() {
    const playback = this.playback;
    const range = this.range;
    const ready = playback !== undefined && range !== undefined;
    const playing = playback !== undefined && playback.rate !== 0 && !playback.live;
    const following = playback?.live ?? false;
    const span = range ? range.endMs - range.startMs : 1;
    const at = (ms: number) =>
      range ? Math.min(100, Math.max(0, ((ms - range.startMs) / span) * 100)) : 0;
    const today = Date.now();
    const state = following
      ? msg('En vivo', { id: 'time-state-live' })
      : playing
        ? msg('Reproduciendo', { id: 'time-state-playing' })
        : msg('Pausado', { id: 'time-state-paused' });
    return html`
      <div class="track" style="--progress: ${at(playback?.instantMs ?? 0)}%">
        <input
          type="range"
          aria-label=${msg('Fecha mostrada', { id: 'time-instant' })}
          min=${range?.startMs ?? 0}
          max=${range?.endMs ?? 1}
          step="60000"
          .value=${live(String(playback?.instantMs ?? 0))}
          ?disabled=${!ready}
          @input=${this.#seek}
        />
        ${
          range && today >= range.startMs && today <= range.endMs
            ? html`<span class="today" style="left: ${at(today)}%"></span>`
            : nothing
        }
      </div>
      <div class="row">
        <button
          type="button"
          class="play"
          aria-label=${playing ? msg('Pausar', { id: 'time-pause' }) : msg('Reproducir', { id: 'time-play' })}
          title=${playing ? msg('Pausar', { id: 'time-pause' }) : msg('Reproducir', { id: 'time-play' })}
          ?disabled=${!ready}
          @click=${playing ? this.#pause : this.#play}
        >
          ${playing ? icons.pause() : icons.play()}
        </button>
        <div class="date">
          <small class=${following ? 'live' : ''}>${state}</small>
          <time datetime=${playback ? new Date(playback.instantMs).toISOString() : ''}
            >${playback ? formatInstant(playback.instantMs, currentLocale()) : ''}</time
          >
        </div>
        <label class="chip">
          ${this.#paceLabel(this.pace)}<span class="caret" aria-hidden="true">▾</span>
          <select
            aria-label=${msg('Velocidad', { id: 'time-speed' })}
            ?disabled=${!ready}
            @change=${this.#choosePace}
          >
            ${PACES.map(
              (pace) =>
                html`<option
                  value=${paceKey(pace)}
                  ?selected=${paceKey(pace) === paceKey(this.pace)}
                >
                  ${this.#paceLabel(pace)}
                </option>`,
            )}
          </select>
        </label>
        <button
          type="button"
          class="chip"
          aria-pressed=${following}
          ?disabled=${!ready}
          @click=${() => this.#emit('time-live')}
        >
          ${msg('Ahora', { id: 'time-now' })}
        </button>
      </div>
    `;
  }

  /** "1 día/s", "← 1 mes/s", "Tiempo real". */
  #paceLabel({ speed, backwards }: Pace): string {
    const label = {
      realTime: msg('Tiempo real', { id: 'speed-real-time' }),
      day: msg('1 día/s', { id: 'speed-day' }),
      week: msg('1 semana/s', { id: 'speed-week' }),
      month: msg('1 mes/s', { id: 'speed-month' }),
    }[speed];
    return backwards ? `← ${label}` : label;
  }

  #rate(): number {
    return (this.pace.backwards ? -1 : 1) * SPEEDS[this.pace.speed];
  }

  #play() {
    this.#emit('time-play', this.#rate());
  }

  #pause() {
    this.#emit('time-pause');
  }

  #choosePace(event: Event) {
    const key = (event.target as HTMLSelectElement).value;
    this.pace = PACES.find((pace) => paceKey(pace) === key) ?? this.pace;
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
