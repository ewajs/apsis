import { expect, test, type Page } from '@playwright/test';

test.use({ locale: 'es-AR' });

const ring = (page: Page) => page.locator('solar-map circle.selection');

/** Opens the picker and types into its search. */
async function search(page: Page, text: string) {
  // Named for the selection once there is one: "Elegido: Júpiter. Buscar otro".
  await page.getByRole('button', { name: /Buscar una misión|Buscar otro/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar una misión o un planeta' }).fill(text);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./?t=2026-11-23T12:00Z');
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
});

test('finds by name, agency or target, accents and case aside', async ({ page }) => {
  await search(page, 'JUPI');
  const list = page.locator('body-picker li');
  // Júpiter by name; Juno and Europa Clipper by where they're going.
  await expect(list.getByRole('button', { name: /^Júpiter/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /^Juno/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /^Europa Clipper/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /^Marte/ })).toHaveCount(0);
  // Enter takes the first name that matches, ahead of mentions.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/focus=jupiter/);
  await expect(ring(page)).toHaveAttribute('data-selected', 'jupiter');
  await expect(page.getByRole('button', { name: 'Elegido: Júpiter. Buscar otro' })).toBeVisible();

  await search(page, 'zzz');
  await expect(page.getByText('Nada coincide con «zzz».')).toBeVisible();
});

test('takes time to an ended mission’s last days', async ({ page }) => {
  await search(page, 'cassini');
  await page
    .locator('body-picker li')
    .getByRole('button', { name: /^Cassini/ })
    .click();
  await expect(page).toHaveURL(/t=2017-09-14T00(%3A|:)00Z.*focus=cassini/);
  await expect(ring(page)).toHaveAttribute('data-selected', 'cassini');
  await expect(page.locator('time-slider time')).toContainText('2017');
});

test('selects what you tap on the map, and clears it', async ({ page }) => {
  const saturn = (await page.locator('solar-map [data-body="saturn"] circle').boundingBox())!;
  // A little off the marker: a finger's worth.
  await page.mouse.click(saturn.x + saturn.width / 2 + 8, saturn.y + saturn.height / 2 + 6);
  await expect(page).toHaveURL(/focus=saturn/);
  await expect(ring(page)).toHaveAttribute('data-selected', 'saturn');
  await page.getByRole('button', { name: 'Quitar la selección' }).click();
  await expect(page).not.toHaveURL(/focus=/);
  await expect(ring(page)).toHaveCount(0);
});

test('opens on the selection in the address', async ({ page }) => {
  await page.goto('./?t=2026-11-23T12:00Z&focus=juno');
  await expect(ring(page)).toHaveAttribute('data-selected', 'juno');
  await expect(page.getByRole('button', { name: 'Elegido: Juno. Buscar otro' })).toBeVisible();
});
