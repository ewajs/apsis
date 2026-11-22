# 0005. Scale

- Status: Accepted; implementation in M2.
- Date: 2026-11-22

## Decision

- **Everything is true scale.** Distances and body radii are real kilometres.
- **A minimum size on screen.** Each body is drawn at its true size or at a minimum
  on-screen size (a named constant, starting around 6 px), whichever is larger. As
  the camera approaches, the true size takes over smoothly.
- **A "true scale" setting** removes the minimum, so you see how empty space is.
- **Spacecraft are markers** (a glowing sprite and a label) at any distance until
  models exist (M6), and models only appear in local views.
- **No view shows everything.** The default camera frames the selected spacecraft's
  neighbourhood: the inner planets for Psyche, the outer system for New Horizons. The
  2D map is the view of everything, with an optional logarithmic distance scale.
- Labels declutter: when they overlap, the less relevant one hides.

## Reasons and alternatives

- **Not log-scaled sizes.** Inflating planets breaks local views: a big Mercury
  swallows BepiColombo's orbit, a big Jupiter swallows its moons. The minimum
  on-screen size gives visibility from afar and correctness close up, which is how
  NASA's Eyes on the Solar System handles it.
- **Not log-scaled distances in 3D.** Positions would stop matching trajectories and
  speeds. A log scale is honest only in the 2D map, where it is a labelled option.
