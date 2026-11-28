import { readdirSync } from 'node:fs';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';

/** What the phones' AR viewers are sure to read: plain glTF, no compression extensions. */
const PLAIN = new Set(['KHR_materials_emissive_strength', 'KHR_texture_transform']);

describe('the AR copies (public/models/ar)', async () => {
  const io = new NodeIO();
  const files = readdirSync('public/models/ar').filter((file) => file.endsWith('.glb'));

  it('exist for every model', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file}: plain glTF, standing on the floor, centred`, async () => {
      const document = await io.read(`public/models/ar/${file}`);
      const used = document
        .getRoot()
        .listExtensionsUsed()
        .map((extension) => extension.extensionName);
      expect(used.filter((name) => !PLAIN.has(name))).toEqual([]);
      const { min, max } = getBounds(document.getRoot().listScenes()[0]!);
      expect(min[1]).toBeCloseTo(0, 3);
      expect((min[0] + max[0]) / 2).toBeCloseTo(0, 3);
      expect((min[2] + max[2]) / 2).toBeCloseTo(0, 3);
    });
  }
});
