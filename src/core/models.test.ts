import { describe, expect, it } from 'vitest';
import { parseModelIndex } from './models.ts';

const juno = {
  id: 'juno',
  file: 'juno.glb',
  lengthM: 20,
  credit: 'NASA/JPL-Caltech',
  licence: 'Public domain',
  source: 'https://science.nasa.gov/3d-resources/',
  ours: false,
};

describe('parseModelIndex', () => {
  it('accepts a valid index', () => {
    const index = { version: 1, models: [juno] };
    expect(parseModelIndex(index)).toEqual(index);
  });

  it('lists every problem', () => {
    let message = '';
    try {
      parseModelIndex({
        version: 1,
        models: [{ ...juno, lengthM: 0, credit: '' }, 3, { ...juno, pointing: 'mars' }],
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(
      message
        .split('\n')
        .slice(1)
        .map((line) => line.trim()),
    ).toEqual([
      'models[0].credit is missing',
      'models[0].lengthM must be a positive number of metres',
      'models[1] is not an object',
      'models[2].pointing must be earth or sun',
    ]);
  });

  it('refuses another shape', () => {
    expect(() => parseModelIndex([juno])).toThrow(/version: 1/);
  });
});
