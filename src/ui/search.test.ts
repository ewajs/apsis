import { describe, expect, it } from 'vitest';
import { bestMatch, matches, searchForm } from './search.ts';

describe('search', () => {
  it('ignores case and accents', () => {
    expect(searchForm('Júpiter')).toBe('jupiter');
    expect(matches('JUPI', ['Júpiter'])).toBe(true);
    expect(matches('júpiter', ['Jupiter'])).toBe(true);
  });

  it('needs every word, anywhere', () => {
    expect(matches('nasa jup', ['Juno', 'NASA', 'Júpiter'])).toBe(true);
    expect(matches('esa jup', ['Juno', 'NASA', 'Júpiter'])).toBe(false);
  });

  it('matches everything when empty', () => {
    expect(matches('', ['Juno'])).toBe(true);
    expect(matches('  ', ['Juno'])).toBe(true);
  });

  it('takes an exact name first, then a name that starts with the search, then a mention', () => {
    const list = [
      { name: 'Juno', detail: 'NASA · Júpiter' },
      { name: 'Mercurio', detail: '' },
      { name: 'Júpiter', detail: '' },
      { name: 'Ío', detail: 'Luna de Júpiter' },
    ];
    expect(bestMatch('io', list)?.name).toBe('Ío');
    expect(bestMatch('jupi', list)?.name).toBe('Júpiter');
    expect(bestMatch('ju', list)?.name).toBe('Juno');
    expect(bestMatch('zzz', [])).toBeUndefined();
  });
});
