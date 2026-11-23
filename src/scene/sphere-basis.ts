/**
 * How a planet's axes map onto a three.js sphere. `SphereGeometry` wraps an
 * equirectangular texture (longitude −180° at its left edge, 0° in the middle) so that
 * longitude 0 lies along the sphere's local +x, 90° east along −z, and the north pole
 * along +y (pinned by sphere-basis.test.ts). Pure.
 */
import { toScene } from '../core/frames.ts';
import { scale, type Vector3 } from '../core/math.ts';
import type { BodyAxes } from '../core/rotation.ts';

/**
 * The sphere's local x, y and z axes, in scene coordinates, for a body's axes: the
 * columns of the rotation that turns its texture to the right way round.
 */
export function sphereBasis({ pole, meridian, east }: BodyAxes): [Vector3, Vector3, Vector3] {
  return [toScene(meridian), toScene(pole), toScene(scale(east, -1))];
}
