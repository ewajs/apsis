import { readFileSync, readdirSync } from 'node:fs';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { ROOM_LENGTH_M, arFile } from '../../src/core/ar.ts';
import { parseModelIndex } from '../../src/core/models.ts';

/** What the phones' AR viewers are sure to read: plain glTF, no compression extensions. */
const PLAIN = new Set(['KHR_materials_emissive_strength', 'KHR_texture_transform']);
const AR = 'public/models/ar';

describe('the AR copies (public/models/ar)', async () => {
  const io = new NodeIO();
  const files = readdirSync(AR).filter((file) => file.endsWith('.glb'));
  const { models } = parseModelIndex(JSON.parse(readFileSync('public/models/index.json', 'utf8')));

  it('exist for every model, in both sizes and both formats', () => {
    const wanted = models.flatMap((model) =>
      (['real', 'room'] as const).flatMap((size) =>
        (['glb', 'usdz'] as const).map((format) => arFile(model.id, size, format)),
      ),
    );
    expect(readdirSync(AR).sort()).toEqual(wanted.sort());
  });

  for (const file of files) {
    it(`${file}: plain glTF, standing on the floor, centred`, async () => {
      const document = await io.read(`${AR}/${file}`);
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

  for (const model of models) {
    it(`${model.id}: 1 m long in its room size, and measured in the index`, async () => {
      const bounds = async (file: string) => {
        const { min, max } = getBounds((await io.read(`${AR}/${file}`)).getRoot().listScenes()[0]!);
        return [0, 1, 2].map((axis) => max[axis]! - min[axis]!);
      };
      const real = await bounds(arFile(model.id, 'real', 'glb'));
      model.dimensionsM.forEach((m, axis) => expect(m).toBeCloseTo(real[axis]!, 2));
      const room = await bounds(arFile(model.id, 'room', 'glb'));
      expect(Math.max(...room)).toBeCloseTo(ROOM_LENGTH_M, 3);
    });

    it(`${model.id}: USDZ packages for Quick Look, binary, uncompressed`, () => {
      for (const size of ['real', 'room'] as const) {
        const bytes = readFileSync(`${AR}/${arFile(model.id, size, 'usdz')}`);
        // A zip whose first entry is stored (method 0) and is the binary root layer.
        expect(bytes.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');
        expect(bytes.readUInt16LE(8)).toBe(0);
        const nameLength = bytes.readUInt16LE(26);
        expect(bytes.subarray(30, 30 + nameLength).toString()).toBe('model.usdc');
      }
    });
  }
});
