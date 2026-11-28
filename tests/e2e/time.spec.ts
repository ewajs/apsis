import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** The `t` in the address bar, as UTC ms, or null while following now. */
const addressTime = (url: string) => {
  const t = new URL(url).searchParams.get('t');
  return t ? Date.parse(t) : null;
};
const DAY_MS = 86_400_000;

test('follows now when no instant is asked for', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  expect(addressTime(page.url())).toBeNull();
});

test('plays forwards a day per second, and the address follows', async ({ page }) => {
  const start = Date.UTC(2026, 10, 1);
  await page.goto(`./?t=2026-11-01T00:00Z&play=day`);
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  // Three seconds or so of real time: about three days of the solar system.
  await expect
    .poll(() => (addressTime(page.url()) ?? start) - start, { timeout: 10_000 })
    .toBeGreaterThan(2 * DAY_MS);
});

test('plays backwards into the archive, and stops at its start', async ({ page }) => {
  // The archive starts on 1 January of its first year; from early March, a month per
  // second gets there in about two seconds.
  const index = JSON.parse(
    readFileSync(new URL('../../public/data/index.json', import.meta.url), 'utf8'),
  );
  const first = Math.min(
    ...index.bodies.flatMap((body: { years: { year: number }[] }) => body.years.map((y) => y.year)),
  );
  await page.goto(`./?t=${first}-03-01T00:00Z&play=-month`);
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await expect.poll(() => addressTime(page.url()), { timeout: 15_000 }).toBe(Date.UTC(first, 0, 1));
  // And it stays there: stopped, not running past the data.
  await page.waitForTimeout(1_000);
  expect(addressTime(page.url())).toBe(Date.UTC(first, 0, 1));
});

test('loads an archived year when the instant needs it, and only then', async ({ page }) => {
  const archive: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/archive/')) archive.push(request.url());
  });
  // Mid-2026 needs only the live year: nothing from the archive.
  await page.goto('./?t=2026-06-15T00:00Z');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  expect(archive).toEqual([]);
  // Mid-2025 is archived: its files load, and Earth is drawn there.
  await page.goto('./?t=2025-06-15T00:00Z');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  expect(archive.some((url) => url.endsWith('/data/archive/earth/2025.json'))).toBe(true);
});

test.describe('the time bar', () => {
  const bar = (page: import('@playwright/test').Page) => page.locator('time-slider');

  test('plays and pauses, and goes back to now', async ({ page }) => {
    await page.goto('./?t=2026-11-01T00:00Z');
    await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
    const start = addressTime(page.url())!;

    await bar(page)
      .getByRole('button', { name: /^(Play|Reproducir)$/ })
      .click();
    await expect
      .poll(() => addressTime(page.url())! - start, { timeout: 10_000 })
      .toBeGreaterThan(DAY_MS);
    await bar(page)
      .getByRole('button', { name: /^(Pause|Pausar)$/ })
      .click();
    const paused = addressTime(page.url());
    await page.waitForTimeout(1_000);
    expect(addressTime(page.url())).toBe(paused);

    await bar(page)
      .getByRole('button', { name: /^(Now|Ahora)$/ })
      .click();
    await expect.poll(() => addressTime(page.url())).toBeNull();
  });

  test('plays backwards at a backwards pace', async ({ page }) => {
    await page.goto('./?t=2026-11-20T00:00Z');
    await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
    const start = addressTime(page.url())!;
    // Speed and direction are one menu: "← 1 week/s".
    await bar(page)
      .getByRole('combobox', { name: /Speed|Velocidad/ })
      .selectOption('-week');
    await bar(page)
      .getByRole('button', { name: /^(Play|Reproducir)$/ })
      .click();
    await expect
      .poll(() => start - addressTime(page.url())!, { timeout: 10_000 })
      .toBeGreaterThan(5 * DAY_MS);
  });

  test('jumps to the date the slider is dragged to', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
    const target = Date.UTC(2026, 10, 10, 12, 0);
    await bar(page)
      .getByRole('slider', { name: /Date shown|Fecha mostrada/ })
      .evaluate((input: HTMLInputElement, value) => {
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, target);
    await expect.poll(() => addressTime(page.url())).toBe(target);
    await expect(bar(page).locator('time')).toHaveAttribute(
      'datetime',
      new Date(target).toISOString(),
    );
  });
});

test('keeps an archived year for offline, once seen', async ({ page, context }) => {
  await page.goto('./?t=2025-06-15T00:00Z');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
  // One visit through the service worker caches the year (cache-first: it never changes).
  await page.reload();
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
});

test('samples close passes hourly', async ({ request }) => {
  // Europa Clipper flies past Earth on 3 December 2026: hourly samples 3 days either side.
  const chunk = await (await request.get('./data/live/europa-clipper/2026.json')).json();
  const flyby = (Date.UTC(2026, 11, 3) / 1000 - 946_728_000) as number; // TDB-ish seconds
  const near = (chunk.samples as number[][]).filter(([t]) => Math.abs(t! - flyby) < 2.5 * 86_400);
  expect(near.length).toBeGreaterThan(100);
  const gaps = near.slice(1).map(([t], i) => t! - near[i]![0]!);
  expect(Math.max(...gaps)).toBe(3_600);
});

test('goes back to Cassini at Saturn and Voyager 1 at Jupiter', async ({ page }) => {
  await page.goto('./?t=2010-06-01T00:00Z');
  await expect(page.locator('solar-map [data-body="cassini"]')).toBeAttached();
  await expect(page.locator('solar-map [data-body="juno"]')).toHaveCount(0);
  await page.goto('./?t=1979-03-05T12:00Z');
  await expect(page.locator('solar-map [data-body="voyager-1"]')).toBeAttached();
  await expect(page.locator('solar-map [data-body="cassini"]')).toHaveCount(0);
});

test('keeps the time dock still while the date changes', async ({ page }) => {
  await page.goto('./?t=2026-11-23T20:32Z');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  const dock = page.locator('time-slider');
  const now = dock.getByRole('button', { name: /^(Now|Ahora)$/ });
  const positions: number[] = [];
  for (const t of ['1977-01-01T00:00Z', '1988-09-08T08:08Z', '2026-11-23T20:32Z']) {
    await dock.getByRole('slider').evaluate((input: HTMLInputElement, value) => {
      input.value = String(Date.parse(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, t);
    positions.push((await now.boundingBox())!.x);
  }
  expect(new Set(positions).size).toBe(1);
});
