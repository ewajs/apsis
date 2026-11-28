import { describe, expect, it } from 'vitest';
import { matches, searchForm } from './search.ts';

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
});
