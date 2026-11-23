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

test('plays backwards, and stops at the start of the data', async ({ page }) => {
  // The live window starts 60 days back; at a month per second that's reached in ~2 s.
  const index = JSON.parse(
    readFileSync(new URL('../../public/data/index.json', import.meta.url), 'utf8'),
  );
  const start = Date.parse(`${index.span.start}T00:00Z`);
  await page.goto(`./?play=-month`);
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await expect.poll(() => addressTime(page.url()), { timeout: 15_000 }).toBe(start);
  // And it stays there: stopped, not running past the data.
  await page.waitForTimeout(1_000);
  expect(addressTime(page.url())).toBe(start);
});
