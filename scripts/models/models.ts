/**
 * Builds the spacecraft models (ADR 0013, docs/guides/models.md): `npm run models`.
 *
 * Reads `data/models.yaml`; for each spacecraft, takes a free model from its source
 * (downloaded once into `.cache/models/`) or builds our own in code
 * (`scripts/models/own/<id>.ts`); brings it into the shared body frame (metres, centred,
 * +Z along the high-gain antenna, +Y along the solar arrays) at its real size;
 * compresses it; and writes `public/models/<id>.glb` and `public/models/index.json`.
 *
 *   npm run models                 every model
 *   npm run models -- --id juno    one
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Material, NodeIO, getBounds, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import {
  cloneDocument,
  dedup,
  prune,
  quantize,
  reorder,
  simplify,
  textureCompress,
  weld,
} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { Euler, Quaternion } from 'three';
import { parse } from 'yaml';
import { parseModelIndex, type ModelEntry } from '../../src/core/models.ts';
import { materials } from './own/parts.ts';
import { threeToDocument } from './three-to-gltf.ts';

/** One line of `data/models.yaml`. */
type Recipe = {
  id: string;
  /** Real largest dimension, in metres: the model is scaled to it. */
  lengthM: number;
  credit: string;
  licence: string;
  /** The page it comes from (shown in the credits). */
  page?: string;
  /** A direct download of a GLB or glTF file. */
  url?: string;
  /** Turns, in degrees about x, then y, then z, that bring it into the body frame. */
  rotate?: [number, number, number];
  /** Our own: built by `scripts/models/own/<id>.ts`. */
  own?: boolean;
  /**
   * Source materials (by name) to replace with ours from `own/parts.ts`, where a model
   * comes with placeholder colours: `{ 'bus:black': black }`.
   */
  materials?: Record<string, keyof typeof materials>;
  /** What its +Z faces in flight (`ModelEntry.pointing`); Earth when absent. */
  pointing?: 'earth' | 'sun';
  /**
   * For a heavy source: keep about this fraction of its triangles (Meshopt's simplifier,
   * which keeps the silhouette and the seams).
   */
  simplify?: number;
  /**
   * How far, as a fraction of each part's size, the simplifier may move the surface
   * (0.0005 when absent): looser for a source whose seams keep it from simplifying.
   */
  simplifyError?: number;
  /**
   * Which way is up in AR: `-z` for one whose +Z faces Earth from below (a satellite's
   * nadir side, a telescope's aft end), so it doesn't stand on its head. `+z` when absent.
   */
  arUp?: '+z' | '-z';
};

/** The size a model should stay under, in bytes (ADR 0013). */
const BUDGET_BYTES = 5e6;
/** How far the simplifier may move a surface, as a fraction of the part's size. */
const SIMPLIFY_ERROR = 0.0005;
/** Textures are recompressed to WebP, at most this many pixels on a side. */
const TEXTURE_MAX_PX = 2048;
/** For AR, smaller textures: phones' AR viewers load the file whole. */
const AR_TEXTURE_MAX_PX = 1024;
/** The AR copy should stay under this, in bytes; heavier ones are simplified further. */
const AR_BUDGET_BYTES = 5e6;

const OUT = 'public/models';
/** The AR copies (ADR 0014): plain GLB, standing up, for the phones' own AR viewers. */
const AR_OUT = `${OUT}/ar`;
const CACHE = '.cache/models';

const { values } = parseArgs({ options: { id: { type: 'string' } } });
const recipes = parse(readFileSync('data/models.yaml', 'utf8')) as Recipe[];
// Several NASA files arrive Draco-compressed: decoded on reading, re-encoded as Meshopt.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
mkdirSync(AR_OUT, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const indexPath = `${OUT}/index.json`;
const previous = existsSync(indexPath)
  ? parseModelIndex(JSON.parse(readFileSync(indexPath, 'utf8'))).models
  : [];
const entries = new Map(previous.map((entry) => [entry.id, entry]));

for (const recipe of recipes) {
  if (values.id && recipe.id !== values.id) continue;
  const document = await load(recipe);
  await toBodyFrame(document, recipe);
  const ar = cloneDocument(document);
  await compressForApp(document);
  await standForAr(ar, recipe.arUp ?? '+z');
  // Plain glTF is big: a heavy model keeps fewer triangles in AR, then smaller
  // textures, until it fits.
  const arSize = async () => (await io.writeBinary(ar)).byteLength;
  if ((await arSize()) > AR_BUDGET_BYTES) {
    // A phone's AR view forgives more than a close-up: up to 2% of the size off.
    await ar.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.02 }),
    );
  }
  if ((await arSize()) > AR_BUDGET_BYTES) await arTextures(ar, AR_TEXTURE_MAX_PX / 2);
  const file = `${recipe.id}.glb`;
  const bytes = await io.writeBinary(document);
  writeFileSync(`${OUT}/${file}`, bytes);
  const arBytes = await io.writeBinary(ar);
  writeFileSync(`${AR_OUT}/${file}`, arBytes);
  const entry: ModelEntry = {
    id: recipe.id,
    file,
    lengthM: recipe.lengthM,
    credit: recipe.credit,
    licence: recipe.licence,
    ours: recipe.own === true,
    ...(recipe.page && { source: recipe.page }),
    ...(recipe.pointing && { pointing: recipe.pointing }),
  };
  entries.set(recipe.id, entry);
  const over = bytes.byteLength > BUDGET_BYTES ? '  over the 5 MB budget' : '';
  const mb = (n: number) => `${(n / 1e6).toFixed(2)} MB`;
  console.log(
    `  ${recipe.id.padEnd(20)} ${mb(bytes.byteLength)}${over}, AR ${mb(arBytes.byteLength)}`,
  );
}

const order = recipes.map((recipe) => recipe.id);
const index = {
  version: 1 as const,
  models: [...entries.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
};
writeFileSync(indexPath, `${JSON.stringify(parseModelIndex(index), null, 2)}\n`);
console.log(`Wrote ${index.models.length} model(s) to ${OUT}/`);

/** The model as found: downloaded (once), or built by our own code. */
async function load(recipe: Recipe): Promise<Document> {
  if (recipe.own) {
    const { build } = (await import(`./own/${recipe.id}.ts`)) as {
      build: () => import('three').Object3D;
    };
    return threeToDocument(build());
  }
  if (!recipe.url) throw new Error(`${recipe.id}: needs a url, or own: true`);
  const cached = `${CACHE}/${recipe.id}.glb`;
  if (!existsSync(cached)) {
    const response = await fetch(recipe.url);
    if (!response.ok) throw new Error(`${recipe.id}: ${response.status} for ${recipe.url}`);
    writeFileSync(cached, new Uint8Array(await response.arrayBuffer()));
  }
  return io.read(cached);
}

/**
 * Brings a model into the body frame at its real size, with our materials where asked,
 * duplicate data merged, unused data dropped and, if asked, simplified.
 */
async function toBodyFrame(document: Document, recipe: Recipe): Promise<void> {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) throw new Error(`${recipe.id}: the file has no scene`);
  // Everything under one node turned into the body frame, under one that centres and
  // scales: rotation first, so the size is measured along the body frame's axes.
  const turn = document.createNode('body-frame');
  const [x, y, z] = (recipe.rotate ?? [0, 0, 0]).map((deg) => (deg * Math.PI) / 180);
  const quaternion = new Quaternion().setFromEuler(new Euler(x, y, z, 'XYZ'));
  turn.setRotation(quaternion.toArray() as [number, number, number, number]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    turn.addChild(child);
  }
  const place = document.createNode(recipe.id).addChild(turn);
  scene.addChild(place);
  const { min, max } = getBounds(scene);
  const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const k = recipe.lengthM / size;
  place
    .setScale([k, k, k])
    .setTranslation([
      (-k * (min[0] + max[0])) / 2,
      (-k * (min[1] + max[1])) / 2,
      (-k * (min[2] + max[2])) / 2,
    ]);
  for (const material of root.listMaterials()) {
    const ours = recipe.materials?.[material.getName()];
    if (!ours) continue;
    const { color, metalness, roughness } = materials[ours];
    material
      .setBaseColorFactor([color.r, color.g, color.b, 1])
      .setBaseColorTexture(null)
      .setMetallicFactor(metalness)
      .setRoughnessFactor(roughness);
  }
  for (const extension of root.listExtensionsUsed()) {
    if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose();
  }
  await document.transform(
    dedup(),
    prune(),
    weld(),
    ...(recipe.simplify
      ? [
          simplify({
            simplifier: MeshoptSimplifier,
            ratio: recipe.simplify,
            error: recipe.simplifyError ?? SIMPLIFY_ERROR,
          }),
        ]
      : []),
  );
}

/** The app's copy: WebP textures, vertices quantised and Meshopt-encoded. */
async function compressForApp(document: Document): Promise<void> {
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await document.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [TEXTURE_MAX_PX, TEXTURE_MAX_PX],
    }),
    reorder({ encoder: MeshoptEncoder }),
    quantize(),
  );
}

/**
 * The AR copy (ADR 0014): plain glTF, which every AR viewer reads (no Meshopt, no
 * quantisation, textures in their own format, at most 1024 px), stood up the way the
 * viewers place a model on the floor: the antenna (+Z) up (or `up`), its lowest point at floor
 * level and centred over it.
 */
async function standForAr(document: Document, up: '+z' | '-z'): Promise<void> {
  const scene = document.getRoot().listScenes()[0]!;
  const stand = document.createNode('stand');
  // −90° about x: +Z (the antenna) to +Y (up); +90°, −Z up.
  const half = up === '+z' ? -Math.SQRT1_2 : Math.SQRT1_2;
  stand.setRotation([half, 0, 0, Math.SQRT1_2]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    stand.addChild(child);
  }
  const floor = document.createNode('floor').addChild(stand);
  scene.addChild(floor);
  const { min, max } = getBounds(scene);
  floor.setTranslation([-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2]);
  await arTextures(document, AR_TEXTURE_MAX_PX);
}

/**
 * The AR copy's textures: at most `px` on a side, as JPEG (a tenth of PNG's size) unless
 * their material is see-through.
 */
async function arTextures(document: Document, px: number): Promise<void> {
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const seeThrough = texture
      .listParents()
      .some((parent) => parent instanceof Material && parent.getAlphaMode() !== 'OPAQUE');
    const resized = sharp(image).resize(px, px, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    const bytes = seeThrough
      ? await resized.png().toBuffer()
      : await resized.jpeg({ quality: 82 }).toBuffer();
    texture.setImage(new Uint8Array(bytes)).setMimeType(seeThrough ? 'image/png' : 'image/jpeg');
  }
}
