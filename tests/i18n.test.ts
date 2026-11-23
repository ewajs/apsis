import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/i18n/locales/en.ts';

// Every msg() in src/ has an id (ADR 0006); collect them straight from the source.
function sourceIds(): string[] {
  const files = readdirSync(new URL('../src/', import.meta.url), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
  const ids = files.flatMap((file) => {
    const text = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    return [...text.matchAll(/\bmsg\([\s\S]*?\{\s*id:\s*'([^']+)'\s*,?\s*\}/g)].map((m) => m[1]!);
  });
  return [...new Set(ids)].sort();
}

describe('English translations', () => {
  it('exist for every message, and only for messages that exist', () => {
    expect(Object.keys(templates).sort()).toEqual(sourceIds());
  });

  it('are never empty', () => {
    for (const text of Object.values(templates)) {
      const plain = typeof text === 'string' ? text : text.strings.join('');
      expect(plain.trim()).not.toBe('');
    }
  });
});
