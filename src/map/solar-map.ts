import { LitElement, css, html, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import { position, yearOf, type BodyKind, type Chunk, type Sample } from '../core/ephemeris.ts';
import { stateFromChunks } from '../core/interpolate.ts';
import { trailPoints } from '../core/trails.ts';
import { orbitPath, orbitPathThrough, type OrbitalElements } from '../core/orbits.ts';
import { KM_PER_AU } from '../core/units.ts';
import type { Vector3 } from '../core/math.ts';
import { bodyName } from '../i18n/bodies.ts';
import { currentLocale } from '../i18n/localization.ts';
import { placeLabels, type LabelRequest } from '../core/labels.ts';
import { pickAt, type ScreenMark } from '../core/pick.ts';
import { LOG_RINGS_AU, mapPoint, radialFraction, type MapScale } from '../core/projection.ts';
import {
  centredOn,
  HOME_VIEW,
  isHome,
  panBy,
  toScreen,
  zoomAt,
  type MapView,
  type ScreenPoint,
} from './view.ts';

/** A body the map can draw. */
export type MapBody = {
  id: string;
  kind: BodyKind;
  /** Shown next to the marker; planets get theirs from `bodyName`. */
  name: string;
  chunks: ReadonlyMap<number, Chunk>;
  /** The years it has data for: outside them (before launch, after the end) it's simply absent. */
  years: readonly number[];
  /** Where it is at an instant, if not from `chunks` (a small body's track, ADR 0015). */
  place?: ((t: number) => Vector3 | null) | undefined;
  /** Its orbit at an instant, if it changes (a small body's, from its track). */
  orbitAt?: ((t: number) => OrbitalElements | null) | undefined;
  /** The orbit to draw, for planets (ADR 0010). */
  orbit?: OrbitalElements | undefined;
};

/** Points per drawn orbit: smooth at any size on the log map. */
const ORBIT_POINTS = 240;
/** Empty space around the outermost ring, in px. */
const MARGIN = 22;
/** Marker radii in px. */
const SUN_RADIUS = 7;
const PLANET_RADIUS = 4.5;
const CRAFT_RADIUS = 3.5;
const SMALL_RADIUS = 3;
/** Label text: 12 px system font, so about 6.6 px per character (for placement only). */
const LABEL_HEIGHT = 14;
const LABEL_CHAR_WIDTH = 6.6;
/** The rings' own labels: 10 px text. */
const RING_LABEL_HEIGHT = 11;
const RING_LABEL_CHAR_WIDTH = 5.6;
/** On true distances, a ring at a round distance (1, 10, 100 AU) shows once it's this big. */
const MIN_RING_PX = 40;
/** A mouse wheel's scroll, in px, that doubles the zoom; a trackpad pinch, faster. */
const WHEEL_PX_PER_DOUBLING = 300;
const PINCH_PX_PER_DOUBLING = 100;
/** A tap moves less than this, in px; two taps this close in time zoom in. */
const TAP_SLOP_PX = 8;
const DOUBLE_TAP_MS = 300;
/** How far an arrow key moves the map, in px. */
const KEY_PAN_PX = 60;
/** The selection's ring: this much outside its marker, in px. */
const SELECTION_GAP = 5;
/** The zoom step of a double tap and the + and − keys. */
const ZOOM_STEP = 2;

/**
 * @component The 2D map: the solar system from above the ecliptic, with the Sun,
 * planets and their orbits, spacecraft and their trails at one instant
 * (docs/guides/map.md).
 *
 * Properties: `bodies` (what to draw), `time` (TDB seconds since J2000), `status`,
 * `scale` (log or true distances; changing it shows the whole map again), `selected`
 * (ringed, its label placed first; `centreOnSelection` brings it to the middle). The map
 * fits in the room the floating controls leave (`--hud-*`).
 *
 * Moving around: drag to pan; wheel, pinch or double tap to zoom; with the map
 * focused, arrows, + and − and 0. `zoomBy` and `goHome` serve the tool column.
 * Events: `map-view-change` (detail: whether the whole map shows, centred);
 * `body-select` (detail: the id of the body tapped).
 */
@customElement('solar-map')
export class SolarMap extends LitElement {
  /** What to draw: planets first, then spacecraft, in catalogue order. */
  @property({ attribute: false }) bodies: MapBody[] = [];
  /** The instant shown, in TDB seconds since J2000. */
  @property({ type: Number }) time = 0;
  /** Whether the data has arrived. */
  @property() status: 'loading' | 'ready' | 'failed' = 'loading';
  /** Whether more years are on their way: no "no data" note meanwhile. */
  @property({ type: Boolean }) loadingYears = false;

  /** How distances from the Sun are drawn. */
  @property() scale: MapScale = 'log';
  /** The selected body's id ('sun', a planet, a mission), if any. */
  @property() selected: string | null = null;
  @state() private size = { width: 0, height: 0, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
  /** The zoom and the point in the middle (`map/view.ts`). */
  @state() private view: MapView = HOME_VIEW;
  /** The pointers down on the map, by id, in client px: one pans, two pinch. */
  #pointers = new Map<number, ScreenPoint>();
  /** How far the current press has moved, to tell a tap from a drag. */
  #travel = 0;
  #lastTap = { at: -Infinity, x: 0, y: 0 };
  /** Where each body was drawn last, around the middle of the free area, for taps. */
  #marks: ScreenMark[] = [];
  /** Whether to bring the selection to the middle once it has a position. */
  #centreOnSelection = false;
  #resize = new ResizeObserver(([entry]) => {
    if (!entry) return;
    // The floating controls' room at each edge (--hud-* in styles.css): the map fits in
    // what's left.
    const style = getComputedStyle(this);
    const inset = (edge: string) => parseFloat(style.getPropertyValue(`--hud-${edge}`)) || 0;
    this.size = {
      width: entry.contentRect.width,
      height: entry.contentRect.height,
      insets: {
        top: inset('top'),
        right: inset('right'),
        bottom: inset('bottom'),
        left: inset('left'),
      },
    };
  });

  constructor() {
    super();
    updateWhenLocaleChanges(this);
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#resize.observe(this);
  }

  override disconnectedCallback() {
    this.#resize.disconnect();
    super.disconnectedCallback();
  }

  /** Whether the whole map shows, centred on the Sun. */
  get atHome(): boolean {
    return isHome(this.view);
  }

  /** Zooms about the middle of the map: 2 is twice as close. */
  zoomBy(factor: number): void {
    const { radius } = this.#layout();
    this.view = zoomAt(this.view, factor, { x: 0, y: 0 }, radius);
  }

  /** Shows the whole map again, centred on the Sun. */
  goHome(): void {
    this.view = HOME_VIEW;
  }

  /**
   * Brings the selected body to the middle, zooming in only as far as that needs
   * (`centredOn`); waits for its position if it has none yet.
   */
  centreOnSelection(): void {
    this.#centreOnSelection = true;
    this.requestUpdate();
  }

  override willUpdate(changed: Map<PropertyKey, unknown>) {
    // Log and true distances put everything elsewhere: a close-up of one is meaningless
    // in the other.
    if (changed.has('scale') && changed.get('scale') !== undefined) this.view = HOME_VIEW;
    if (this.#centreOnSelection && this.selected) {
      const { shown, edgeAu } = this.#positions();
      const now = shown.find(({ body }) => body.id === this.selected)?.now;
      if (now || this.selected === 'sun') {
        this.#centreOnSelection = false;
        const point = now ? mapPoint(now[1], now[2], this.scale, edgeAu) : { x: 0, y: 0 };
        this.view = centredOn(this.view, point);
      }
    }
  }

  override updated(changed: Map<PropertyKey, unknown>) {
    if (!changed.has('view')) return;
    this.dispatchEvent(
      new CustomEvent<boolean>('map-view-change', {
        detail: isHome(this.view),
        bubbles: true,
        composed: true,
      }),
    );
  }

  static override styles = css`
    :host {
      position: relative;
      display: block;
      min-height: 0;
      overflow: hidden;
    }
    :host([hidden]) {
      display: none;
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      /* The map handles drags and pinches itself; the page doesn't scroll or zoom. */
      touch-action: none;
      user-select: none;
      cursor: grab;
      outline: none;
    }
    svg:active {
      cursor: grabbing;
    }
    svg:focus-visible {
      box-shadow: inset 0 0 0 2px var(--color-craft);
    }
    .ring {
      fill: none;
      stroke: var(--color-line);
      stroke-dasharray: 2 4;
    }
    .orbit {
      fill: none;
      stroke: var(--color-muted);
      stroke-opacity: 0.45;
    }
    .ring-label {
      fill: var(--color-muted);
      font: 10px var(--font-ui);
    }
    .sun {
      fill: var(--color-sun);
    }
    .planet {
      fill: var(--color-text);
    }
    .small {
      fill: var(--color-muted);
    }
    /* Small bodies' orbits, fainter than the planets'. */
    .orbit.faint {
      stroke-opacity: 0.22;
    }
    .label.small {
      fill: var(--color-muted);
    }
    .spacecraft {
      fill: var(--color-craft);
    }
    .trail {
      fill: none;
      stroke: var(--color-craft);
      stroke-opacity: 0.5;
      stroke-width: 1.5;
    }
    .label {
      font: 12px var(--font-ui);
      fill: var(--color-text);
    }
    .label.spacecraft {
      fill: var(--color-craft);
    }
    .label.selected {
      font-weight: 600;
    }
    .selection {
      fill: none;
      stroke: var(--color-text);
      stroke-width: 1.5;
    }
    .missing {
      position: absolute;
      bottom: calc(var(--hud-bottom) + 8px);
      left: var(--space);
      right: var(--hud-right);
      margin: 0;
      color: var(--color-muted);
      font-size: 0.8rem;
      pointer-events: none;
    }
    .message {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      padding: var(--space);
      text-align: center;
      color: var(--color-muted);
    }
  `;

  override render() {
    if (this.status === 'loading') {
      return html`<p class="message">${msg('Cargando posiciones…', { id: 'map-loading' })}</p>`;
    }
    if (this.status === 'failed') {
      return html`<p class="message" role="alert">
        ${msg('No pudimos cargar las posiciones. Probá de nuevo en un rato.', {
          id: 'map-failed',
        })}
      </p>`;
    }
    const { width, height } = this.size;
    const { free, centre, radius } = this.#layout();
    if (radius <= 0) return nothing;
    const view = this.view;

    const { shown, edgeAu } = this.#positions();
    // Only bodies that should have data this year but don't at this instant (a gap, a
    // coverage edge) are worth a mention; before launch or after the end they're simply
    // not there yet, or any more.
    const year = yearOf(this.time);
    const missing = this.bodies.filter(
      (body) => body.years.includes(year) && !shown.some((s) => s.body === body),
    );
    const toPx = (xKm: number, yKm: number) =>
      toScreen(view, mapPoint(xKm, yKm, this.scale, edgeAu), radius);
    const sun = toScreen(view, { x: 0, y: 0 }, radius);
    const scaled = radius * view.zoom;

    const markers = shown.map(({ body, now }) => ({
      body,
      ...toPx(now[1], now[2]),
      radius:
        body.kind === 'planet'
          ? PLANET_RADIUS
          : body.kind === 'small'
            ? SMALL_RADIUS
            : CRAFT_RADIUS,
    }));
    this.#marks = [
      { id: 'sun', ...sun, radius: SUN_RADIUS },
      ...markers.map(({ body, x, y, radius }) => ({ id: body.id, x, y, radius })),
    ];
    // The selection's label first, then the spacecraft's: they're what the app is about.
    // Small bodies last: they're where missions went, not where they are.
    const rank = (body: MapBody) =>
      body.id === this.selected
        ? 3
        : body.kind === 'spacecraft'
          ? 2
          : body.kind === 'small'
            ? 0
            : 1;
    const requests: LabelRequest[] = [...markers]
      .sort((a, b) => rank(b.body) - rank(a.body))
      .map(({ body, x, y, radius }) => ({
        id: body.id,
        x,
        y,
        // The selection's label keeps clear of its ring.
        radius: body.id === this.selected ? radius + SELECTION_GAP : radius,
        width: this.#label(body).length * LABEL_CHAR_WIDTH,
        height: LABEL_HEIGHT,
      }));
    requests.unshift({ id: 'sun', ...sun, radius: SUN_RADIUS, width: 0, height: 0 });
    const ringed = this.#marks.find(({ id }) => id === this.selected);

    const number = new Intl.NumberFormat(currentLocale());
    const au = msg('UA', { id: 'unit-au' });
    const edgeRing = { au: Math.round(edgeAu / 1.05), r: 1 / 1.05 };
    const rings = (
      this.scale === 'log'
        ? LOG_RINGS_AU.map((ringAu) => ({ au: ringAu, r: radialFraction(ringAu, 'log', 1) }))
        : [
            // Round distances appear as you zoom in, well inside the edge's own ring.
            ...LOG_RINGS_AU.map((ringAu) => ({ au: ringAu, r: ringAu / edgeAu })).filter(
              ({ r }) => r * scaled >= MIN_RING_PX && r < edgeRing.r * 0.8,
            ),
            edgeRing,
          ]
    ).map((ring) => ({
      ...ring,
      text: `${number.format(ring.au)} ${au}`,
      y: sun.y - ring.r * scaled - 3,
    }));
    const labels = placeLabels(
      requests,
      { left: -free.width / 2, top: -free.height / 2, width: free.width, height: free.height },
      rings.map(({ text, y }) => ({
        left: sun.x,
        top: y - RING_LABEL_HEIGHT,
        width: text.length * RING_LABEL_CHAR_WIDTH + 6,
        height: RING_LABEL_HEIGHT + 2,
      })),
    );

    return html`
      <svg
        viewBox="${-centre.x} ${-centre.y} ${width} ${height}"
        role="img"
        tabindex="0"
        @pointerdown=${this.#down}
        @pointermove=${this.#move}
        @pointerup=${this.#up}
        @pointercancel=${this.#cancel}
        @wheel=${{ handleEvent: (event: WheelEvent) => this.#wheel(event), passive: false }}
        @keydown=${this.#key}
        aria-label=${msg('El sistema solar visto desde arriba, con las naves y sus trayectorias.', {
          id: 'map-label',
        })}
      >
        ${rings.map(
          ({ r, text, y }) =>
            svg`<circle class="ring" cx=${sun.x} cy=${sun.y} r=${r * scaled}></circle>
              <text class="ring-label" x=${sun.x + 3} y=${y}>${text}</text>`,
        )}
        ${this.bodies.map((body) => {
          const orbit = body.orbit ?? body.orbitAt?.(this.time);
          return orbit
            ? svg`<polyline class="orbit ${body.kind === 'small' ? 'faint' : ''}" data-orbit=${body.id}
                points=${this.#orbit(orbit, toPx, shown.find((s) => s.body === body)?.now)}>
              </polyline>`
            : nothing;
        })}
        ${markers
          .filter(({ body }) => body.kind === 'spacecraft')
          .map(
            ({ body }) =>
              svg`<polyline class="trail" points=${this.#trail(body, toPx)}></polyline>`,
          )}
        <circle class="sun" cx=${sun.x} cy=${sun.y} r=${SUN_RADIUS}>
          <title>${bodyName('sun')}</title>
        </circle>
        ${markers.map(
          ({ body, x, y, radius }) => svg`<g data-body=${body.id}>
            <circle class=${body.kind} cx=${x} cy=${y} r=${radius}></circle>
            <title>${this.#label(body)}</title>
          </g>`,
        )}
        ${
          ringed
            ? svg`<circle class="selection" data-selected=${ringed.id} cx=${ringed.x} cy=${ringed.y}
              r=${ringed.radius + SELECTION_GAP}></circle>`
            : nothing
        }
        ${markers.map(({ body }) => {
          const box = labels.get(body.id);
          const selected = body.id === this.selected ? 'selected' : '';
          return box
            ? svg`<text class="label ${body.kind} ${selected}" x=${box.left}
                y=${box.top + LABEL_HEIGHT - 3} aria-hidden="true">${this.#label(body)}</text>`
            : nothing;
        })}
      </svg>
      ${
        this.loadingYears
          ? nothing
          : shown.length === 0
            ? html`<p class="missing">
                ${msg('Sin datos para esta fecha.', { id: 'map-no-data' })}
              </p>`
            : missing.length > 0
              ? html`<p class="missing">
                  ${msg('Sin datos para esta fecha:', { id: 'map-missing' })}
                  ${missing.map((body) => this.#label(body)).join(', ')}
                </p>`
              : nothing
      }
    `;
  }

  /**
   * Where the map goes: centred in the room the floating controls leave free. SVG
   * coordinates have their origin at that centre, in CSS px; `radius` is the disc's at
   * zoom 1.
   */
  #layout() {
    const { width, height, insets } = this.size;
    const free = {
      width: width - insets.left - insets.right,
      height: height - insets.top - insets.bottom,
    };
    const centre = { x: insets.left + free.width / 2, y: insets.top + free.height / 2 };
    return { free, centre, radius: Math.min(free.width, free.height) / 2 - MARGIN };
  }

  /** The bodies with a position now, and the linear map's edge: just past the farthest. */
  #positions() {
    const shown = this.bodies.flatMap((body) => {
      // A tracked body has only positions; the map needs no velocity.
      const at = body.place?.(this.time);
      const now: Sample | null = body.place
        ? at
          ? [this.time, at[0], at[1], at[2], 0, 0, 0]
          : null
        : stateFromChunks(body.chunks, this.time);
      return now ? [{ body, now }] : [];
    });
    const edgeAu =
      Math.max(1, ...shown.map(({ now }) => Math.hypot(now[1], now[2]) / KM_PER_AU)) * 1.05;
    return { shown, edgeAu };
  }

  /** A client position as a screen point: px from the middle of the free area. */
  #local(clientX: number, clientY: number): ScreenPoint {
    const box = this.getBoundingClientRect();
    const { centre } = this.#layout();
    return { x: clientX - box.left - centre.x, y: clientY - box.top - centre.y };
  }

  #down(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.#pointers.size === 1) this.#travel = 0;
  }

  #move(event: PointerEvent) {
    if (!this.#pointers.has(event.pointerId)) return;
    const before = [...this.#pointers.values()];
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...this.#pointers.values()];
    const { radius } = this.#layout();
    const [a0, b0] = before as [ScreenPoint, ScreenPoint?];
    const [a1, b1] = after as [ScreenPoint, ScreenPoint?];
    if (!b0 || !b1) {
      // One finger or the mouse: what's under it follows it.
      this.#travel += Math.hypot(a1.x - a0.x, a1.y - a0.y);
      this.view = panBy(this.view, a1.x - a0.x, a1.y - a0.y, radius);
      return;
    }
    // Two fingers: zoom by how much they spread, about the point between them, and
    // follow that point as it moves.
    this.#travel = Infinity;
    const middle0 = this.#local((a0.x + b0.x) / 2, (a0.y + b0.y) / 2);
    const middle1 = this.#local((a1.x + b1.x) / 2, (a1.y + b1.y) / 2);
    const spread = Math.hypot(a1.x - b1.x, a1.y - b1.y) / Math.hypot(a0.x - b0.x, a0.y - b0.y);
    const zoomed = zoomAt(this.view, spread, middle0, radius);
    this.view = panBy(zoomed, middle1.x - middle0.x, middle1.y - middle0.y, radius);
  }

  #up(event: PointerEvent) {
    if (!this.#pointers.delete(event.pointerId)) return;
    if (this.#pointers.size > 0 || this.#travel > TAP_SLOP_PX) return;
    const tap = { at: event.timeStamp, x: event.clientX, y: event.clientY };
    const last = this.#lastTap;
    const double =
      tap.at - last.at < DOUBLE_TAP_MS &&
      Math.hypot(tap.x - last.x, tap.y - last.y) < 2 * TAP_SLOP_PX;
    this.#lastTap = double ? { at: -Infinity, x: 0, y: 0 } : tap;
    const local = this.#local(tap.x, tap.y);
    const picked = pickAt(this.#marks, local.x, local.y);
    if (picked) {
      this.dispatchEvent(
        new CustomEvent<string>('body-select', { detail: picked, bubbles: true, composed: true }),
      );
    }
    if (double) {
      const { radius } = this.#layout();
      this.view = zoomAt(this.view, ZOOM_STEP, local, radius);
    }
  }

  #cancel(event: PointerEvent) {
    this.#pointers.delete(event.pointerId);
    this.#travel = Infinity;
  }

  #wheel(event: WheelEvent) {
    event.preventDefault();
    // Browsers send trackpad pinches as wheel events with Ctrl held.
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
    const perDoubling = event.ctrlKey ? PINCH_PX_PER_DOUBLING : WHEEL_PX_PER_DOUBLING;
    const factor = 2 ** ((-event.deltaY * unit) / perDoubling);
    const { radius } = this.#layout();
    this.view = zoomAt(this.view, factor, this.#local(event.clientX, event.clientY), radius);
  }

  #key(event: KeyboardEvent) {
    const { radius } = this.#layout();
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN_PX, 0],
      ArrowRight: [-KEY_PAN_PX, 0],
      ArrowUp: [0, KEY_PAN_PX],
      ArrowDown: [0, -KEY_PAN_PX],
    };
    const move = pan[event.key];
    if (move) this.view = panBy(this.view, move[0], move[1], radius);
    else if (event.key === '+' || event.key === '=') this.zoomBy(ZOOM_STEP);
    else if (event.key === '-') this.zoomBy(1 / ZOOM_STEP);
    else if (event.key === '0') this.goHome();
    else return;
    event.preventDefault();
  }

  #label(body: MapBody): string {
    return body.kind === 'spacecraft' ? body.name : bodyName(body.id);
  }

  /** A spacecraft's trail (`trailPoints`), projected like everything else. */
  #trail(body: MapBody, toPx: (x: number, y: number) => { x: number; y: number }): string {
    return trailPoints(body.chunks, this.time)
      .map(([x, y]) => toPx(x, y))
      .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  }

  /**
   * A planet's whole orbit, projected like everything else: through the planet when it's
   * shown (`orbitPathThrough`), so close up it still sits on its line.
   */
  #orbit(
    orbit: OrbitalElements,
    toPx: (x: number, y: number) => { x: number; y: number },
    now: Sample | undefined,
  ): string {
    const path = now
      ? orbitPathThrough(orbit, ORBIT_POINTS, position(now))
      : orbitPath(orbit, ORBIT_POINTS);
    return path
      .map(([x, y]) => toPx(x, y))
      .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'solar-map': SolarMap;
  }
}
