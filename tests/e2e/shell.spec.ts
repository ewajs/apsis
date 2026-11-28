import { expect, test } from '@playwright/test';

test.describe('in a Spanish browser', () => {
  test.use({ locale: 'es-AR' });

  test('speaks Spanish first', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /¿Dónde están ahora\?/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
  });

  test('switches to English without reloading, and remembers it', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /¿Dónde están ahora\?/ })).toBeVisible();
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));

    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
    await expect(page.getByRole('heading', { name: /Where are they now\?/ })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => 'sameDocument' in window)).toBe(true);

    await page.reload();
    await expect(page.getByRole('heading', { name: /Where are they now\?/ })).toBeVisible();
  });
});

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('speaks English first', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /Where are they now\?/ })).toBeVisible();
  });
});

test('is installable', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).not.toBeNull();
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json();
  expect(manifest).toMatchObject({ name: 'Apsis', start_url: '/apsis/', display: 'standalone' });
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await request.get(new URL(icon.src, page.url()).href);
    expect(response.ok(), icon.src).toBe(true);
  }
});

test('opens offline after the first visit, map included', async ({ page, context }) => {
  await page.goto('./');
  // The service worker installs in the background; wait until it controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
  // One visit through the service worker caches the data it loads.
  await page.reload();
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: /Dónde están ahora|Where are they now/ }),
  ).toBeVisible();
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
});
