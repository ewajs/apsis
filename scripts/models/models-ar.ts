/**
 * Rebuilds only the AR files besides each real-size AR copy (the 1 m copy and both
 * USDZ files) and the sizes in the models index, leaving the models as they are:
 * `npm run models:ar`, or `npm run models:ar -- --id iss` for one. See ar-variants.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';
import { parseModelIndex } from '../../src/core/models.ts';
import { writeArVariants } from './ar-variants.ts';

const INDEX = 'public/models/index.json';
const { values } = parseArgs({ options: { id: { type: 'string' } } });
const raw = JSON.parse(readFileSync(INDEX, 'utf8')) as { version: 1; models: { id: string }[] };
const ids = raw.models.map((model) => model.id).filter((id) => !values.id || id === values.id);
if (ids.length === 0) throw new Error(`No model "${values.id}"`);
const dimensions = await writeArVariants(ids);
const index = {
  ...raw,
  models: raw.models.map((model) => ({
    ...model,
    ...(dimensions.has(model.id) && { dimensionsM: dimensions.get(model.id) }),
  })),
};
writeFileSync(
  INDEX,
  await format(JSON.stringify(parseModelIndex(index), null, 2), {
    ...(await resolveConfig(INDEX)),
    parser: 'json',
  }),
);
console.log(`AR files for ${ids.length} model(s), and their sizes in ${INDEX}`);
