/**
 * Hands a spacecraft to the iPhone's AR viewer, Quick Look (ADR 0014). Quick Look reads
 * USDZ, not glTF: the model's AR copy is converted in the page, when asked, with
 * three's exporter, and handed over as a blob. Loaded only then.
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';

/**
 * Opens the GLB at `url` in Quick Look, at real size, standing as the pipeline stood it.
 * Resolves once Quick Look has been asked; it then opens on its own.
 */
export async function openInQuickLook(url: string): Promise<void> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const usdz = await new USDZExporter().parseAsync(gltf.scene, { quickLookCompatible: true });
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
