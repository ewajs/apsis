import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// These tests use the data `npm run data` wrote locally (public/data, copied into the build).
const index = JSON.parse(
  readFileSync(new URL('../../public/data/index.json', import.meta.url), 'utf8'),
) as { bodies: { id: string; kind: string; years: { year: number; archived: boolean }[] }[] };

test.use({ locale: 'es-AR' });

test('shows the Sun, every planet and every spacecraft with data', async ({ page }) => {
  await page.goto('./');
  const map = page.locator('solar-map');
  await expect(map.locator('circle.sun')).toBeAttached();
  for (const body of index.bodies) {
    await expect(map.locator(`[data-body="${body.id}"] circle.${body.kind}`)).toBeAttached();
  }
  await expect(page.getByText(/Datos del \d/)).toBeVisible();
});

test('puts Earth where Horizons says it is', async ({ page, request }) => {
  // A sample instant: the second sample of Earth's first live chunk, exactly as fetched.
  const { year } = index.bodies
    .find((body) => body.id === 'earth')!
    .years.find((y) => !y.archived)!;
  const chunk = await (await request.get(`./data/live/earth/${year}.json`)).json();
  const [t, x, y] = chunk.samples[1] as number[];
  // TDB seconds since J2000 back to a UTC address parameter (TDB − UTC = 69.184 s).
  const utc = new Date((t! + 946_728_000 - 69.184) * 1000).toISOString();
  await page.goto(`./?t=${utc}`);

  const marker = page.locator('solar-map [data-body="earth"] circle');
  await expect(marker).toBeAttached();
  const cx = Number(await marker.getAttribute('cx'));
  const cy = Number(await marker.getAttribute('cy'));
  // The scale changes distances, never directions: compare angles (SVG y points down).
  expect(Math.atan2(-cy, cx)).toBeCloseTo(Math.atan2(y!, x!), 6);
});

test('switches between log and true distances', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Distancias en escala logarítmica')).toBeVisible();
  await page.getByRole('button', { name: 'Ver distancias reales' }).click();
  await expect(page.getByText('Distancias reales', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver escala logarítmica' }).click();
  await expect(page.getByText('Distancias en escala logarítmica')).toBeVisible();
});

test('says when a date has no data, instead of guessing', async ({ page }) => {
  await page.goto('./?t=1990-01-01');
  await expect(page.getByText('Sin datos para esta fecha:')).toBeVisible();
  await expect(page.locator('solar-map [data-body]')).toHaveCount(0);
});

test('fits a phone held either way', async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
    const fits = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight);
    expect(fits).toBe(true);
  }
});

test('puts every planet on its drawn orbit', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  // Read every marker and orbit in one go, from one render.
  const gaps = await page.locator('solar-map').evaluate((map) => {
    const root = map.shadowRoot!;
    const result: Record<string, number> = {};
    for (const orbit of root.querySelectorAll('[data-orbit]')) {
      const id = orbit.getAttribute('data-orbit')!;
      const marker = root.querySelector(`[data-body="${id}"] circle`)!;
      const [cx, cy] = [Number(marker.getAttribute('cx')), Number(marker.getAttribute('cy'))];
      const points = orbit
        .getAttribute('points')!
        .split(' ')
        .map((pair) => pair.split(',').map(Number) as [number, number]);
      // Distance from the marker's centre to the nearest segment of the polyline.
      result[id] = Math.min(
        ...points.slice(1).map(([x2, y2], i) => {
          const [x1, y1] = points[i]!;
          const [dx, dy] = [x2 - x1, y2 - y1];
          const k = Math.max(
            0,
            Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / (dx * dx + dy * dy || 1)),
          );
          return Math.hypot(cx - (x1 + k * dx), cy - (y1 + k * dy));
        }),
      );
    }
    return result;
  });
  expect(Object.keys(gaps)).toHaveLength(index.bodies.filter((b) => b.kind === 'planet').length);
  for (const [id, gap] of Object.entries(gaps)) expect(gap, id).toBeLessThan(1.5);
});
