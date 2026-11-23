/** English translations of every `msg()` id; tests/i18n.test.ts keeps them complete. */
import { str } from '@lit/localize';

export const templates = {
  language: 'Language',
  tagline: 'Where are they now?',
  'credit-horizons': 'Positions: JPL Horizons, NASA/JPL-Caltech.',
  'data-date': str`Data as of ${0}`,
  sun: 'Sun',
  'planet-mercury': 'Mercury',
  'planet-venus': 'Venus',
  'planet-earth': 'Earth',
  'planet-mars': 'Mars',
  'planet-jupiter': 'Jupiter',
  'planet-saturn': 'Saturn',
  'planet-uranus': 'Uranus',
  'planet-neptune': 'Neptune',
  'unit-au': 'AU',
  'map-loading': 'Loading positions…',
  'map-failed': 'We couldn’t load the positions. Try again in a while.',
  'map-label': 'The solar system seen from above, with the spacecraft and their paths.',
  'map-scale-log-note': 'Distances on a logarithmic scale',
  'map-scale-linear-note': 'True distances',
  'map-missing': 'No data for this date:',
  'map-scale-to-linear': 'Show true distances',
  'map-scale-to-log': 'Show log scale',
};
