/**
 * Handing a model to a phone's own AR viewer (ADR 0014). Pure: names and URLs in, names
 * and URLs out.
 */

/**
 * The two sizes a spacecraft comes in for AR: `room`, 1 m along its longest side, that
 * the viewer lets you resize; `real`, its true size, locked so it stays true.
 */
export type ArSize = 'room' | 'real';

/** How long a spacecraft is in its `room` size, in metres. */
export const ROOM_LENGTH_M = 1;

/**
 * A model's AR file, relative to the AR folder (`models/ar/`): GLB for Android's Scene
 * Viewer, USDZ for the iPhone's Quick Look, both made by `npm run models`.
 * @example arFile('iss', 'room', 'usdz') // 'iss-1m.usdz'
 */
export function arFile(id: string, size: ArSize, format: 'glb' | 'usdz'): string {
  return `${id}${size === 'room' ? '-1m' : ''}.${format}`;
}

/**
 * The scale of the `room` size, as the n of "1:n", for a spacecraft `lengthM` long.
 * @example roomScale(109) // 109
 */
export function roomScale(lengthM: number): number {
  return Math.max(1, Math.round(lengthM / ROOM_LENGTH_M));
}

/**
 * The link that opens a GLB in Android's Scene Viewer, in AR where the phone can; back
 * in the browser at `fallbackUrl` if the viewer isn't there. The real size can't be
 * resized; the room size can.
 * @param glbUrl An absolute https URL: Scene Viewer is another app and fetches it itself.
 * @param title Shown in the viewer: the name and the size.
 * @example sceneViewerUrl('https://x/juno.glb', 'Juno', 'https://x/', 'real') // 'intent://arvr.google.com/…'
 */
export function sceneViewerUrl(
  glbUrl: string,
  title: string,
  fallbackUrl: string,
  size: ArSize,
): string {
  // Built by hand: core runs without the browser's URL helpers (tsconfig.core.json).
  const query = Object.entries({
    file: glbUrl,
    mode: 'ar_preferred',
    title,
    resizable: size === 'room' ? 'true' : 'false',
  })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return (
    `intent://arvr.google.com/scene-viewer/1.0?${query}` +
    '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;' +
    'action=android.intent.action.VIEW;' +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
  );
}

/**
 * The address Quick Look opens a USDZ at: the real size locked against pinching
 * (`allowsContentScaling=0`, read by Quick Look from the fragment), the room size free.
 * @example quickLookHref('https://x/iss.usdz', 'real') // 'https://x/iss.usdz#allowsContentScaling=0'
 */
export function quickLookHref(usdzUrl: string, size: ArSize): string {
  return size === 'real' ? `${usdzUrl}#allowsContentScaling=0` : usdzUrl;
}
