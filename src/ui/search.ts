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

/**
 * The entry Enter should take for `query`: an exact name first ("io" is Ío), then a name
 * that starts with it, then one that contains it, then any match by its other texts;
 * in list order within each. `undefined` when nothing matches.
 * @example bestMatch('io', [{ name: 'Mercurio' }, { name: 'Ío' }]) // { name: 'Ío' }
 */
export function bestMatch<T extends { name: string }>(
  query: string,
  entries: readonly T[],
): T | undefined {
  const wanted = searchForm(query.trim());
  const rank = (entry: T) => {
    const name = searchForm(entry.name);
    if (name === wanted) return 3;
    if (name.startsWith(wanted)) return 2;
    return matches(query, [entry.name]) ? 1 : 0;
  };
  let best: T | undefined;
  for (const entry of entries) if (!best || rank(entry) > rank(best)) best = entry;
  return best;
}
