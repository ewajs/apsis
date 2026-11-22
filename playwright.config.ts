import { defineConfig, devices } from '@playwright/test';

// Browser tests run locally against the production build (ADR 0008); `npm run e2e`
// builds first. Served under /apsis/ like Pages, so asset paths are checked too.
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
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
