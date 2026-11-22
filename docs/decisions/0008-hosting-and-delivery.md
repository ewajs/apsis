# 0008. Hosting and delivery

- Status: Accepted; Pages in step 0.2, the daily refresh in step 1.6.
- Date: 2026-11-22

## Decision

- **GitHub Pages**, public repository, served at `https://ewajs.github.io/apsis/`
  (Vite `base: '/apsis/'`).
- **One workflow builds once and deploys that artifact** with the official Pages
  actions. Only the deploy job gets Pages write permissions; pull requests never
  deploy.
- **Triggers:** push to `main`, a daily schedule (fetches fresh live data), and
  manual runs on `main`.
- **CI runs fast checks only** (format, lint, types, unit tests, build). Browser
  tests run locally, as in gravitas.
- **A failed fetch fails the build**, and the previous deployment stays live. With 60
  days of data either side, the site stays correct for about two months without a
  refresh, and the page shows the data date.

## The 60-day trap

GitHub disables scheduled workflows in a public repository "when no repository
activity has occurred in 60 days"
([docs](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow)).
A quiet month or two and the data silently stops updating. Step 1.6 picks the
mitigation after checking what currently counts as activity. Options: a monthly
step that re-enables the workflow through the API, or one that opens an issue when
the data is older than a threshold. Not a daily data commit (see ADR 0003).

## Reasons and alternatives

- Pages is free, has no servers to keep, and fits a static site. Cloudflare (which
  Grama uses) would work just as well. Pages keeps code, CI and hosting in one place.
- No backend: nothing needs one. Revisit for accounts or notifications.
