/**
 * Draws the Apsis icon (design "K1", chosen 2026-11-22) and renders every size the app
 * needs. The icon: a spacecraft at the far end of its orbit (apoapsis), the Sun at the
 * near focus, both on the icon's diagonal, and the orbit drawn as the spacecraft's own
 * trail, fading behind it. Colours come from src/ui/styles.css.
 *
 *   npm run icons
 *
 * Writes public/icon.svg, public/favicon.svg and public/icons/*.png, all committed.
 * Rendering uses the pinned Playwright Chromium, so the output is reproducible.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const css = readFileSync(new URL('src/ui/styles.css', root), 'utf8');
const token = (name: string) => {
  const value = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  if (!value) throw new Error(`--color-${name} not found in styles.css`);
  return value;
};
const colors = { bg: token('bg'), text: token('text'), sun: token('sun'), craft: token('craft') };

/** The orbit: semi-major axis in icon units (of 512), and eccentricity. */
const A = 158;
const E = 0.5;
/** How much of the orbit the trail covers, and how bright its far end stays. */
const TRAIL_SPAN = Math.PI * 1.7;
const TRAIL_FADE = 0.3;
/** Everything is drawn around the centre and scaled to fill the tile. */
const SCALE = 1.08;

const round = (n: number) => Math.round(n * 10) / 10;

/** The trail: short arcs along the orbit, each brighter and wider than the one behind. */
function trail(a: number, b: number): string {
  const steps = 60;
  const arcs: string[] = [];
  for (let i = 0; i < steps; i++) {
    const from = Math.PI - TRAIL_SPAN + (TRAIL_SPAN * i) / steps;
    const to = Math.PI - TRAIL_SPAN + (TRAIL_SPAN * (i + 1)) / steps;
    const k = (i + 1) / steps;
    const point = (angle: number) =>
      `${round(256 + a * Math.cos(angle))} ${round(256 + b * Math.sin(angle))}`;
    arcs.push(
      `<path d="M${point(from)} A${a} ${round(b)} 0 0 1 ${point(to)}" stroke-opacity="${(TRAIL_FADE + (1 - TRAIL_FADE) * k).toFixed(2)}" stroke-width="${round(7 + 6 * k)}"/>`,
    );
  }
  return `<g fill="none" stroke="${colors.craft}">${arcs.join('')}</g>`;
}

function icon(): string {
  const b = A * Math.sqrt(1 - E * E);
  const c = A * E;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<title>Apsis</title>
<defs><radialGradient id="glow"><stop offset="0" stop-color="${colors.sun}"/><stop offset=".5" stop-color="${colors.sun}" stop-opacity=".8"/><stop offset="1" stop-color="${colors.sun}" stop-opacity="0"/></radialGradient></defs>
<rect width="512" height="512" fill="${colors.bg}"/>
<g transform="translate(256 256) scale(${SCALE}) translate(-256 -256) rotate(-45 256 256)">
<line x1="${256 - A - 30}" y1="256" x2="${256 + A + 24}" y2="256" stroke="${colors.text}" stroke-opacity=".18" stroke-width="5" stroke-dasharray="14 12"/>
${trail(A, b)}
<circle cx="${256 + c}" cy="256" r="54" fill="url(#glow)"/><circle cx="${256 + c}" cy="256" r="30" fill="${colors.sun}"/>
<circle cx="${256 - A}" cy="256" r="21" fill="${colors.craft}"/><circle cx="${256 - A}" cy="256" r="9" fill="${colors.text}"/>
</g>
</svg>
`;
}

/** The small cut for 32 px and below: thick lines, no apsides line, no fade. */
function favicon(): string {
  const a = 170;
  const b = a * Math.sqrt(1 - E * E);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<title>Apsis</title>
<rect width="512" height="512" rx="96" fill="${colors.bg}"/>
<g transform="rotate(-45 256 256)">
<ellipse cx="256" cy="256" rx="${a}" ry="${round(b)}" fill="none" stroke="${colors.craft}" stroke-opacity=".8" stroke-width="32"/>
<circle cx="${256 + a * E}" cy="256" r="62" fill="${colors.sun}"/>
<circle cx="${256 - a}" cy="256" r="50" fill="${colors.craft}"/><circle cx="${256 - a}" cy="256" r="22" fill="${colors.text}"/>
</g>
</svg>
`;
}

const publicDir = new URL('public/', root);
mkdirSync(new URL('icons/', publicDir), { recursive: true });
const svg = icon();
writeFileSync(new URL('icon.svg', publicDir), svg);
writeFileSync(new URL('favicon.svg', publicDir), favicon());

// The art stays inside the central 80% circle, so one drawing serves as both the
// plain and the maskable icon (Android crops maskable icons to its own shape).
const pngs: [string, number][] = [
  ['icons/icon-192.png', 192],
  ['icons/icon-512.png', 512],
  ['icons/maskable-512.png', 512],
  ['icons/apple-touch-icon.png', 180],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size] of pngs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: new URL(file, publicDir).pathname });
}
await browser.close();
console.log(`Wrote icon.svg, favicon.svg and ${pngs.length} PNGs to public/.`);
