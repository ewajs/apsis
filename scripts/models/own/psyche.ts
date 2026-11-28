/**
 * Psyche, simplified: a box-shaped bus in silver blanket, two X-shaped wings of five
 * panels each (about 25 m tip to tip), the 2 m high-gain dish on top, and the Hall
 * thruster's dark ring below.
 */
import * as THREE from 'three';
import { box, dish, materials, solarWing } from './parts.ts';

/** Builds the model, in metres, in the body frame. */
export function build(): THREE.Object3D {
  const craft = new THREE.Group();
  craft.name = 'psyche';
  const bus = box(2.4, 2.4, 2.2, materials.silver);
  craft.add(bus);
  for (const side of [1, -1]) {
    const wing = solarWing({ width: 2.2, panelLength: 2, panels: 5, gap: 0.4 });
    wing.position.y = side * 1.2;
    wing.rotation.z = side === 1 ? 0 : Math.PI;
    craft.add(wing);
  }
  const antenna = dish(2);
  antenna.position.z = 1.15;
  craft.add(antenna);
  const thruster = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 12, 32), materials.black);
  thruster.position.z = -1.15;
  craft.add(thruster);
  return craft;
}
