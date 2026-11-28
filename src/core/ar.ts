/**
 * Handing a model to a phone's own AR viewer (ADR 0014). Pure: URLs in, a URL out.
 */

/**
 * The link that opens a GLB in Android's Scene Viewer, in AR where the phone can, at real
 * size; back in the browser at `fallbackUrl` if the viewer isn't there.
 * @param glbUrl An absolute https URL: Scene Viewer is another app and fetches it itself.
 * @example sceneViewerUrl('https://x/juno.glb', 'Juno', 'https://x/') // 'intent://arvr.google.com/…'
 */
export function sceneViewerUrl(glbUrl: string, title: string, fallbackUrl: string): string {
  // Built by hand: core runs without the browser's URL helpers (tsconfig.core.json).
  const query = Object.entries({ file: glbUrl, mode: 'ar_preferred', title, resizable: 'false' })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return (
    `intent://arvr.google.com/scene-viewer/1.0?${query}` +
    '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;' +
    'action=android.intent.action.VIEW;' +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
  );
}
