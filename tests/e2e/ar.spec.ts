import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US' });

const card = (page: import('@playwright/test').Page) => page.locator('mission-card');

test('offers Android’s AR viewer the spacecraft at 1 m and at real size, saying how big', async ({
  page,
  request,
}) => {
  await page.goto('./?t=2026-11-23T12:00Z&focus=juno&ar=scene-viewer');
  const query = async (name: RegExp) => {
    const href = (await card(page).getByRole('link', { name }).getAttribute('href'))!;
    expect(href.startsWith('intent://arvr.google.com/scene-viewer/1.0?')).toBe(true);
    return new URLSearchParams(href.slice(href.indexOf('?') + 1, href.indexOf('#')));
  };
  const room = await query(/^In your room \(AR\)/);
  expect(room.get('mode')).toBe('ar_preferred');
  expect(room.get('resizable')).toBe('true');
  expect(room.get('file')).toMatch(/\/models\/ar\/juno-1m\.glb$/);
  expect(room.get('title')).toBe('Juno · 1 m · scale 1:20');
  const real = await query(/^Real size \(AR\)/);
  expect(real.get('resizable')).toBe('false');
  expect(real.get('file')).toMatch(/\/models\/ar\/juno\.glb$/);
  expect(real.get('title')).toMatch(/^Juno · \d+ × \d+ m, \d+(\.\d)? m tall$/);
  // The card says the same before the tap.
  await expect(card(page).getByRole('link', { name: /Real size/ })).toContainText(/m tall/);
  // The files Scene Viewer fetches are there, plain binary glTF.
  for (const params of [room, real]) {
    const glb = await request.get(params.get('file')!);
    expect(glb.ok()).toBe(true);
    expect((await glb.body()).subarray(0, 4).toString()).toBe('glTF');
  }
});

test('hands the spacecraft to Quick Look ready-made, at 1 m or locked at real size', async ({
  page,
  request,
}) => {
  // Keep the page: a desktop browser would follow the link to the file.
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
  const handoff = page.locator('a[rel="ar"][data-ar="quick-look"]');
  await card(page)
    .getByRole('button', { name: /^In your room \(AR\)/ })
    .click();
  await expect(handoff).toHaveAttribute('href', /\/models\/ar\/juno-1m\.usdz$/);
  // Quick Look answers a link whose only child is an image.
  await expect(handoff.locator('img')).toHaveCount(1);
  await card(page)
    .getByRole('button', { name: /^Real size \(AR\)/ })
    .click();
  await expect(handoff).toHaveAttribute('href', /\/models\/ar\/juno\.usdz#allowsContentScaling=0$/);
  await expect(page.locator('a[rel="ar"]')).toHaveCount(1);
  const usdz = await request.get((await handoff.getAttribute('href'))!.split('#')[0]!);
  expect(usdz.ok()).toBe(true);
  expect((await usdz.body()).subarray(0, 2).toString()).toBe('PK');
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
