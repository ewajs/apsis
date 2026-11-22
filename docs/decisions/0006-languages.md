# 0006. Languages

- Status: Accepted; implementation in step 0.3.
- Date: 2026-11-22

## Decision

- Spanish (Argentina, voseo) and English from the first screen.
- UI text goes through `@lit/localize` in runtime mode: the language switches
  without a reload. Spanish is the source locale; English is the translation, kept
  complete (a missing translation fails the check).
- Catalogue text is bilingual in the YAML itself (`{ es, en }` fields, ADR 0009).
- The first visit follows the browser's language (Spanish for any `es-*`, English
  otherwise); a choice in settings is remembered.
- Numbers and dates use `Intl` with the active locale (`1.234,5 km` vs `1,234.5 km`).

## Reasons and alternatives

- Adding a second language after the fact means hunting down every hard-coded
  string; with Lit it is cheap to start with two. gravitas does the same.
- The owner asked for both from day one. English alone would be simpler for one
  milestone and costlier forever after.
