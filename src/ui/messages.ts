/**
 * Text the app needs outside a component: the 3D view's (the scene can't localize
 * itself, ADR 0001) and its states. Call after the locale is set.
 */
import { msg, str } from '@lit/localize';
import { ROOM_LENGTH_M, roomScale, type ArSize } from '../core/ar.ts';
import type { ModelEntry } from '../core/models.ts';
import { currentLocale } from '../i18n/localization.ts';
import { formatMetres } from './format.ts';
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

/**
 * What each AR size will look like, for the card and the AR viewer's title: the room
 * size's scale ("1 m · escala 1:109"), the real size's dimensions ("109 × 73 m, 20 m de
 * alto"), so nobody is surprised by a 109 m station in the living room.
 */
export function arSizeNotes(model: ModelEntry): Record<ArSize, string> {
  const locale = currentLocale();
  const m = (metres: number) => formatMetres(metres, locale);
  const [across, up, deep] = model.dimensionsM;
  const room = m(ROOM_LENGTH_M);
  const scale = roomScale(model.lengthM);
  const [long, wide, tall] = [m(Math.max(across, deep)), m(Math.min(across, deep)), m(up)];
  return {
    room: msg(str`${room} m · escala 1:${scale}`, { id: 'ar-room-note' }),
    real: msg(str`${long} × ${wide} m, ${tall} m de alto`, { id: 'ar-real-note' }),
  };
}
