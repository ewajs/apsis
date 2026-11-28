import { expect, test } from '@playwright/test';

test.use({ locale: 'es-AR' });

// Satellites around Earth come from the CelesTrak data the build fetched (ADR 0016),
// which holds for a few days around its date: these tests use the present.
const card = (page: import('@playwright/test').Page) => page.locator('mission-card');
const row = (page: import('@playwright/test').Page, term: string) =>
  card(page).locator('dl > div', { hasText: term }).locator('dd');

test('shows the ISS around Earth, from CelesTrak, and says it is approximate', async ({ page }) => {
  await page.goto('./?focus=iss');
  await expect(row(page, 'Altura sobre la Tierra')).toHaveText(/^4\d\d km$/);
  await expect(row(page, 'Velocidad respecto de la Tierra')).toHaveText(/^7,\d km\/s$/);
  await expect(row(page, 'Da una vuelta a la Tierra en')).toHaveText(/^1 h 3\d min$/);
  await expect(card(page)).toContainText('Órbita aproximada, calculada con datos de CelesTrak');
});

test('brings the time to a satellite’s data when it is picked years away', async ({ page }) => {
  await page.goto('./?t=2020-01-01T12:00Z&focus=hubble');
  await expect(row(page, 'Altura sobre la Tierra')).toHaveText(/^\d{3} km$/);
  await expect(page.locator('time-slider')).not.toContainText('2020');
});
