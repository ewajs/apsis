# 0009. The catalogue

- Status: Accepted; implementation in step 1.2.
- Date: 2026-11-22

## Decision

Missions are described by hand in `data/catalogue.yaml`, one entry per spacecraft,
added and corrected through pull requests:

```yaml
- id: juno # stable slug, used in URLs and file names
  name: Juno
  agency: NASA
  launch: 2011-08-05
  target: { es: Júpiter, en: Jupiter }
  status: active # active | ended
  horizons: '-61' # Horizons ID, or null with `noEphemeris` saying why
  coverage: { from: 2011-08-06, to: 2026-12-31 } # filled from Horizons, checked by the script
  nextMilestone: { date: …, es: …, en: … }
  blurb: { es: …, en: … }
  links: [https://…]
```

- The data script validates the catalogue (required fields, both languages present,
  dates in order, unique IDs) and writes it as JSON for the browser. The browser
  never parses YAML; the parser is a dev dependency only.
- **A mission without a public ephemeris** (`horizons: null`) stays in the catalogue
  with a `noEphemeris` reason. The UI lists it with a "no public trajectory" badge
  and draws it nowhere. We never place a spacecraft where we only guess it is.
- Statuses and milestones are verified against agency sources in the PR that changes
  them; the PR links the source.

## Reasons and alternatives

- **YAML** reads well for long bilingual blurbs and is friendly to contributors who
  don't write code. A TypeScript file would be type-checked for free but intimidating
  to outside contributors; validation in the script closes that gap.
- **Bilingual fields inline**, not separate translation files: an entry and its
  translation are reviewed together, and a missing language fails validation.
