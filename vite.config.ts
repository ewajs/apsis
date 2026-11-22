import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Served from https://ewajs.github.io/apsis/ (ADR 0008), so every asset lives under it. */
const base = '/apsis/';
/** --color-bg in src/ui/styles.css: the splash screen and the browser's bars. */
const background = '#070b14';

export default defineConfig({
  base,
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
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
});
