/**
 * The tabletop for the iPhone's Quick Look (ADR 0014): built from the shown instant, so
 * converted in the page, when asked, with three's USDZ exporter, and passed on as a blob.
 * A spacecraft's own USDZ files are made ahead by `npm run models`. Loaded only when used.
 */
import type { Object3D } from 'three';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { openInQuickLook } from './quick-look.ts';

/**
 * Opens a three.js object (metres, +Y up) in Quick Look, anchored to the floor or a
 * table. Resolves once Quick Look has been asked; it then opens on its own.
 */
export async function openObjectInQuickLook(object: Object3D): Promise<void> {
  // The exporter writes each object's matrix, which three only works out on a render:
  // built and never drawn, everything would sit at the origin at scale 1 (a planet
  // a metre across, with Saturn's rings around it).
  object.updateMatrixWorld(true);
  const usdz = await new USDZExporter().parseAsync(object, { quickLookCompatible: true });
  openInQuickLook(URL.createObjectURL(new Blob([usdz], { type: 'model/vnd.usdz+zip' })));
}
