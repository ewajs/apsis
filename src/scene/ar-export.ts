/**
 * Hands things to the iPhone's AR viewer, Quick Look (ADR 0014). Quick Look reads USDZ,
 * not glTF: what's handed over is converted in the page, when asked, with three's
 * exporter, and passed on as a blob. Loaded only then.
 */
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';

/**
 * Opens a three.js object (metres, +Y up) in Quick Look, anchored to the floor or a
 * table. Resolves once Quick Look has been asked; it then opens on its own.
 */
export async function openInQuickLook(object: Object3D): Promise<void> {
  const usdz = await new USDZExporter().parseAsync(object, { quickLookCompatible: true });
  const link = document.createElement('a');
  link.rel = 'ar';
  link.href = URL.createObjectURL(new Blob([usdz], { type: 'model/vnd.usdz+zip' }));
  // Quick Look answers a link with rel="ar" whose only child is an image.
  link.append(document.createElement('img'));
  link.dataset.ar = 'quick-look';
  link.hidden = true;
  document.body.append(link);
  link.click();
}

/** Opens the GLB at `url` (a model's AR copy, standing as the pipeline stood it). */
export async function openModelInQuickLook(url: string): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync(url);
  await openInQuickLook(gltf.scene);
}
