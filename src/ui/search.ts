/**
 * Brings text to the form searches compare: lower case, accents gone (`Júpiter` →
 * `jupiter`), so "jupi" finds Júpiter and "jupiter" too.
 */
export function searchForm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Whether every word of `query` appears somewhere in `texts` (a name, an agency, a
 * target). An empty query matches everything.
 * @example matches('nasa jup', ['Juno', 'NASA', 'Júpiter']) // true
 */
export function matches(query: string, texts: readonly string[]): boolean {
  const haystack = searchForm(texts.join(' '));
  return searchForm(query)
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
