import { describe, expect, it } from 'vitest';
import { sceneViewerUrl } from './ar.ts';

describe('sceneViewerUrl', () => {
  it('opens the model in Scene Viewer, in AR at real size, and falls back to the page', () => {
    const url = sceneViewerUrl(
      'https://ewajs.github.io/apsis/models/ar/juno.glb',
      'Juno',
      'https://ewajs.github.io/apsis/?focus=juno',
    );
    expect(url.startsWith('intent://arvr.google.com/scene-viewer/1.0?')).toBe(true);
    const query = Object.fromEntries(
      url
        .slice(url.indexOf('?') + 1, url.indexOf('#'))
        .split('&')
        .map((pair) => pair.split('=').map(decodeURIComponent)),
    );
    expect(query).toEqual({
      file: 'https://ewajs.github.io/apsis/models/ar/juno.glb',
      mode: 'ar_preferred',
      title: 'Juno',
      resizable: 'false',
    });
    expect(url).toContain('package=com.google.android.googlequicksearchbox');
    expect(url).toContain(
      `S.browser_fallback_url=${encodeURIComponent('https://ewajs.github.io/apsis/?focus=juno')};end;`,
    );
  });
});
