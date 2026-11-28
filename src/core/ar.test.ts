import { describe, expect, it } from 'vitest';
import { arFile, quickLookHref, roomScale, sceneViewerUrl } from './ar.ts';

const query = (url: string) =>
  Object.fromEntries(
    url
      .slice(url.indexOf('?') + 1, url.indexOf('#'))
      .split('&')
      .map((pair) => pair.split('=').map(decodeURIComponent)),
  );

describe('sceneViewerUrl', () => {
  it('opens the model in Scene Viewer, in AR, and falls back to the page', () => {
    const url = sceneViewerUrl(
      'https://ewajs.github.io/apsis/models/ar/juno.glb',
      'Juno',
      'https://ewajs.github.io/apsis/?focus=juno',
      'real',
    );
    expect(url.startsWith('intent://arvr.google.com/scene-viewer/1.0?')).toBe(true);
    expect(query(url)).toEqual({
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

  it('lets the room size be resized, and keeps the real size true', () => {
    const url = (size: 'room' | 'real') =>
      sceneViewerUrl('https://x/a.glb', 'A', 'https://x/', size);
    expect(query(url('room')).resizable).toBe('true');
    expect(query(url('real')).resizable).toBe('false');
  });
});

describe('arFile', () => {
  it('names the AR files by size and format', () => {
    expect(arFile('iss', 'real', 'glb')).toBe('iss.glb');
    expect(arFile('iss', 'room', 'glb')).toBe('iss-1m.glb');
    expect(arFile('iss', 'real', 'usdz')).toBe('iss.usdz');
    expect(arFile('iss', 'room', 'usdz')).toBe('iss-1m.usdz');
  });
});

describe('roomScale', () => {
  it('says how many times smaller the 1 m copy is', () => {
    expect(roomScale(109)).toBe(109);
    expect(roomScale(5.7)).toBe(6);
    expect(roomScale(0.4)).toBe(1);
  });
});

describe('quickLookHref', () => {
  it('locks the real size against pinching, and leaves the room size free', () => {
    expect(quickLookHref('https://x/iss.usdz', 'real')).toBe(
      'https://x/iss.usdz#allowsContentScaling=0',
    );
    expect(quickLookHref('https://x/iss-1m.usdz', 'room')).toBe('https://x/iss-1m.usdz');
  });
});
