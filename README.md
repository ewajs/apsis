# Apsis

Where are they now? Apsis is an open-source web app that shows deep-space missions
in a 3D solar system: pick a spacecraft and see where it is today, where it has been
and where it is going, with a short card about the mission. Planets and spacecraft
positions come from NASA JPL's [Horizons](https://ssd.jpl.nasa.gov/horizons/) system.

It aims to be fun and informative, not engineering-grade. It is a static,
installable web app (PWA) in Spanish (Argentina) and English, hosted on GitHub Pages.

An _apsis_ is one of the two extreme points of an orbit: the closest and the
farthest from the body it goes around.

**Status:** v0.7.1. Where 21 missions are and have been, from 1977 to two months
ahead, on a 2D map or in a 3D solar system; search for one or tap it, read its card, dive
to the spacecraft itself, and on a phone see it in your room, or the whole solar system
on your table, in AR. Close up: orbiters on their orbits around Jupiter, Saturn, Mercury
and Mars, the moons they visit, dwarf planets, asteroids and a comet, and the ISS, Hubble
and Tiangong around Earth. Next: about 30 missions and what's coming up. [The plan](docs/PLAN.md) lists the milestones, and
[the decisions](docs/decisions/README.md) explain the design.
[Open it](https://ewajs.github.io/apsis/).

## Development

Node 24 ([`.nvmrc`](.nvmrc)), then:

```sh
nvm use
npm ci
npm run dev     # http://localhost:5173/apsis/
npm run check   # what every PR must pass
```

[CONTRIBUTING.md](CONTRIBUTING.md) lists every command.

## Documentation

- [PLAN.md](docs/PLAN.md): milestones and the PRs that make them up.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit together.
- [Decisions](docs/decisions/README.md): why things are the way they are.
- [CONTRIBUTING.md](CONTRIBUTING.md): how we work.

## Credits

- Ephemerides: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), NASA/JPL-Caltech
  Solar System Dynamics group.
- Planet textures: [Solar System Scope](https://www.solarsystemscope.com/textures/),
  licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), based on
  NASA elevation and imagery data.

## License

Code is [MIT](LICENSE). Third-party assets keep their own licenses, listed above
and in `public/textures/CREDITS.md` once they are added.
