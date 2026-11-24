# Plan

One step is one reviewable PR. `[ ]` planned, `[~]` in progress, `[x]` done. Details
are settled when a step starts; the owner reviews each step before the next begins
unless they say to keep going. Each milestone ends with a `0.N.0` release.

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
- [ ] **3.6 More ended missions.** Rosetta (a comet), Galileo, Dawn.

## M4 — Pick one (v0.4.0)

- [ ] **4.1 Picker and selection.** List, search, selection, camera flies to it.
- [ ] **4.2 Mission card.** Distance from Earth, light-time, speed, next milestone,
      blurb, links.
- [ ] **4.3 More kinds of journey.** JWST (parked at L2, Earth's neighbourhood),
      BepiColombo (Mercury), New Horizons (the Kuiper belt). The catalogue then grows one
      entry at a time, by PR: representative first, everything eventually.

## M5 — Local views (v0.5.0)

- [ ] **5.1 Target-centred views.** Frames centred on a planet or asteroid, finer-step
      local data for orbiters (target-centred, minutes apart: heliocentric samples 3 h
      apart still miss Juno's perijove by 29,000 km).
- [ ] **5.2 First targets.** BepiColombo at Mercury, Juno at Jupiter, Hera at Didymos,
      Cassini at Saturn, and the ISS around Earth (it laps Earth every 92 minutes, so it
      only makes sense here, with Earth-centred data minutes apart).

## M6 — Spacecraft models (v0.6.0)

- [ ] **6.1 Model survey.** For each mission: an available model, its source and
      license (NASA 3D Resources, ESA, others), or "make our own".
- [ ] **6.2 Models in local views.** GLB loading, scale, orientation (attitude is not
      in Horizons; a sensible default pose).

## M7 — AR (v0.7.0)

- [ ] **7.1 Spacecraft in your room.** Hand off each model to the phone's own AR
      viewer: Scene Viewer on Android (GLB), Quick Look on iPhone (USDZ). Static
      models at real size, no live data.
- [ ] **7.2 Tabletop solar system.** Export the scene at the displayed instant as a
      GLB/USDZ snapshot and hand it off the same way. Live AR (WebXR) only if the
      snapshot falls short.

## Later, not planned

SPICE for missions Horizons lacks; major moons; Earth-centred view for near-Earth
missions; a link to fly a trajectory in gravitas.

## Releases

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
