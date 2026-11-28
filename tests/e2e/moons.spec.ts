import { expect, test } from '@playwright/test';

test.use({ locale: 'es-AR' });

test('lists the moons after their planet, and describes one', async ({ page }) => {
  await page.goto('./?t=2026-11-28T12:00Z');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await page.getByRole('button', { name: /Buscar una misión|Buscar otro/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar una misión o un planeta' }).fill('io');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/focus=io/);
  const card = page.locator('mission-card');
  await expect(card.getByRole('heading', { name: 'Ío' })).toBeVisible();
  await expect(card).toContainText('Luna de Júpiter');
  // About 5.3 AU from the Sun, as Jupiter is, and said to be computed.
  await expect(card.locator('dl > div', { hasText: 'Distancia al Sol' }).locator('dd')).toHaveText(
    /^5,3\d UA$/,
  );
  await expect(card).toContainText('Posición calculada a partir de elementos orbitales diarios');
});

test('keeps moons off the map, where they’d sit on their planet', async ({ page }) => {
  await page.goto('./?t=2026-11-28T12:00Z');
  await expect(page.locator('solar-map [data-body="jupiter"]')).toBeAttached();
  await expect(page.locator('solar-map [data-body="io"]')).toHaveCount(0);
});

test('shows a planet’s moons around it in 3D', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone', 'WebKit here draws 3D too slowly for this');
  await page.goto('./?t=2026-11-28T12:00Z&view=3d&backend=webgl2&focus=jupiter');
  await expect(page.locator('canvas[data-backend]')).toBeVisible({ timeout: 20_000 });
  // Seen from a little farther out, the four big moons stand clear of Jupiter.
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Alejar' }).click();
  for (const moon of ['io', 'europa', 'ganymede', 'callisto']) {
    await expect(page.locator(`[data-label="${moon}"]`)).toHaveCSS('visibility', 'visible', {
      timeout: 20_000,
    });
  }
});

test('lists dwarf planets, asteroids and comets, and describes one', async ({ page }) => {
  await page.goto('./?t=2026-11-28T12:00Z');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await page.getByRole('button', { name: /Buscar una misión|Buscar otro/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar una misión o un planeta' }).fill('pluton');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/focus=pluto/);
  const card = page.locator('mission-card');
  await expect(card.getByRole('heading', { name: 'Plutón' })).toBeVisible();
  await expect(card).toContainText('Planeta enano');
  // Pluto is about 35 AU out in 2026.
  await expect(card.locator('dl > div', { hasText: 'Distancia al Sol' }).locator('dd')).toHaveText(
    /^3[45],\d UA$/,
  );
  // On the map too, a quiet marker of its own.
  await expect(page.locator('solar-map [data-body="pluto"] circle.small')).toBeAttached();
  // Its orbit is a line, like every orbit, never a filled shape.
  for (const id of ['pluto', 'earth']) {
    await expect(page.locator(`solar-map [data-orbit="${id}"]`)).toHaveCSS('fill', 'none');
  }
});
