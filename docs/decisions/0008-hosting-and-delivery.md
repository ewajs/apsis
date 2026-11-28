# 0008. Hosting and delivery

- Status: Accepted; Pages in step 0.2, the scheduled refresh in step 1.6. Amended
  2026-11-23: weekly instead of daily. Amended 2026-11-28: daily again, for the
  satellites' data (ADR 0016).
- Date: 2026-11-22

## Decision

- **GitHub Pages**, public repository, served at `https://ewajs.github.io/apsis/`
  (Vite `base: '/apsis/'`).
- **One workflow builds once and deploys that artifact** with the official Pages
  actions. Only the deploy job gets Pages write permissions; pull requests never
  deploy.
- **Triggers:** push to `main`, a **daily** schedule (06:17 UTC; fetches fresh live
  data), and manual runs on `main`. Weekly was enough for the 60-day window of
  Horizons data, but satellites around Earth (ADR 0016) show only within three days of
  their CelesTrak data: a daily run keeps them current, with two missed runs to spare.
- **CI runs fast checks only** (format, lint, types, unit tests, build). Browser
  tests run locally, as in gravitas.
- **A failed fetch fails the build**, and the previous deployment stays live. With 60
  days of data either side, the site stays correct for about two months without a
  refresh, and the page shows the data date.

## The 60-day trap

GitHub disables scheduled workflows in a public repository "when no repository
activity has occurred in 60 days"
([docs](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow)).
No automatic keepalive for now (the owner's call, 2026-11-23: keep it simple; the
repository is busy). If it happens, the site keeps working on its last data for up to
60 days, the footer shows its date, and the map says "no data" beyond the window.
Turn the schedule back on with `gh workflow enable CI` (or the Actions tab); the next
run refreshes everything. Revisit if it bites.

## Reasons and alternatives

- Pages is free, has no servers to keep, and fits a static site. Cloudflare (which
  Grama uses) would work just as well. Pages keeps code, CI and hosting in one place.
- No backend: nothing needs one. Revisit for accounts or notifications.
