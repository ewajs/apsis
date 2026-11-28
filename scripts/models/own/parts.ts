/**
 * Parts for the spacecraft we model ourselves (ADR 0013): a bus in insulation blanket,
 * solar wings of real cells, dishes, booms and engines, with materials that read as the
 * real thing under one hard light (the Sun). Metres; +Z is the high-gain antenna's
 * boresight, +Y the solar arrays' axis.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Materials shared by every part, so a model has few. */
export const materials = {
  /** Gold insulation blanket (aluminised Kapton). */
  gold: new THREE.MeshStandardMaterial({
    name: 'blanket-gold',
    color: 0xc9973c,
    metalness: 1,
    roughness: 0.38,
  }),
  /** Silver insulation blanket. */
  silver: new THREE.MeshStandardMaterial({
    name: 'blanket-silver',
    color: 0xc7c9cc,
    metalness: 1,
    roughness: 0.32,
  }),
  /** Black blanket and radiators' dark faces. */
  black: new THREE.MeshStandardMaterial({ name: 'black', color: 0x16171a, roughness: 0.55 }),
  /** White paint: dishes, radiators. */
  white: new THREE.MeshStandardMaterial({ name: 'white', color: 0xe9e8e3, roughness: 0.5 }),
  /** Bare aluminium: struts, frames, booms. */
  aluminium: new THREE.MeshStandardMaterial({
    name: 'aluminium',
    color: 0xa7abb0,
    metalness: 0.9,
    roughness: 0.35,
  }),
  /** Solar cells: deep blue glass over silicon. */
  cells: new THREE.MeshStandardMaterial({
    name: 'solar-cells',
    color: 0x14234a,
    metalness: 0.55,
    roughness: 0.22,
  }),
  /** The back of a solar panel. */
  panelBack: new THREE.MeshStandardMaterial({
    name: 'panel-back',
    color: 0x3b3d40,
    roughness: 0.6,
  }),
  /** Engine bells: dark, heat-tinted metal. */
  engine: new THREE.MeshStandardMaterial({
    name: 'engine',
    color: 0x5a524a,
    metalness: 0.85,
    roughness: 0.45,
  }),
} as const;

/** A box, centred. */
export function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
}

/**
 * A solar wing along +Y: `panels` panels of `width` × `panelLength`, each a backing
 * with its cells set in rows, starting `gap` from the origin (the hinge).
 */
export function solarWing(options: {
  width: number;
  panelLength: number;
  panels: number;
  gap?: number;
  cellsAcross?: number;
}): THREE.Group {
  const { width, panelLength, panels, gap = 0.3, cellsAcross = 6 } = options;
  const wing = new THREE.Group();
  wing.name = 'solar-wing';
  const thickness = 0.04;
  const cell = width / cellsAcross;
  const rows = Math.max(1, Math.round(panelLength / cell));
  const inset = cell * 0.06;
  for (let p = 0; p < panels; p++) {
    const y0 = gap + p * (panelLength + 0.05);
    const backing = box(width, panelLength, thickness, materials.panelBack);
    backing.position.set(0, y0 + panelLength / 2, 0);
    wing.add(backing);
    // The cells as one merged mesh: a tile per cell, with thin gaps between.
    const tiles: THREE.BufferGeometry[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cellsAcross; c++) {
        const tile = new THREE.BoxGeometry(cell - inset, panelLength / rows - inset, 0.01);
        tile.translate(
          -width / 2 + cell * (c + 0.5),
          y0 + (panelLength / rows) * (r + 0.5),
          thickness / 2 + 0.005,
        );
        tiles.push(tile);
      }
    }
    wing.add(new THREE.Mesh(mergeGeometries(tiles)!, materials.cells));
  }
  // The yoke from the body to the first panel.
  const yoke = box(0.06, gap, 0.06, materials.aluminium);
  yoke.position.y = gap / 2;
  wing.add(yoke);
  return wing;
}

/** A parabolic dish facing +Z, `diameter` across and `depth` deep, with its feed. */
export function dish(diameter: number, depth = diameter * 0.18): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dish';
  const r = diameter / 2;
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = (r * i) / 24;
    profile.push(new THREE.Vector2(x, (depth * x * x) / (r * r)));
  }
  const shell = new THREE.LatheGeometry(profile, 64);
  // Lathe turns about Y; the dish faces +Z.
  shell.rotateX(Math.PI / 2);
  const material = materials.white.clone();
  material.name = 'dish';
  material.side = THREE.DoubleSide;
  group.add(new THREE.Mesh(shell, material));
  // The feed on three struts, near the focus.
  const focus = (r * r) / (4 * depth);
  const feed = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.08, r * 0.1, r * 0.15, 16),
    materials.white,
  );
  feed.rotation.x = Math.PI / 2;
  feed.position.z = focus;
  group.add(feed);
  for (let k = 0; k < 3; k++) {
    const angle = (k * 2 * Math.PI) / 3;
    const start = new THREE.Vector3(
      Math.cos(angle) * r * 0.9,
      Math.sin(angle) * r * 0.9,
      depth * 0.8,
    );
    group.add(strut(start, new THREE.Vector3(0, 0, focus), r * 0.012));
  }
  return group;
}

/** A thin rod between two points. */
export function strut(from: THREE.Vector3, to: THREE.Vector3, radius: number): THREE.Mesh {
  const length = from.distanceTo(to);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
  const mesh = new THREE.Mesh(geometry, materials.aluminium);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return mesh;
}

/** An engine bell opening towards −Z. */
export function engine(exitDiameter: number, length: number): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(
    exitDiameter * 0.3,
    exitDiameter / 2,
    length,
    32,
    1,
    true,
  );
  geometry.rotateX(-Math.PI / 2);
  const material = materials.engine.clone();
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geometry, material);
}
