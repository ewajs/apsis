/**
 * Owns the displayed instant (ADR 0011): reads the clock, drives `core/playback.ts`,
 * and tells its host on every change. The edge between real time and the app's time;
 * everything else takes the instant as an input. See docs/guides/time.md.
 */
import { advance, live, pausedAt, playing, type Playback, type Range } from '../core/playback.ts';

/** While following now, how often the instant moves, in ms: spacecraft barely move. */
const LIVE_TICK_MS = 1_000;

/** Drives the displayed instant. Starts live, or paused at an instant. */
export class TimeController {
  #playback: Playback;
  #range: Range | undefined;
  #onChange: (playback: Playback) => void;
  #frame = 0;
  #timer: ReturnType<typeof setInterval> | undefined;
  #last = 0;

  /**
   * @param startMs An instant to start paused at, or `null` to follow now.
   * @param onChange Called with the new state whenever it changes.
   */
  constructor(startMs: number | null, onChange: (playback: Playback) => void) {
    this.#playback = startMs === null ? live(Date.now()) : pausedAt(startMs);
    this.#onChange = onChange;
    this.#schedule();
  }

  /** Where time is now. */
  get playback(): Playback {
    return this.#playback;
  }

  /**
   * The span there's data for: playing stops at its edges. An instant asked for
   * outside it (a link to 1990) is left alone, and shows "no data for this date".
   */
  set range(range: Range) {
    this.#range = range;
  }

  /** Plays at `rate` simulated seconds per real second (negative: backwards). */
  play(rate: number): void {
    this.#set(playing(this.#playback, rate));
  }

  /** Stops where it is. */
  pause(): void {
    this.#set(pausedAt(this.#playback.instantMs));
  }

  /** Jumps to an instant, paused there. */
  seek(instantMs: number): void {
    this.#set(pausedAt(instantMs));
  }

  /** Back to now, following the clock. */
  goLive(): void {
    this.#set(live(Date.now()));
  }

  #set(playback: Playback): void {
    this.#playback = playback;
    this.#onChange(playback);
    this.#schedule();
  }

  /** Every frame while playing, every second while live, nothing while paused. */
  #schedule(): void {
    cancelAnimationFrame(this.#frame);
    clearInterval(this.#timer);
    this.#timer = undefined;
    const { live: following, rate } = this.#playback;
    if (following) {
      this.#timer = setInterval(() => this.#tick(), LIVE_TICK_MS);
    } else if (rate !== 0) {
      this.#last = performance.now();
      this.#frame = requestAnimationFrame(() => this.#tick());
    }
  }

  #tick(): void {
    const now = performance.now();
    const elapsed = now - this.#last;
    this.#last = now;
    const next = advance(this.#playback, elapsed, Date.now(), this.#range);
    const stopped = next.rate === 0 && this.#playback.rate !== 0;
    this.#playback = next;
    this.#onChange(next);
    if (stopped) this.#schedule();
    else if (!next.live) this.#frame = requestAnimationFrame(() => this.#tick());
  }
}
