/**
 * The AR files besides each model's real-size AR copy (ADR 0014, docs/guides/ar.md):
 *
 * - `ar/<id>-1m.glb`: the same copy, 1 m along its longest side (one node scales it);
 * - `ar/<id>.usdz` and `ar/<id>-1m.usdz`: both for the iPhone's Quick Look, converted
 *   with three's USDZ exporter, the one the page used to run on the phone. It needs a
 *   browser's canvas for the textures, so it runs here in headless Chromium. It writes
 *   USD as text, three times the GLB's size; Pixar's usd-core (Python, in a pinned
 *   virtual environment under `.cache/`, made on first use) rewrites it in binary.
 *
 * Also measures each copy, for the card ("109 × 73 × 20 m"). `npm run models` calls it
 * for what it builds; `npm run models:ar` (with `--id` for one) rebuilds only these.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { chromium } from '@playwright/test';
import { ROOM_LENGTH_M, arFile } from '../../src/core/ar.ts';

const AR_DIR = 'public/models/ar';
/** A made-up origin the headless page loads from; every request to it is answered here. */
const ORIGIN = 'http://ar.local';
const THREE = 'node_modules/three';
/** Pixar's USD library, for binary USDZ; pinned, so every run writes the same files. */
const USD_CORE = 'usd-core==0.26.11';
const VENV = '.cache/usd-venv';

/** A model's real size in AR, metres: across, up, and front to back (x, y, z). */
export type Dimensions = [number, number, number];

/**
 * Writes the 1 m GLB and both USDZ files for each model in `ids`, from its real-size
 * AR copy, and returns each one's real dimensions.
 */
export async function writeArVariants(ids: readonly string[]): Promise<Map<string, Dimensions>> {
  const io = new NodeIO();
  const dimensions = new Map<string, Dimensions>();
  for (const id of ids) {
    const document = await io.read(`${AR_DIR}/${arFile(id, 'real', 'glb')}`);
    const scene = document.getRoot().listScenes()[0]!;
    const { min, max } = getBounds(scene);
    const size = [0, 1, 2].map((axis) => max[axis]! - min[axis]!) as Dimensions;
    // To the millimetre: what the card shows is whole metres at best.
    const measured = size.map((m) => Math.round(m * 1000) / 1000) as Dimensions;
    dimensions.set(id, measured);
    // The copy stands on the floor, centred over the origin: scaling about the origin
    // keeps it there.
    const room = document
      .createNode('room-size')
      .setScale(Array(3).fill(ROOM_LENGTH_M / Math.max(...size)) as Dimensions);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      room.addChild(child);
    }
    scene.addChild(room);
    writeFileSync(`${AR_DIR}/${arFile(id, 'room', 'glb')}`, await io.writeBinary(document));
  }
  const glbs = ids.flatMap((id) => [arFile(id, 'real', 'glb'), arFile(id, 'room', 'glb')]);
  await convertToUsdz(glbs);
  toBinaryUsd(glbs.map((glb) => `${AR_DIR}/${glb.replace(/\.glb$/, '.usdz')}`));
  return dimensions;
}

/** Converts AR GLB files (names in the AR folder) to USDZ beside them, in one browser. */
async function convertToUsdz(files: readonly string[]): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(`${ORIGIN}/**`, async (route) => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname);
      if (path === '/') {
        return route.fulfill({ contentType: 'text/html', body: PAGE });
      }
      if (path.startsWith('/save/')) {
        writeFileSync(
          `${AR_DIR}/${path.slice('/save/'.length)}`,
          route.request().postDataBuffer()!,
        );
        return route.fulfill({ status: 204 });
      }
      const [root, rest] = path.startsWith('/three/')
        ? [THREE, path.slice('/three/'.length)]
        : [AR_DIR, path.slice('/ar/'.length)];
      return route.fulfill({
        body: readFileSync(`${root}/${rest}`),
        contentType: rest.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
      });
    });
    await page.goto(`${ORIGIN}/`);
    for (const file of files) {
      const usdz = file.replace(/\.glb$/, '.usdz');
      await page.evaluate(
        ([from, to]) =>
          (globalThis as unknown as { convert: (a: string, b: string) => Promise<void> }).convert(
            from!,
            to!,
          ),
        [file, usdz],
      );
      console.log(`  ${usdz}`);
    }
  } finally {
    await browser.close();
  }
}

/** The headless page: three's loader and exporter, and `convert(from, to)`. */
const PAGE = `<!doctype html>
<script type="importmap">
  { "imports": { "three": "/three/build/three.module.js", "three/addons/": "/three/examples/jsm/" } }
</script>
<script type="module">
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
  window.convert = async (from, to) => {
    const gltf = await new GLTFLoader().loadAsync('/ar/' + from);
    const usdz = await new USDZExporter().parseAsync(gltf.scene, { quickLookCompatible: true });
    const answer = await fetch('/save/' + to, { method: 'POST', body: usdz });
    if (!answer.ok) throw new Error(to + ': not saved');
  };
</script>`;

/** Rewrites USDZ files with binary layers (`usdz_binary.py`), making usd-core's venv once. */
function toBinaryUsd(files: readonly string[]): void {
  const python = `${VENV}/bin/python`;
  if (!existsSync(python)) {
    console.log(`  installing ${USD_CORE} in ${VENV}`);
    execFileSync('python3', ['-m', 'venv', VENV], { stdio: 'inherit' });
    execFileSync(`${VENV}/bin/pip`, ['install', '--quiet', USD_CORE], { stdio: 'inherit' });
  }
  execFileSync(python, ['-I', 'scripts/models/usdz_binary.py', ...files], { stdio: 'inherit' });
}
