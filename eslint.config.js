import { fileURLToPath, URL } from 'node:url';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

// Which folder may import which (docs/ARCHITECTURE.md, "Dependency direction").
// Everything not allowed here is an error, external packages included.
const allow = (from, to) => ({ from: { element: { type: from } }, allow: { to } });
const elements = (...types) => ({ element: { types } });
const packages = (...source) => ({ module: { origin: 'external', source } });
const nodeBuiltins = { module: { origin: 'core' } };

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': fileURLToPath(new URL('.', import.meta.url)),
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core' },
        { type: 'data', pattern: 'src/data' },
        { type: 'scene', pattern: 'src/scene' },
        { type: 'map', pattern: 'src/map' },
        { type: 'ui', pattern: 'src/ui' },
        { type: 'i18n', pattern: 'src/i18n' },
        // Last, so it only takes the files directly in src/ (main.ts) that no folder above claims.
        { type: 'app', pattern: 'src' },
        { type: 'scripts', pattern: 'scripts' },
      ],
      'boundaries/files': [{ pattern: '**/*.test.ts', category: 'test' }],
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json', 'tsconfig.node.json'],
          noWarnOnMultipleProjects: true,
        },
        node: { extensions: ['.ts', '.js', '.css'] },
      },
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            // core imports nothing but itself.
            allow('core', elements('core')),
            allow('data', elements('data', 'core')),
            allow('scene', elements('scene', 'core')),
            allow('scene', packages('three', 'three/*')),
            allow('map', elements('map', 'core')),
            allow('ui', elements('ui', 'core', 'i18n')),
            allow('ui', packages('lit', 'lit/*', '@lit/localize')),
            allow('i18n', elements('i18n')),
            allow('i18n', packages('@lit/localize')),
            // main.ts wires the siblings together; they never import each other.
            allow('app', elements('core', 'data', 'scene', 'map', 'ui', 'i18n')),
            // The data scripts share core's types and pure parsers, and run on Node.
            allow('scripts', elements('scripts', 'core')),
            allow('scripts', nodeBuiltins),
            // Renders the icons in the pinned Playwright Chromium.
            allow('scripts', packages('@playwright/test')),
            {
              from: { file: { categories: 'test' } },
              allow: { to: packages('vitest') },
            },
          ],
        },
      ],
    },
  },
  prettier,
];
