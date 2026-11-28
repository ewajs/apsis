# Decisions

One file per significant decision: what we chose, why, what we discarded and when
to revisit it. A decision that changes is amended in place with its date and reason,
not silently contradicted by code.

| ADR                                                | Decision                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| [0001](0001-stack-and-structure.md)                | TypeScript, Vite, three.js, Lit; one package with folder boundaries   |
| [0002](0002-data-source-and-pipeline.md)           | JPL Horizons, fetched at build time by a TypeScript script            |
| [0003](0003-ephemeris-chunks-and-interpolation.md) | Yearly chunks with explicit sample times; cubic Hermite interpolation |
| [0004](0004-frames-units-and-time.md)              | Heliocentric ecliptic J2000, km and km/s, TDB; floating origin        |
| [0005](0005-scale.md)                              | True scale with a minimum on-screen size                              |
| [0006](0006-languages.md)                          | Spanish (es-AR) and English from day one                              |
| [0007](0007-pwa.md)                                | Installable PWA; data cached apart from the app                       |
| [0008](0008-hosting-and-delivery.md)               | GitHub Pages, deployed on push and daily on a schedule                |
| [0009](0009-catalogue.md)                          | Hand-written bilingual YAML catalogue                                 |
| [0011](0011-history-and-time.md)                   | Every mission's history in yearly files, and the time slider          |
| [0010](0010-planet-orbits.md)                      | Planet orbits from osculating elements, fetched once and committed    |
| [0012](0012-glass-look.md)                         | The Glass look: the view fills the screen, controls float             |
| [0013](0013-spacecraft-models.md)                  | Spacecraft models: NASA's or ours, one body frame, Meshopt            |
| [0014](0014-ar.md)                                 | AR: the phone's own viewers, an AR copy of each model                 |
