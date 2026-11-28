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

test('hands the spacecraft to Quick Look ready-made: 1 m fetched ahead, real size locked', async ({
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
  // The 1 m file is fetched as soon as the card shows; once here, a tap opens it from
  // memory (before, it opens the file's address).
  const fetched = page.waitForResponse(/\/models\/ar\/juno-1m\.usdz$/);
  await page.goto('./?t=2026-11-23T12:00Z&focus=juno&ar=quick-look');
  expect((await fetched).ok()).toBe(true);
  const handoff = page.locator('a[rel="ar"][data-ar="quick-look"]');
  await expect(async () => {
    await card(page)
      .getByRole('button', { name: /^In your room \(AR\)/ })
      .click();
    await expect(handoff).toHaveAttribute('href', /^blob:/, { timeout: 1_000 });
  }).toPass();
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

test('says so when an AR file isn’t on the phone and there’s no connection', async ({
  page,
  context,
}) => {
  await page.goto('./?t=2026-11-23T12:00Z&focus=juno&ar=quick-look');
  const real = card(page).getByRole('button', { name: /^Real size \(AR\)/ });
  await expect(real).toBeVisible();
  await context.setOffline(true);
  await real.click();
  await expect(page.getByText('Offline: this model isn’t saved on this phone yet.')).toBeVisible();
  await expect(page.locator('a[rel="ar"]')).toHaveCount(0);
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
  // Each body where the table puts it: Earth moved off the centre and scaled down to a
  // bead (USDZ is an uncompressed zip, so its text layer reads as it is).
  const usda = await page.evaluate(
    async (href) => {
      const bytes = await (await fetch(href)).arrayBuffer();
      return new TextDecoder('latin1').decode(bytes);
    },
    (await handoff.getAttribute('href'))!,
  );
  const earth = /def Xform "earth[^"]*"[^]*?xformOp:transform = (\([^\n]*\))/.exec(usda);
  expect(earth).not.toBeNull();
  const [scaleX, , , , , , , , , , , , x, , z] = earth![1]!.match(/-?[\d.e-]+/g)!.map(Number);
  expect(scaleX).toBeLessThan(0.1);
  expect(Math.hypot(x!, z!)).toBeGreaterThan(0.01);
});

test('offers the tabletop only where a phone can show it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'A desktop browser has no AR');
  await page.goto('./?t=2026-11-23T12:00Z');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'The solar system on your table (AR)' }),
  ).toHaveCount(0);
});
