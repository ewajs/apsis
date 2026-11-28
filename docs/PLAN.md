# Plan

One step is one reviewable PR. `[ ]` planned, `[~]` in progress, `[x]` done. Details
are settled when a step starts. Each milestone ends with a `0.N.0` release.

**From M5 on the work runs unsupervised** (the owner, 2026-11-28): the agent merges its
own PRs once CI is green and the full local browser matrix passes, releases each
milestone (tag, GitHub Release, live check) and posts a summary at each release: what
shipped, the calls it made alone, and what needs a human (a real phone, taste). Open
questions get an ADR marked _Proposed_ with an easily reversed default. Wherever an
orbit is computed rather than taken from a source, or a model is our own, the app says
so.

## M0 — Foundation

- [x] **0.1 Charter and decisions.** README, AGENTS/CLAUDE, CONTRIBUTING,
      ARCHITECTURE, ADRs 0001–0009, this plan. **Verify:** links resolve, docs agree
      with each other, planned behavior labeled as planned.
- [x] **0.2 Scaffold and delivery.** Node 24, Vite, TS strict, ESLint (with folder
      boundaries), Prettier, Vitest, `npm run check`, PR CI, Pages deploy of a
      placeholder page under `/apsis/`. **Verify:** clean install, check and build; a
      deliberately wrong import fails lint; the placeholder is live. Live at https://ewajs.github.io/apsis/ on 2026-11-22; the first deploy
      needed one re-run (the deploy action asked for the artifact before GitHub listed it).
- [x] **0.3 Bilingual shell and PWA.** Lit app shell, design tokens, `@lit/localize`
      with es-AR and English, language switch, manifest, icon, service worker.
      **Verify:** switch without reload; installs and opens offline on a phone. Live
      2026-11-22: shell, manifest, service worker and an offline reload checked in a
      headless phone browser; install on a real phone still to try.

## M1 — Data you can trust (v0.1.0)

- [x] **1.1 Horizons client and parser.** Pure parser in `core` tested against
      recorded responses; `npm run data` fetches the planets and five spacecraft for
      the live window and writes chunks. **Verify:** chunks validate; a Horizons error
      fails the run with a clear message.
- [x] **1.2 Catalogue.** YAML schema and validation, five bilingual entries, and a
      verification table in `docs/guides/data.md` for every candidate below: Horizons
      ID, coverage, status, source. **Verify:** a broken entry fails validation.
- [x] **1.3 Time and interpolation.** UTC → TDB, cubic Hermite, chunk lookup, "no data
      for this date". **Verify:** against Horizons samples between the daily ones,
      within a stated tolerance; a guide explains Hermite with a diagram.
- [x] **1.4 The 2D map.** SVG top-down view of the ecliptic: Sun, planets, spacecraft
      and their trails, at the current instant, with optional log distance. Also brought
      forward from 1.6: the data date in the footer.
      **Verify:** positions match Horizons for a chosen date; readable at 375×667.
- [x] **1.5 Planet orbits.** Osculating elements from Horizons, committed; ellipses
      drawn on the map. **Verify:** each planet's current position sits on its ellipse.
- [x] **1.6 Weekly refresh.** Scheduled build (weekly, not daily, agreed 2026-11-23), and
      the recovery if GitHub's 60-day rule ever switches it off (ADR 0008). **Verify:** a scheduled run deploys
      fresh data.

Spacecraft checked in 1.2 (the first five shipped in M1; the catalogue grows from 4.3 on,
representative kinds of journey first): BepiColombo,
Hera, JUICE, Europa Clipper, Psyche, Juno, Lucy, Parker Solar Probe, Solar Orbiter,
New Horizons, Voyager 1, Voyager 2, MMX, Tianwen-2. Each needs a Horizons ephemeris;
those without one get `horizons: null` (ADR 0009).

## M2 — The 3D scene (v0.2.0)

- [x] **2.1 Scene.** `WebGPURenderer` with WebGL fallback, floating origin, log depth,
      camera controls, Sun and textured planets (true size with minimum on-screen size),
      orbit lines that pass through their planets, 2D/3D switch, the 3D code loaded only
      on demand, WebKit (iPhone) and WebGPU browser tests. **Verify:** no jitter zoomed in
      near Neptune (unit-tested, and Neptune found up close on every backend); runs on a
      mid-range phone: still to try on a real device.
- [x] **2.2 Spacecraft.** Markers, labels with decluttering (HTML, sharing `placeLabels`
      with the map), trails. **Verify:** positions match the 2D map (both use the same
      interpolation and `trailPoints`); labels in both languages, apart, on every backend.
- [x] **2.3a Planets that turn.** Axial tilt and spin from the IAU rotation models, and
      Saturn's rings in its equatorial plane. **Verify:** the Sun overhead near longitude
      180° at Greenwich midnight, at the solstice latitude; textures never mirrored.
- [x] **2.3b The look.** Star and Milky Way background, the true-scale button in 3D.
      **Verify:** the owner reviews the look.

## M3 — Time (v0.3.0)

Goal (agreed 2026-11-23): every mission's whole history, from launch to its end or to
now, without daily updates (ADR 0003).

Shape: ADR 0011 (accepted 2026-11-23).

- [x] **3.1 The time controller.** One owner of the displayed instant and its rate in
      `main.ts`; `?t=` follows it. No UI yet beyond the address bar.
- [x] **3.2 The slider.** Play, pause, speed (real time, 1 day, 1 week, 1 month per
      second), direction, "now"; along the bottom, on phone and desktop. Within the live
      window only.
- [x] **3.3 The archive.** `npm run data:archive`, `data/archive/` committed, the live
      window from 1 January, `data/archive/` and `data/live/` paths, loading years on
      demand, cache-first for the archive. 2025 archived for every body to prove it; the
      full history from launch is 3.5.
- [x] **3.4 Encounters.** `encounter: true` milestones get hourly samples ±3 days.
- [x] **3.5 Cassini and the full history.** Cassini (1997–2017) and every catalogue
      mission archived from launch; planets from 1977.

## M4 — Pick one (v0.4.0)

The interface first (ADR 0012, direction A chosen 2026-11-23), then picking a mission.

- [x] **4.0a The new frame.** Typefaces, glass panels and their solid fallback, icons, the
      view under floating controls, the info panel instead of the footer, the tool column.
- [x] **4.0b The time dock.** Compact, one row on phones, a fixed-width date.
- [x] **4.0c Moving around the 2D map.** Zoom (wheel, pinch, buttons), pan, recentre.

- [x] **4.1 Picker and selection.** List, search, selection, camera flies to it.
- [x] **4.2 Mission card.** Distance from Earth, light-time, speed, next milestone,
      blurb, links.
- [x] **4.3 More kinds of journey.** JWST (parked at L2, Earth's neighbourhood),
      BepiColombo (Mercury), New Horizons (the Kuiper belt). The catalogue then grows one
      entry at a time, by PR: representative first, everything eventually.
- [x] **4.4 More ended missions.** Rosetta (a comet), Galileo, Dawn (moved from M3's 3.6
      at the v0.3.0 release; the archive they need is in place).

## M5 — Spacecraft models (v0.5.0)

The owner's priority: models and AR first, and they should look stunning (up to about
5 MB each; data is where we save, not models).

- [x] **5.1 Model survey.** For each mission: the best free model, its exact licence and
      credit (NASA 3D Resources are mostly public domain; ESA's terms vary), or "build
      our own" with reference dimensions. Recorded in ADR 0013 and the models guide.
- [x] **5.2 The model pipeline.** `npm run models`: fetch each source, convert to GLB,
      scale to metres, orient to a common frame, compress; committed outputs with a
      credits file. ADR 0013.
- [x] **5.3 Models in 3D.** Focus a spacecraft and zoom in: the marker hands over to the
      model once it's big enough on screen; lit by the Sun, its shadow side dark.
- [x] **5.4 Attitude.** A sensible default pose per spacecraft (Horizons has none):
      the high-gain antenna to Earth, or the arrays to the Sun, as each one flies.
- [x] **5.5 Our own models.** Where nothing free exists: a simplified model built in
      code (bus, arrays, dish, booms), labelled as ours on the card.
- [~] **5.6 Credits and caching.** Model credits in the info panel and the card;
  models load on demand and stay cached for offline once seen.

## M6 — AR (v0.6.0)

- [ ] **6.1 A spacecraft in your room.** Hand the model to the phone's AR viewer at real
      size: Scene Viewer on Android (GLB), Quick Look on iPhone (USDZ, made with
      three.js's exporter).
- [ ] **6.2 A tabletop solar system.** The scene at the shown instant as a snapshot,
      sizes enlarged and the scale stated, handed off the same way.
- [ ] **6.3 Live AR,** only if the snapshot falls short (WebXR on Android).

## M7 — Close-ups (v0.7.0)

- [ ] **7.1 Target-centred views.** A view centred on a planet or small body, with a
      smooth hand-over from the solar system.
- [ ] **7.2 Moons.** The Moon, Io, Europa, Ganymede, Callisto, Titan, Enceladus.
- [ ] **7.3 Small bodies.** Pluto, Ceres, Vesta, 67P, Arrokoth, Psyche, Didymos; real
      shapes where a free shape model exists.
- [ ] **7.4 Orbiters from daily elements.** Osculating elements once a day from
      Horizons, propagated in between (tiny data; disclosed as computed): Juno's
      perijoves, Cassini's Grand Finale, BepiColombo at Mercury, Dawn, Rosetta at 67P.
- [ ] **7.5 Mars orbiters** (time-boxed): MRO, MAVEN, Mars Express, TGO, Odyssey, and
      others Horizons has.
- [ ] **7.6 Earth orbit** (time-boxed): the ISS, Hubble and a few more, from CelesTrak
      orbital data fetched by CI (free, no key, once a day), propagated in `core` with an
      ellipse plus Earth's-bulge drift: approximate, and labelled so. The data run goes
      daily.

## M8 — Everyone (v0.8.0)

- [ ] **8.1 The catalogue to about 30 missions,** each fact-checked with sources:
      Voyager 2, Pioneer 10 and 11, Ulysses, MESSENGER, JUICE, Lucy, Hera, Solar Orbiter,
      Hayabusa2, OSIRIS-REx/APEX and more. Parallel research, one PR per few entries.
- [ ] **8.2 Coming up.** A list of upcoming events across missions (flybys, arrivals).
- [ ] **8.3 The January archive, automatic.** A scheduled job opens the archive PR.

## M9 — Hardening (v0.9.0)

- [ ] **9.1 Budgets in CI.** Bundle size; a frame-rate floor in software rendering.
- [ ] **9.2 Accessibility audit** in the browser tests (axe).
- [ ] **9.3 Link previews** per mission, generated at build.
- [ ] **9.4 Offline and failure states,** made solid.
- [ ] **9.5 About the data:** Horizons, computed orbits, model credits, in the app.

## M10 — Stories (v1.0.0)

- [ ] **10.1 Guided tours as data:** time, camera and captions, shareable links.
- [ ] **10.2 The first tours:** Voyager's Grand Tour, Cassini's 13 years, Rosetta's
      chase, New Horizons at Pluto.
- [ ] **10.3 1.0.**

## Later, not planned

SPICE for missions Horizons lacks; a link to fly a trajectory in gravitas.

## Releases

### v0.4.0 — Pick one (2026-11-24)

A new look, a map you can move around, and every mission one tap away.

- The view fills the screen and the controls float over it in glass panels (ADR 0012);
  the info panel holds the credits, the data date and the version.
- A compact time dock: one row on a phone, a date that keeps still, speed and direction
  in one menu.
- The 2D map zooms and pans: wheel, pinch, double tap, drag, the keyboard and the tool
  column's buttons.
- Search for any mission or planet, or tap it on the map or in 3D: the map rings it and
  brings it to the middle, the camera flies to it, and links keep it (`?focus=`). An
  ended mission takes you to when it flew.
- Its card: distance from the Sun and from Earth, how long a signal takes, speed, the
  last and next milestones, what it's for and where to read more.
- Six more missions, each from launch: New Horizons, BepiColombo (in orbit around
  Mercury since 21 November 2026), James Webb, Galileo, Rosetta and Dawn. Twelve in all.

### v0.3.0 — Time (2026-11-23)

Move through every mission's history, forwards and backwards.

- A time bar: play and pause, forwards or backwards, at real time or a day, a week or a
  month per second; "now"; and a slider from 1977 to two months ahead. Links keep the
  moment (`?t=`).
- Every planet since 1977 and every mission since launch, including Cassini
  (1997–2017), loaded a year at a time as you go, and kept offline once seen.
- Close passes (flybys, perihelia, arrivals) sampled hourly: Parker's perihelion now
  drawn within 2 km.

### v0.2.0 — The 3D scene (2026-11-23)

The solar system in three dimensions, one tap from the map.

- The Sun and the planets at true scale, drawn at least a few pixels across so you can
  find them, or at true size on request; textured, tilted and spinning as they really
  stand (IAU rotation models), Saturn with its rings.
- The five spacecraft with their last 30 days, every body named, names kept apart.
- Orbits that pass exactly through their planets, and a floating origin, so close-ups
  (`?focus=neptune`) are steady.
- The Milky Way behind it all, along the real galactic plane.
- WebGPU where the browser has it, WebGL 2 elsewhere; the 3D code loads only when you
  ask for it.

### v0.1.0 — Data you can trust (2026-11-23)

The first release: an installable, bilingual app showing where five deep-space
missions are right now, on a 2D map of the solar system.

- Positions for the planets and Juno, Europa Clipper, Psyche, Parker Solar Probe and
  Voyager 1 from JPL Horizons, refreshed weekly, interpolated to the current instant
  (cubic Hermite, measured against Horizons).
- A map from above the ecliptic, on a log or a true scale, with planet orbits,
  spacecraft trails and labels that avoid each other.
- A hand-written bilingual mission catalogue, validated on every build.
- Spanish (Argentina) and English; installs to the home screen and opens offline.
