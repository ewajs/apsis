import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// These tests use the data `npm run data` wrote locally (public/data, copied into the build).
const index = JSON.parse(
  readFileSync(new URL('../../public/data/index.json', import.meta.url), 'utf8'),
) as { bodies: { id: string; kind: string; years: { year: number; archived: boolean }[] }[] };

test.use({ locale: 'es-AR' });

test('shows the Sun, every planet and every spacecraft with data now', async ({ page }) => {
  await page.goto('./');
  const map = page.locator('solar-map');
  await expect(map.locator('circle.sun')).toBeAttached();
  // Everything with data now (a live year); ended missions such as Cassini are absent.
  for (const body of index.bodies.filter((b) => b.years.some((y) => !y.archived))) {
    await expect(map.locator(`[data-body="${body.id}"] circle.${body.kind}`)).toBeAttached();
  }
  await expect(map.locator('[data-body="cassini"]')).toHaveCount(0);
  // The data date lives in the info panel.
  await page.getByRole('button', { name: 'Acerca de Apsis' }).click();
  await expect(page.getByRole('dialog').getByText(/Datos del \d/)).toBeVisible();
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

test('switches between log and true distances, and says which', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await page.getByRole('button', { name: 'Ver distancias reales' }).click();
  await expect(page.getByRole('status')).toHaveText('Distancias reales');
  await page.getByRole('button', { name: 'Ver escala logarítmica' }).click();
  await expect(page.getByRole('status')).toHaveText('Distancias en escala logarítmica');
});

test('says when a date has no data, instead of guessing', async ({ page }) => {
  // Before any data (the archive starts in 1977).
  await page.goto('./?t=1970-01-01');
  await expect(page.getByText('Sin datos para esta fecha.')).toBeVisible();
  await expect(page.locator('solar-map [data-body]')).toHaveCount(0);
});

test('leaves out missions outside their own years, without calling it missing data', async ({
  page,
}) => {
  // In 1990 there are planets and Voyager 1, but no Juno or Cassini yet: not a gap.
  await page.goto('./?t=1990-06-01');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await expect(page.locator('solar-map [data-body="voyager-1"]')).toBeAttached();
  await expect(page.locator('solar-map [data-body="juno"]')).toHaveCount(0);
  await expect(page.getByText(/Sin datos para esta fecha/)).toHaveCount(0);
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

/** Where a marker is on the page, in CSS px. */
async function centreOf(page: Page, selector: string) {
  const box = (await page.locator(`solar-map ${selector}`).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** How far Earth is from the Sun on screen, in CSS px. */
async function earthFromSun(page: Page) {
  const [earth, sun] = [
    await centreOf(page, '[data-body="earth"] circle'),
    await centreOf(page, 'circle.sun'),
  ];
  return Math.hypot(earth.x - sun.x, earth.y - sun.y);
}

test.describe('moving around the map', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./?t=2026-11-23T12:00Z');
    await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  });

  test('zooms with the buttons, moves with a drag, and goes back to all of it', async ({
    page,
  }) => {
    const home = page.getByRole('button', { name: 'Ver todo el mapa' });
    await expect(home).toBeDisabled();
    const start = await earthFromSun(page);
    await page.getByRole('button', { name: 'Acercar' }).click();
    await page.getByRole('button', { name: 'Acercar' }).click();
    await page.getByRole('button', { name: 'Alejar' }).click();
    await expect.poll(() => earthFromSun(page)).toBeCloseTo(start * 2, 0);
    await expect(home).toBeEnabled();

    // What's under the pointer follows it.
    const sun = await centreOf(page, 'circle.sun');
    const map = (await page.locator('solar-map').boundingBox())!;
    const from = { x: map.x + map.width * 0.4, y: map.y + map.height * 0.45 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y - 30, { steps: 5 });
    await page.mouse.up();
    const moved = await centreOf(page, 'circle.sun');
    expect(moved.x - sun.x).toBeCloseTo(40, 0);
    expect(moved.y - sun.y).toBeCloseTo(-30, 0);

    await home.click();
    await expect.poll(() => earthFromSun(page)).toBeCloseTo(start, 1);
    await expect(home).toBeDisabled();

    // Log and true distances put everything elsewhere: switching shows the whole map.
    await page.getByRole('button', { name: 'Acercar' }).click();
    await page.getByRole('button', { name: 'Ver distancias reales' }).click();
    await expect(home).toBeDisabled();
  });

  test('zooms about the pointer with the wheel', async ({ page }, testInfo) => {
    // Phones have no wheel (and emulated ones scale its steps by their pixel ratio).
    test.skip(testInfo.project.name !== 'desktop', 'A mouse wheel: desktop only');
    const start = await earthFromSun(page);
    // Wheel events carry whole-pixel positions.
    const earth = await centreOf(page, '[data-body="earth"] circle');
    const at = { x: Math.round(earth.x), y: Math.round(earth.y) };
    await page.mouse.move(at.x, at.y);
    // 300 px of wheel doubles the zoom.
    await page.mouse.wheel(0, -300);
    await expect.poll(() => earthFromSun(page)).toBeCloseTo(start * 2, 0);
    const now = await centreOf(page, '[data-body="earth"] circle');
    expect(Math.abs(now.x - earth.x)).toBeLessThan(1);
    expect(Math.abs(now.y - earth.y)).toBeLessThan(1);
  });

  test('zooms in where you double tap', async ({ page }, testInfo) => {
    const start = await earthFromSun(page);
    const earth = await centreOf(page, '[data-body="earth"] circle');
    const at = { x: Math.round(earth.x), y: Math.round(earth.y) };
    if (testInfo.project.use.hasTouch) {
      await page.touchscreen.tap(at.x, at.y);
      await page.touchscreen.tap(at.x, at.y);
    } else {
      await page.mouse.dblclick(at.x, at.y);
    }
    await expect.poll(() => earthFromSun(page)).toBeCloseTo(start * 2, 0);
    const now = await centreOf(page, '[data-body="earth"] circle');
    expect(Math.abs(now.x - earth.x)).toBeLessThan(1);
    expect(Math.abs(now.y - earth.y)).toBeLessThan(1);
  });

  test('moves and zooms from the keyboard', async ({ page }) => {
    const start = await earthFromSun(page);
    const sun = await centreOf(page, 'circle.sun');
    await page.locator('solar-map svg').focus();
    await page.keyboard.press('+');
    await expect.poll(() => earthFromSun(page)).toBeCloseTo(start * 2, 0);
    await page.keyboard.press('ArrowLeft');
    // The view looks left, so the map moves right.
    await expect
      .poll(async () => (await centreOf(page, 'circle.sun')).x - sun.x)
      .toBeCloseTo(60, 0);
    await page.keyboard.press('0');
    await expect.poll(() => earthFromSun(page)).toBeCloseTo(start, 1);
  });

  test('zooms with a pinch', async ({ page }, testInfo) => {
    // A real two-finger touch needs Chromium's DevTools protocol.
    test.skip(testInfo.project.name !== 'phone', 'Touch input through CDP: phone only');
    const start = await earthFromSun(page);
    const sun = await centreOf(page, 'circle.sun');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: [number, number][]) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(([x, y], id) => ({ x, y, id })),
      });
    // Two fingers either side of the Sun, spreading from 80 to 160 px apart.
    await touch('touchStart', [
      [sun.x - 40, sun.y],
      [sun.x + 40, sun.y],
    ]);
    for (let step = 1; step <= 8; step++) {
      await touch('touchMove', [
        [sun.x - 40 - step * 5, sun.y],
        [sun.x + 40 + step * 5, sun.y],
      ]);
    }
    await touch('touchEnd', []);
    await expect.poll(() => earthFromSun(page)).toBeCloseTo(start * 2, 0);
    // The Sun, between the fingers, stays where it was.
    const after = await centreOf(page, 'circle.sun');
    expect(after.x).toBeCloseTo(sun.x, 0);
    expect(after.y).toBeCloseTo(sun.y, 0);
  });
});
