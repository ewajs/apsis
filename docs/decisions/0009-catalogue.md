# 0009. The catalogue

- Status: Accepted; implemented in step 1.2. Amended 2026-11-22: a dated `milestones`
  list instead of one `nextMilestone`, and `coverage` written by hand.
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
  coverage: { from: 2011-08-06, to: 2028-09-01 } # from Horizons (docs/guides/data.md)
  milestones: # in date order; a day, a month or a year
    - {
        date: 2016-07-05,
        encounter: true,
        es: Entra en órbita de Júpiter,
        en: Enters orbit around Jupiter,
      }
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

- **`encounter: true`** on a milestone (a flyby, a perihelion, an arrival; it needs an
  exact day) gets hourly samples for 3 days either side (ADR 0011, step 3.4).
- **A list of milestones, not a next one.** With the time slider (M3), "next" depends
  on the displayed instant, not on today; a dated list serves both, and keeps history
  (Voyager 1's Saturn flyby) for the card. Dates can be as loose as the facts are:
  "arrives in 2029" is `'2029'`.
- **Coverage by hand, checked by the fetch.** Horizons has no simple coverage query;
  the guide's two-request trick finds it once, and the fetch clips to it. A wrong
  coverage shows up as a Horizons refusal and fails the run, so it can't go stale
  silently.

- **YAML** reads well for long bilingual blurbs and is friendly to contributors who
  don't write code. A TypeScript file would be type-checked for free but intimidating
  to outside contributors; validation in the script closes that gap.
- **Bilingual fields inline**, not separate translation files: an entry and its
  translation are reviewed together, and a missing language fails validation.
