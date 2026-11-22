# 0002. Data source and pipeline

- Status: Accepted; implementation in M1.
- Date: 2026-11-22

## Decision

All positions, planets and spacecraft alike, come from the
[JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
(`https://ssd.jpl.nasa.gov/api/horizons.api`), fetched at build time, never by
the browser.

- `scripts/data/` (TypeScript, run by Node) reads the catalogue, requests state
  vectors (`EPHEM_TYPE=VECTORS`, `VEC_TABLE=2`: position and velocity) for each body
  in one frame ([ADR 0004](0004-frames-units-and-time.md)), and writes chunks
  ([ADR 0003](0003-ephemeris-chunks-and-interpolation.md)) into the build output.
- Requests go one at a time, with a descriptive generic User-Agent, retries with
  backoff on 500/503, and a check of the response's API version.
- Horizons reports its own errors with HTTP 200 and text in the result, so every
  response is parsed and validated; a body whose data is missing or malformed fails
  the build. The previous deployment then stays live.
- The parser (text between `$$SOE` and `$$EOE` into typed samples) is a pure function
  in `src/core`, tested against recorded responses.

## Reasons and alternatives

- **Same source for planets and spacecraft.** A flyby looks right only if Earth is
  drawn exactly where the spacecraft's trajectory expects it. Mixing an analytic
  planet model (JPL's approximate elements) with Horizons spacecraft data would put
  them thousands of kilometres apart in close-ups.
- **Build time, not browser.** The Horizons documentation mentions no CORS support or
  rate limits, and depending on a third-party API from every visit would be fragile
  and impolite. Precomputed static files are fast and work offline.
- **SPICE** (NAIF kernels, via spiceypy or the ESA SPICE service) is more precise and
  covers some missions Horizons lacks, but needs kernel management and Python.
  Revisit if a catalogue mission we care about exists only in SPICE.
