# 0005. Scale

- Status: Accepted; the minimum on-screen size implemented in 2.1 (7 px, 12 px for the
  Sun), spacecraft markers (6 px) and decluttered labels in 2.2; the true-scale switch
  in 2.3b (shared with the map's log/true switch; spacecraft keep their markers).
- Date: 2026-11-22

## Decision

- **Everything is true scale.** Distances and body radii are real kilometres.
- **A minimum size on screen.** Each body is drawn at its true size or at a minimum
  on-screen size (a named constant, starting around 6 px), whichever is larger. As
  the camera approaches, the true size takes over smoothly.
- **A "true scale" setting** removes the minimum, so you see how empty space is.
- **Spacecraft are markers** (a glowing sprite and a label) at any distance until
  models exist (M5). A model takes over from the marker once the camera is close enough
  for it to be bigger on screen than the marker (amended 2026-11-28: no separate local
  view is needed for that; the floating origin keeps metres precise).
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
