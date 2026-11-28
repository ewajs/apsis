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
  };
  return names[id]?.() ?? id;
}
