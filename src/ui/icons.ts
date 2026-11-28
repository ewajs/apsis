/**
 * Line icons on a 24-unit grid, drawn in the current colour (after gravitas's). Always
 * decorative: the button around each one carries its name.
 */
import { svg, type SVGTemplateResult } from 'lit';

const icon = (paths: SVGTemplateResult, size = 20) =>
  svg`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    focusable="false">${paths}</svg>`;

/** The app's icons. */
export const icons = {
  info: () =>
    icon(svg`<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7.5v.5"></path>`),
  close: () => icon(svg`<path d="M6 6l12 12M18 6 6 18"></path>`),
  /** Going close up to a spacecraft (corners closing in), and back out (spreading). */
  closeIn: () => icon(svg`<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"></path>`),
  closeOut: () => icon(svg`<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"></path>`),
  /** Folding a panel away, and opening it again. */
  fold: () => icon(svg`<path d="m6 15 6-6 6 6"></path>`),
  unfold: () => icon(svg`<path d="m6 9 6 6 6-6"></path>`),
  play: (size = 18) => icon(svg`<path d="M8 5.5v13l10-6.5z" fill="currentColor"></path>`, size),
  pause: (size = 18) => icon(svg`<path d="M9 5v14M15 5v14"></path>`, size),
  search: (size = 18) =>
    icon(svg`<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>`, size),
  zoomIn: () => icon(svg`<path d="M12 5v14M5 12h14"></path>`),
  zoomOut: () => icon(svg`<path d="M5 12h14"></path>`),
  recentre: () =>
    icon(
      svg`<circle cx="12" cy="12" r="3"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>`,
    ),
  /** A cube in a frame's corners: AR, the solar system on your table. */
  ar: () =>
    icon(
      svg`<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"></path><path d="m12 7 4.5 2.5v5L12 17l-4.5-2.5v-5zM12 12l4.5-2.5M12 12v5M12 12 7.5 9.5"></path>`,
    ),
  /** A rising curve: the scale, log or true. */
  scale: () => icon(svg`<path d="M4 19c4-1 7-4 9-8s4-6 7-7"></path><path d="M4 4v15h16"></path>`),
};
