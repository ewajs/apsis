import { describe, expect, it } from 'vitest';
import { pickLocale } from './localization.ts';

describe('pickLocale', () => {
  it('keeps a previous choice', () => {
    expect(pickLocale('en', ['es-AR'])).toBe('en');
    expect(pickLocale('es-AR', ['en-US'])).toBe('es-AR');
  });

  it('ignores a stored value that is not a locale', () => {
    expect(pickLocale('fr', ['es-ES'])).toBe('es-AR');
  });

  it('speaks Spanish to any Spanish browser and English to the rest', () => {
    expect(pickLocale(null, ['es'])).toBe('es-AR');
    expect(pickLocale(null, ['es-MX', 'en'])).toBe('es-AR');
    expect(pickLocale(null, ['en-GB', 'es'])).toBe('en');
    expect(pickLocale(null, ['pt-BR'])).toBe('en');
    expect(pickLocale(null, [])).toBe('en');
  });
});
