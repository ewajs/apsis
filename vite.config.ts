import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Served from https://ewajs.github.io/apsis/ (ADR 0008), so every asset lives under it. */
const base = '/apsis/';
/** --color-bg in src/ui/styles.css: the splash screen and the browser's bars. */
const background = '#070b14';

export default defineConfig({
  base,
  build: {
    // The 3D view's chunk (three.js, ~230 KB gzipped) loads only when someone picks 3D;
    // the page itself stays small. Warn only above that.
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    // Installable and offline (ADR 0007). The precache is the app shell only; data will
    // be cached at runtime, so daily data deploys don't count as app updates.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Apsis',
        short_name: 'Apsis',
        description:
          '¿Dónde están ahora? Las misiones al espacio profundo en un sistema solar 3D. Where are they now? Deep-space missions in a 3D solar system.',
        lang: 'es-AR',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: background,
        theme_color: background,
        categories: ['education', 'science'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app shell and the planet textures (about 4 MB, ADR 0007).
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,webmanifest}'],
        // Data is cached as it's used, never precached: show the cached copy at once and
        // refresh it in the background (ADR 0007).
        runtimeCaching: [
          {
            urlPattern: /\/data\/.+\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'apsis-data' },
          },
        ],
      },
    }),
  ],
});
