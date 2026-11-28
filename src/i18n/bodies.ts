/** The names of the Sun and the planets in the current language. */
import { msg } from '@lit/localize';

/**
 * The Sun's or a planet's name, in the language showing now; any other id comes back
 * as it is (spacecraft names come from the catalogue and aren't translated).
 */
export function bodyName(id: string): string {
  const names: Record<string, () => string> = {
    sun: () => msg('Sol', { id: 'sun' }),
    mercury: () => msg('Mercurio', { id: 'planet-mercury' }),
    venus: () => msg('Venus', { id: 'planet-venus' }),
    earth: () => msg('Tierra', { id: 'planet-earth' }),
    mars: () => msg('Marte', { id: 'planet-mars' }),
    jupiter: () => msg('Júpiter', { id: 'planet-jupiter' }),
    saturn: () => msg('Saturno', { id: 'planet-saturn' }),
    uranus: () => msg('Urano', { id: 'planet-uranus' }),
    neptune: () => msg('Neptuno', { id: 'planet-neptune' }),
    moon: () => msg('Luna', { id: 'moon-moon' }),
    io: () => msg('Ío', { id: 'moon-io' }),
    europa: () => msg('Europa', { id: 'moon-europa' }),
    ganymede: () => msg('Ganimedes', { id: 'moon-ganymede' }),
    callisto: () => msg('Calisto', { id: 'moon-callisto' }),
    enceladus: () => msg('Encélado', { id: 'moon-enceladus' }),
    titan: () => msg('Titán', { id: 'moon-titan' }),
    phobos: () => msg('Fobos', { id: 'moon-phobos' }),
    deimos: () => msg('Deimos', { id: 'moon-deimos' }),
    triton: () => msg('Tritón', { id: 'moon-triton' }),
    charon: () => msg('Caronte', { id: 'moon-charon' }),
    pluto: () => msg('Plutón', { id: 'small-pluto' }),
    ceres: () => msg('Ceres', { id: 'small-ceres' }),
    vesta: () => msg('Vesta', { id: 'small-vesta' }),
    'psyche-asteroid': () => msg('Psyche (asteroide)', { id: 'small-psyche' }),
    didymos: () => msg('Dídimo', { id: 'small-didymos' }),
    'comet-67p': () => msg('67P/Churiumov-Guerasimenko', { id: 'small-67p' }),
    arrokoth: () => msg('Arrokoth', { id: 'small-arrokoth' }),
  };
  return names[id]?.() ?? id;
}

/** What a small body is, in the language showing now: a dwarf planet, an asteroid… */
export function bodyType(id: string): string {
  const types: Record<string, () => string> = {
    pluto: () => msg('Planeta enano', { id: 'type-dwarf-planet' }),
    ceres: () => msg('Planeta enano', { id: 'type-dwarf-planet' }),
    vesta: () => msg('Asteroide', { id: 'type-asteroid' }),
    'psyche-asteroid': () => msg('Asteroide metálico', { id: 'type-metal-asteroid' }),
    didymos: () => msg('Asteroide cercano a la Tierra', { id: 'type-near-earth-asteroid' }),
    'comet-67p': () => msg('Cometa', { id: 'type-comet' }),
    arrokoth: () => msg('Objeto del cinturón de Kuiper', { id: 'type-kuiper-belt' }),
  };
  return types[id]?.() ?? '';
}
