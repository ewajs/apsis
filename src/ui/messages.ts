/**
 * Text the app needs outside a component: the 3D view's (the scene can't localize
 * itself, ADR 0001) and its states. Call after the locale is set.
 */
import { msg } from '@lit/localize';
import type { View } from './view-switch.ts';

/** What the 3D canvas shows, for screen readers. */
export const sceneLabel = () =>
  msg('El Sol y los planetas en 3D. Arrastrá para girar, pellizcá o usá la rueda para acercarte.', {
    id: 'scene-label',
  });

/** While three.js starts. */
export const sceneLoading = () => msg('Preparando la vista 3D…', { id: 'scene-loading' });

/** When the 3D view can't start on this device. */
export const sceneFailed = () =>
  msg('Este dispositivo no pudo mostrar la vista 3D. Seguí con el mapa en 2D.', {
    id: 'scene-failed',
  });

/** What the scale tool has just switched to, said briefly. */
export function scaleNote(view: View, trueScale: boolean): string {
  if (view === 'map') {
    return trueScale
      ? msg('Distancias reales', { id: 'map-scale-linear-note' })
      : msg('Distancias en escala logarítmica', { id: 'map-scale-log-note' });
  }
  return trueScale
    ? msg('Tamaños reales: casi todo es espacio vacío', { id: 'scene-scale-true-note' })
    : msg('Planetas agrandados para que se vean', { id: 'scene-scale-enlarged-note' });
}

/** "Close", for buttons the shell draws outside its components (the AR overlay). */
export const closeLabel = (): string => msg('Cerrar', { id: 'close' });
