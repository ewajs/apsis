import { expect, test } from '@playwright/test';

test.use({ locale: 'es-AR' });

const card = (page: import('@playwright/test').Page) => page.locator('mission-card');

for (const [mission, instant, planetAu] of [
  ['juno', '2026-11-28T12:00Z', /^5,3\d UA$/],
  ['cassini', '2010-06-01T12:00Z', /^9,\d+ UA$/],
] as const) {
  test(`places ${mission} on its orbit around its planet, and says so`, async ({ page }) => {
    await page.goto(`./?t=${instant}&focus=${mission}`);
    await expect(
      card(page).locator('dl > div', { hasText: 'Distancia al Sol' }).locator('dd'),
    ).toHaveText(planetAu);
    await expect(card(page)).toContainText(
      'Posición calculada a partir de elementos orbitales diarios',
    );
  });
}

test('says nothing about orbital elements in cruise', async ({ page }) => {
  // Europa Clipper is still on its way to Jupiter: positions straight from Horizons.
  await page.goto('./?t=2026-11-28T12:00Z&focus=europa-clipper');
  await expect(card(page).getByRole('heading', { name: 'Europa Clipper' })).toBeVisible();
  await expect(card(page)).not.toContainText('elementos orbitales');
});
