import { LitElement, css, html, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg, updateWhenLocaleChanges } from '@lit/localize';
import type { BodyKind, Chunk } from '../core/ephemeris.ts';
import { stateFromChunks } from '../core/interpolate.ts';
import { trailPoints } from '../core/trails.ts';
import { orbitPath, type OrbitalElements } from '../core/orbits.ts';
import { KM_PER_AU } from '../core/units.ts';
import { bodyName } from '../i18n/bodies.ts';
import { currentLocale } from '../i18n/localization.ts';
import { placeLabels, type LabelRequest } from '../core/labels.ts';
import { LOG_RINGS_AU, mapPoint, radialFraction, type MapScale } from './projection.ts';

/** A body the map can draw. */
export type MapBody = {
  id: string;
  kind: BodyKind;
  /** Shown next to the marker; planets get theirs from `bodyName`. */
  name: string;
  chunks: ReadonlyMap<number, Chunk>;
  /** The orbit to draw, for planets (ADR 0010). */
  orbit?: OrbitalElements | undefined;
};

/** Points per drawn orbit: smooth at any size on the log map. */
const ORBIT_POINTS = 240;
/** Empty space around the outermost ring, in px. */
const MARGIN = 22;
/** Room kept free at the bottom for the scale note and button, in px. */
const CONTROLS_HEIGHT = 60;
/** Width each bottom corner needs beside the map circle to hold the controls instead. */
const CONTROLS_SIDE_WIDTH = 190;
/** Marker radii in px. */
const SUN_RADIUS = 7;
const PLANET_RADIUS = 4.5;
const CRAFT_RADIUS = 3.5;
/** Label text: 12 px system font, so about 6.6 px per character (for placement only). */
const LABEL_HEIGHT = 14;
const LABEL_CHAR_WIDTH = 6.6;
/** The rings' own labels: 10 px text. */
const RING_LABEL_HEIGHT = 11;
const RING_LABEL_CHAR_WIDTH = 5.6;

/**
 * @component The 2D map: the solar system from above the ecliptic, with the Sun,
 * planets and their orbits, spacecraft and their trails at one instant
 * (docs/guides/map.md).
 *
 * Properties: `bodies` (what to draw), `time` (TDB seconds since J2000), `status`.
 * The scale (log or linear) is the map's own state, switched by its button.
 * Events: none yet.
 */
@customElement('solar-map')
export class SolarMap extends LitElement {
  /** What to draw: planets first, then spacecraft, in catalogue order. */
  @property({ attribute: false }) bodies: MapBody[] = [];
  /** The instant shown, in TDB seconds since J2000. */
  @property({ type: Number }) time = 0;
  /** Whether the data has arrived. */
  @property() status: 'loading' | 'ready' | 'failed' = 'loading';

  @state() private scale: MapScale = 'log';
  @state() private size = { width: 0, height: 0 };
  #resize = new ResizeObserver(([entry]) => {
    if (entry) this.size = { width: entry.contentRect.width, height: entry.contentRect.height };
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
    .corner {
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
    // The map is centred above the controls, unless the screen is wide enough for the
    // controls to sit in the corners beside the circle (desktop, a phone on its side).
    const roomy = width >= height + 2 * CONTROLS_SIDE_WIDTH;
    const mapHeight = roomy ? height : height - CONTROLS_HEIGHT;
    const radius = Math.min(width, mapHeight) / 2 - MARGIN;
    if (radius <= 0) return nothing;

    const shown = this.bodies.flatMap((body) => {
      const now = stateFromChunks(body.chunks, this.time);
      return now ? [{ body, now }] : [];
    });
    const missing = this.bodies.filter((body) => !shown.some((s) => s.body === body));
    // The linear map's edge: just past the farthest body shown.
    const edgeAu =
      Math.max(1, ...shown.map(({ now }) => Math.hypot(now[1], now[2]) / KM_PER_AU)) * 1.05;
    const toPx = (xKm: number, yKm: number) => {
      const point = mapPoint(xKm, yKm, this.scale, edgeAu);
      // SVG's y grows downwards; the ecliptic's +y is up on the map.
      return { x: point.x * radius, y: -point.y * radius };
    };

    const markers = shown.map(({ body, now }) => ({ body, ...toPx(now[1], now[2]) }));
    // Spacecraft labels first: they're what the app is about.
    const requests: LabelRequest[] = [...markers]
      .sort((a, b) => Number(b.body.kind === 'spacecraft') - Number(a.body.kind === 'spacecraft'))
      .map(({ body, x, y }) => ({
        id: body.id,
        x,
        y,
        radius: body.kind === 'planet' ? PLANET_RADIUS : CRAFT_RADIUS,
        width: this.#label(body).length * LABEL_CHAR_WIDTH,
        height: LABEL_HEIGHT,
      }));
    requests.unshift({ id: 'sun', x: 0, y: 0, radius: SUN_RADIUS, width: 0, height: 0 });

    const number = new Intl.NumberFormat(currentLocale());
    const au = msg('UA', { id: 'unit-au' });
    const rings = (
      this.scale === 'log'
        ? LOG_RINGS_AU.map((ringAu) => ({ au: ringAu, r: radialFraction(ringAu, 'log', 1) }))
        : [{ au: Math.round(edgeAu / 1.05), r: 1 / 1.05 }]
    ).map((ring) => ({
      ...ring,
      text: `${number.format(ring.au)} ${au}`,
      y: -ring.r * radius - 3,
    }));
    const labels = placeLabels(
      requests,
      { left: -width / 2, top: -mapHeight / 2, width, height: mapHeight },
      rings.map(({ text, y }) => ({
        left: 0,
        top: y - RING_LABEL_HEIGHT,
        width: text.length * RING_LABEL_CHAR_WIDTH + 6,
        height: RING_LABEL_HEIGHT + 2,
      })),
    );

    return html`
      <svg
        viewBox="${-width / 2} ${-mapHeight / 2} ${width} ${height}"
        role="img"
        aria-label=${msg('El sistema solar visto desde arriba, con las naves y sus trayectorias.', {
          id: 'map-label',
        })}
      >
        ${rings.map(
          ({ r, text, y }) =>
            svg`<circle class="ring" r=${r * radius}></circle>
              <text class="ring-label" x="3" y=${y}>${text}</text>`,
        )}
        ${this.bodies.map((body) =>
          body.orbit
            ? svg`<polyline class="orbit" data-orbit=${body.id}
                points=${this.#orbit(body.orbit, toPx)}></polyline>`
            : nothing,
        )}
        ${markers
          .filter(({ body }) => body.kind === 'spacecraft')
          .map(
            ({ body }) =>
              svg`<polyline class="trail" points=${this.#trail(body, toPx)}></polyline>`,
          )}
        <circle class="sun" r=${SUN_RADIUS}><title>${bodyName('sun')}</title></circle>
        ${markers.map(
          ({ body, x, y }) => svg`<g data-body=${body.id}>
            <circle class=${body.kind} cx=${x} cy=${y}
              r=${body.kind === 'planet' ? PLANET_RADIUS : CRAFT_RADIUS}></circle>
            <title>${this.#label(body)}</title>
          </g>`,
        )}
        ${markers.map(({ body }) => {
          const box = labels.get(body.id);
          return box
            ? svg`<text class="label ${body.kind}" x=${box.left} y=${box.top + LABEL_HEIGHT - 3}
                aria-hidden="true">${this.#label(body)}</text>`
            : nothing;
        })}
      </svg>
      <div class="corner">
        <span class="note">
          ${
            this.scale === 'log'
              ? msg('Distancias en escala logarítmica', { id: 'map-scale-log-note' })
              : msg('Distancias reales', { id: 'map-scale-linear-note' })
          }
          ${
            missing.length > 0
              ? html`<br />${msg('Sin datos para esta fecha:', { id: 'map-missing' })}
                  ${missing.map((body) => this.#label(body)).join(', ')}`
              : nothing
          }
        </span>
        <button type="button" @click=${this.#toggleScale}>
          ${
            this.scale === 'log'
              ? msg('Ver distancias reales', { id: 'map-scale-to-linear' })
              : msg('Ver escala logarítmica', { id: 'map-scale-to-log' })
          }
        </button>
      </div>
    `;
  }

  #label(body: MapBody): string {
    return body.kind === 'planet' ? bodyName(body.id) : body.name;
  }

  /** A spacecraft's trail (`trailPoints`), projected like everything else. */
  #trail(body: MapBody, toPx: (x: number, y: number) => { x: number; y: number }): string {
    return trailPoints(body.chunks, this.time)
      .map(([x, y]) => toPx(x, y))
      .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  }

  /** A planet's whole orbit, projected like everything else. */
  #orbit(orbit: OrbitalElements, toPx: (x: number, y: number) => { x: number; y: number }): string {
    return orbitPath(orbit, ORBIT_POINTS)
      .map(([x, y]) => toPx(x, y))
      .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  }

  #toggleScale() {
    this.scale = this.scale === 'log' ? 'linear' : 'log';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'solar-map': SolarMap;
  }
}
