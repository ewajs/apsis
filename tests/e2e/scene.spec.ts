import { expect, test, type Page } from '@playwright/test';

// The default headless Chromium offers WebGPU but can't show its frames, so the phone
// and desktop projects force the WebGL 2 fallback (as gravitas does). The `webgpu`
// project uses a Chromium that can (see playwright.config.ts) and must get WebGPU.
// WebKit has no WebGPU here: it gets `auto` and must fall back by itself.
const FORCE_WEBGL = ['phone', 'desktop'];
function sceneAddress(project: string, extra = '') {
  const backend = FORCE_WEBGL.includes(project) ? '&backend=webgl2' : '';
  return `./?t=2026-11-23T12:00Z&view=3d${backend}${extra}`;
}

/** Errors on the page, apart from the GPU stall that screenshots themselves cause. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/**
 * How long to wait for pixels to show. Software WebGL draws a frame or two a second on a
 * busy machine, and each check takes a screenshot; these tests are about what's drawn,
 * not how fast.
 */
const PIXELS_MS = 20_000;

/** How many pixels near the middle of the canvas look like `kind`. */
async function countMiddlePixels(page: Page, kind: 'sun' | 'neptune'): Promise<number> {
  const canvas = page.locator('canvas[data-backend]');
  const box = (await canvas.boundingBox())!;
  const png = await page.screenshot({
    clip: { x: box.x + box.width / 2 - 30, y: box.y + box.height / 2 - 30, width: 60, height: 60 },
  });
  return page.evaluate(
    async ({ data, kind }) => {
      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${data}`)).blob(),
      );
      const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      const { data: rgba } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      let count = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        const [r, g, b] = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!];
        if (kind === 'sun' ? r > 200 && g > 90 && b < 120 : b > 90 && b > r + 30) count++;
      }
      return count;
    },
    { data: png.toString('base64'), kind },
  );
}

test('shows the Sun and the planets in 3D', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto(sceneAddress(testInfo.project.name));
  const canvas = page.locator('canvas[data-backend]');
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  const expected = { webgpu: ['webgpu'], iphone: ['webgl2'] }[testInfo.project.name] ?? ['webgl2'];
  expect(expected).toContain(await canvas.getAttribute('data-backend'));
  await expect(canvas).toHaveAttribute('aria-label', /Sol y los planetas|Sun and the planets/);
  // The Sun, 12 px across at the least, sits in the middle.
  await expect
    .poll(() => countMiddlePixels(page, 'sun'), { timeout: PIXELS_MS })
    .toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('looks at Neptune up close without losing it (floating origin)', async ({
  page,
}, testInfo) => {
  await page.goto(sceneAddress(testInfo.project.name, '&focus=neptune'));
  await expect(page.locator('canvas[data-backend]')).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(() => countMiddlePixels(page, 'neptune'), { timeout: PIXELS_MS })
    .toBeGreaterThan(200);
});

test('flies to what you pick, and picks what you tap', async ({ page }, testInfo) => {
  await page.goto(sceneAddress(testInfo.project.name));
  await expect(page.locator('canvas[data-backend]')).toBeVisible({ timeout: 20_000 });
  // The Sun sits in the middle at first: tapping there selects it.
  const canvas = (await page.locator('canvas[data-backend]').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await expect(page).toHaveURL(/focus=sun/);

  await page.getByRole('button', { name: /Find another|Buscar otro/ }).click();
  await page.keyboard.type('neptun');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/focus=neptune/);
  await expect(page.locator('[data-label="neptune"]')).toHaveCSS('font-weight', '600');
  await expect
    .poll(() => countMiddlePixels(page, 'neptune'), { timeout: PIXELS_MS })
    .toBeGreaterThan(200);
});

test('switches between the map and the 3D view', async ({ page }, testInfo) => {
  const backend = FORCE_WEBGL.includes(testInfo.project.name) ? '&backend=webgl2' : '';
  await page.goto(`./?t=2026-11-23T12:00Z${backend}`);
  await expect(page.locator('solar-map [data-body="earth"]')).toBeAttached();
  await page.getByRole('button', { name: /Vista en 3D|3D view/ }).click();
  await expect(page.locator('canvas[data-backend]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('solar-map')).toBeHidden();
  await page.getByRole('button', { name: /Mapa en 2D|2D map/ }).click();
  await expect(page.locator('solar-map')).toBeVisible();
  await expect(page.locator('canvas[data-backend]')).toBeHidden();
});

test('stays on the map, and says why, when 3D can’t start', async ({ page }) => {
  // The 3D code fails to load, as on a device or network that can't get it.
  await page.route(/solar-scene.*\.js$/, (route) => route.abort());
  await page.goto('./?t=2026-11-23T12:00Z&view=3d');
  await expect(page.getByRole('status')).toContainText(/vista 3D|3D view/);
  await expect(page.locator('solar-map')).toBeVisible();
});

test.describe('in a Spanish browser', () => {
  test.use({ locale: 'es-AR' });

  test('names the planets and the spacecraft, in the visitor’s language', async ({
    page,
  }, testInfo) => {
    await page.goto(sceneAddress(testInfo.project.name));
    await expect(page.locator('canvas[data-backend]')).toBeVisible({ timeout: 20_000 });
    const label = (id: string) => page.locator(`[data-label="${id}"]`);
    // Europa Clipper is about to fly past Earth: both must be named, apart.
    await expect(label('europa-clipper')).toHaveText('Europa Clipper');
    await expect(label('europa-clipper')).toHaveCSS('visibility', 'visible');
    await expect(label('earth')).toHaveText('Tierra');
    await expect(label('earth')).toHaveCSS('visibility', 'visible');
    const [clipper, earth] = [
      (await label('europa-clipper').boundingBox())!,
      (await label('earth').boundingBox())!,
    ];
    const apart =
      clipper.x >= earth.x + earth.width ||
      earth.x >= clipper.x + clipper.width ||
      clipper.y >= earth.y + earth.height ||
      earth.y >= clipper.y + clipper.height;
    expect(apart).toBe(true);

    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
    await expect(label('earth')).toHaveText('Earth');
  });
});

test('shows true sizes on request, keeping the spacecraft marked', async ({ page }, testInfo) => {
  await page.goto(sceneAddress(testInfo.project.name));
  await expect(page.locator('canvas[data-backend]')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Show true sizes|Ver tamaños reales/ }).click();
  await expect(page.getByRole('status')).toHaveText(/True sizes|Tamaños reales/);
  // The planets shrink below a pixel; their names and the spacecraft's stay.
  await expect(page.locator('[data-label="europa-clipper"]')).toHaveCSS('visibility', 'visible');
  // Each view keeps its own setting: the map is still on its log scale.
  await page.getByRole('button', { name: /2D map|Mapa en 2D/ }).click();
  await expect(
    page.getByRole('button', { name: /Show true distances|Ver distancias reales/ }),
  ).toBeVisible();
});

test('zooms from the tool column', async ({ page }, testInfo) => {
  await page.goto(sceneAddress(testInfo.project.name));
  await expect(page.locator('canvas[data-backend]')).toBeVisible({ timeout: 20_000 });
  // Venus: no spacecraft beside it to take its label's place (James Webb sits by Earth).
  // A hidden label keeps its last place, so only a visible one is measured. One call:
  // software WebGL draws a few frames a second, and each call waits for one.
  const apart = () =>
    page.evaluate(() => {
      const label = (id: string) => document.querySelector(`[data-label="${id}"]`)!;
      if (getComputedStyle(label('venus')).visibility !== 'visible') return -1;
      const [sun, venus] = [label('sun'), label('venus')].map((e) => e.getBoundingClientRect());
      return Math.hypot(venus!.x - sun!.x, venus!.y - sun!.y);
    });
  await expect.poll(apart).toBeGreaterThan(0);
  const start = await apart();
  // Half the distance to the Sun: Venus looks farther from it (by perspective, not
  // exactly twice).
  await page.getByRole('button', { name: /Zoom in|Acercar/ }).click();
  await expect.poll(apart).toBeGreaterThan(start * 1.3);
  await page.getByRole('button', { name: /Zoom out|Alejar/ }).click();
  await expect.poll(apart).toBeLessThan(start * 1.2);
  // Going back to the whole map is for the map only.
  await expect(
    page.getByRole('button', { name: /Show the whole map|Ver todo el mapa/ }),
  ).toHaveCount(0);
});

test('dives to a spacecraft’s model, and back out', async ({ page }, testInfo) => {
  await page.goto(sceneAddress(testInfo.project.name, '&focus=psyche'));
  const canvas = page.locator('canvas[data-backend]');
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  const card = page.locator('mission-card');
  await expect(card).toContainText(/Simplified 3D model, made for Apsis|Modelo 3D simplificado/);
  await card.getByRole('button', { name: /See it up close|Ver la nave de cerca/ }).click();
  await expect(canvas).toHaveAttribute('data-model', 'psyche', { timeout: 15_000 });
  // Close up, the card names it; its label steps aside.
  await expect(page.locator('[data-label="psyche"]')).toHaveCSS('visibility', 'hidden');
  await card
    .getByRole('button', { name: /Back to its neighbourhood|Volver a su vecindario/ })
    .click();
  await expect(canvas).not.toHaveAttribute('data-model', /.+/, { timeout: 15_000 });
});

test('opens 3D for a close-up asked for on the map', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'webgpu', 'The map is the same on every backend');
  await page.goto('./?t=2026-11-23T12:00Z&focus=psyche&backend=webgl2');
  await page
    .locator('mission-card')
    .getByRole('button', { name: /See it up close|Ver la nave de cerca/ })
    .click();
  await expect(page.locator('canvas[data-backend]')).toHaveAttribute('data-model', 'psyche', {
    timeout: 20_000,
  });
});

test('draws the Milky Way behind everything', async ({ page }, testInfo) => {
  await page.goto(sceneAddress(testInfo.project.name));
  await expect(page.locator('canvas[data-backend]')).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.endsWith('/textures/2k_stars_milky_way.jpg')),
      ),
    )
    .toBe(true);
});
