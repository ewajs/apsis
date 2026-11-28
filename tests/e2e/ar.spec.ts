import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

const card = (page: import('@playwright/test').Page) => page.locator('mission-card');

test('offers Android’s AR viewer a real-size copy of the spacecraft', async ({ page, request }) => {
  await page.goto('./?t=2026-11-23T12:00Z&focus=juno&ar=scene-viewer');
  const link = card(page).getByRole('link', { name: 'In your room (AR)' });
  const href = (await link.getAttribute('href'))!;
  expect(href.startsWith('intent://arvr.google.com/scene-viewer/1.0?')).toBe(true);
  const query = new URLSearchParams(href.slice(href.indexOf('?') + 1, href.indexOf('#')));
  expect(query.get('mode')).toBe('ar_preferred');
  expect(query.get('resizable')).toBe('false');
  // The file Scene Viewer fetches is there, a plain binary glTF.
  const glb = await request.get(query.get('file')!);
  expect(glb.ok()).toBe(true);
  expect((await glb.body()).subarray(0, 4).toString()).toBe('glTF');
});

test('hands the spacecraft to Quick Look as USDZ', async ({ page }) => {
  // Keep the page: in a desktop browser, following the blob would leave it.
  await page.addInitScript(() => {
    document.addEventListener(
      'click',
      (event) => {
        if ((event.target as Element).closest?.('a[rel="ar"]')) event.preventDefault();
      },
      true,
    );
  });
  await page.goto('./?t=2026-11-23T12:00Z&focus=juno&ar=quick-look');
  await card(page).getByRole('button', { name: 'In your room (AR)' }).click();
  const handoff = page.locator('a[rel="ar"][data-ar="quick-look"]');
  await expect(handoff).toBeAttached({ timeout: 20_000 });
  expect(await handoff.getAttribute('href')).toMatch(/^blob:/);
  // Quick Look answers a link whose only child is an image.
  await expect(handoff.locator('img')).toHaveCount(1);
});

test('offers no AR where there’s no AR viewer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A desktop browser has none');
  await page.goto('./?t=2026-11-23T12:00Z&focus=juno');
  await expect(card(page).getByRole('button', { name: 'See it up close' })).toBeVisible();
  await expect(card(page).getByText('In your room (AR)')).toHaveCount(0);
});

test('hands the solar system, as it is now, to Quick Look as a tabletop', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener(
      'click',
      (event) => {
        if ((event.target as Element).closest?.('a[rel="ar"]')) event.preventDefault();
      },
      true,
    );
  });
  await page.goto('./?t=2026-11-23T12:00Z&ar=quick-look');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await page.getByRole('button', { name: 'The solar system on your table (AR)' }).click();
  const handoff = page.locator('a[rel="ar"][data-ar="quick-look"]');
  await expect(handoff).toBeAttached({ timeout: 30_000 });
  expect(await handoff.getAttribute('href')).toMatch(/^blob:/);
});

test('offers the tabletop only where a phone can show it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A desktop browser has no AR');
  await page.goto('./?t=2026-11-23T12:00Z');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'The solar system on your table (AR)' }),
  ).toHaveCount(0);
});
