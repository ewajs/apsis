import { defineConfig, devices } from '@playwright/test';

// Browser tests run locally against the production build (ADR 0008); `npm run e2e`
// builds first. Served under /apsis/ like Pages, so asset paths are checked too.

/**
 * WebKit's network process fails when a snap (such as VS Code's) leaks its GTK and
 * data paths into the environment, so WebKit gets an environment without them.
 */
const webkitEnv = Object.fromEntries(
  Object.entries(process.env)
    .filter(
      ([name]) =>
        ![
          'GTK_PATH',
          'GTK_EXE_PREFIX',
          'GIO_MODULE_DIR',
          'GSETTINGS_SCHEMA_DIR',
          'LOCPATH',
          'GTK_IM_MODULE_FILE',
        ].includes(name),
    )
    .map(([name, value]) => [
      name,
      name === 'XDG_DATA_DIRS'
        ? (value ?? '')
            .split(':')
            .filter((dir) => !dir.startsWith('/snap/'))
            .join(':')
        : (value ?? ''),
    ]),
);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173/apsis/', trace: 'off' },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/apsis/',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'], launchOptions: { env: webkitEnv } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // The WebGPU backend for real: Chromium's newer headless mode can present WebGPU
    // frames through SwiftShader, a software GPU. Scene tests only.
    {
      name: 'webgpu',
      testMatch: /scene\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: {
          args: [
            '--enable-unsafe-webgpu',
            '--ignore-gpu-blocklist',
            '--use-gl=angle',
            '--use-angle=gl-egl',
          ],
        },
      },
    },
  ],
});
