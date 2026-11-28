/**
 * Parts for the spacecraft we model ourselves (ADR 0013): a bus in quilted insulation
 * blanket, solar panels of real cells (and mirrors), dishes, booms and engines, with
 * materials that read as the real thing under one hard light (the Sun). Metres; +Z is
 * the high-gain antenna's boresight, +Y the solar arrays' axis.
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
  /**
   * White high-temperature blanket (a ceramic-fabric outer layer), for spacecraft that
   * fly close to the Sun.
   */
  ceramic: new THREE.MeshStandardMaterial({
    name: 'blanket-ceramic',
    color: 0xd6d1c6,
    roughness: 0.85,
  }),
  /** Black blanket, seams and radiators' dark faces. */
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
  /** Optical solar reflectors: the mirror tiles that shed heat between the cells. */
  mirror: new THREE.MeshStandardMaterial({
    name: 'mirror',
    color: 0xdde1e6,
    metalness: 1,
    roughness: 0.08,
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
 * A bus wrapped in insulation blanket, centred: a dark core with the blanket laid over
 * each face in pillows about `pillow` across, each puffed up a little (some more than
 * others), so a hard light shades them softly, the way quilted blanket catches it, and
 * the seams between them show dark.
 */
export function blanketBox(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  pillow = 0.6,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bus';
  group.add(box(width, height, depth, materials.black));
  const size = [width, height, depth];
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const seam = 0.012;
  const pillows: THREE.BufferGeometry[] = [];
  // Deterministic, so the model builds the same every time.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Each pair of opposite faces: the axis they face along, and the two they span.
  for (const [n, u, v] of [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
  ] as const) {
    const across = Math.max(1, Math.round(size[u]! / pillow));
    const down = Math.max(1, Math.round(size[v]! / pillow));
    const w = size[u]! / across;
    const h = size[v]! / down;
    for (const sign of [1, -1]) {
      // A basis that puts a pillow's +Z on the face's outward normal, kept right-handed
      // so the triangles still face out.
      const normal = axes[n]!.clone().multiplyScalar(sign);
      const ex = axes[u]!.clone();
      if (ex.clone().cross(axes[v]!).dot(normal) < 0) ex.negate();
      const basis = new THREE.Matrix4().makeBasis(ex, axes[v]!, normal);
      for (let i = 0; i < across; i++) {
        for (let j = 0; j < down; j++) {
          const puff = Math.min(w, h) * (0.03 + 0.03 * random());
          const tile = new THREE.PlaneGeometry(w - seam, h - seam, 6, 6);
          const position = tile.getAttribute('position');
          for (let k = 0; k < position.count; k++) {
            const a = (2 * position.getX(k)) / w;
            const b = (2 * position.getY(k)) / h;
            position.setZ(k, puff * (1 - a * a) * (1 - b * b));
          }
          tile.computeVertexNormals();
          tile.applyMatrix4(basis);
          const centre = normal.clone().multiplyScalar(size[n]! / 2);
          centre.addScaledVector(axes[u]!, -size[u]! / 2 + w * (i + 0.5));
          centre.addScaledVector(axes[v]!, -size[v]! / 2 + h * (j + 0.5));
          tile.translate(centre.x, centre.y, centre.z);
          pillows.push(tile);
        }
      }
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(pillows)!, material));
  return group;
}

/**
 * One solar panel in the x–y plane, `width` across and `length` along +Y from the
 * origin, its cells facing +Z in rows of `cellsAcross`. With `reflectorEvery`, every
 * that-many-th column is a mirror instead of cells (panels that fly near the Sun); 1
 * makes a panel of mirrors.
 */
export function solarPanel(options: {
  width: number;
  length: number;
  cellsAcross?: number | undefined;
  reflectorEvery?: number | undefined;
}): THREE.Group {
  const { width, length, cellsAcross = 6, reflectorEvery } = options;
  const panel = new THREE.Group();
  panel.name = 'solar-panel';
  const thickness = 0.04;
  const cell = width / cellsAcross;
  const rows = Math.max(1, Math.round(length / cell));
  const inset = cell * 0.06;
  const backing = box(width, length, thickness, materials.panelBack);
  backing.position.y = length / 2;
  panel.add(backing);
  // The tiles as merged meshes, cells and mirrors, with thin gaps between.
  const cells: THREE.BufferGeometry[] = [];
  const mirrors: THREE.BufferGeometry[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cellsAcross; c++) {
      const tile = new THREE.BoxGeometry(cell - inset, length / rows - inset, 0.01);
      tile.translate(
        -width / 2 + cell * (c + 0.5),
        (length / rows) * (r + 0.5),
        thickness / 2 + 0.005,
      );
      const mirror = reflectorEvery !== undefined && c % reflectorEvery === reflectorEvery - 1;
      (mirror ? mirrors : cells).push(tile);
    }
  }
  if (cells.length) panel.add(new THREE.Mesh(mergeGeometries(cells)!, materials.cells));
  if (mirrors.length) panel.add(new THREE.Mesh(mergeGeometries(mirrors)!, materials.mirror));
  return panel;
}

/**
 * A solar wing along +Y: `panels` panels of `width` × `panelLength` in a row, starting
 * `gap` from the origin (the hinge), on its yoke.
 */
export function solarWing(options: {
  width: number;
  panelLength: number;
  panels: number;
  gap?: number;
  cellsAcross?: number;
  reflectorEvery?: number;
}): THREE.Group {
  const { width, panelLength, panels, gap = 0.3, cellsAcross, reflectorEvery } = options;
  const wing = new THREE.Group();
  wing.name = 'solar-wing';
  for (let p = 0; p < panels; p++) {
    const panel = solarPanel({ width, length: panelLength, cellsAcross, reflectorEvery });
    panel.position.y = gap + p * (panelLength + 0.05);
    wing.add(panel);
  }
  wing.add(yoke(gap, width * 0.6));
  return wing;
}

/**
 * The arm from the body to a wing's first panel, `length` along +Y: two rods that
 * splay out to `spread` apart at the panel, from the drive at the body.
 */
export function yoke(length: number, spread: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'yoke';
  const radius = Math.max(0.02, length * 0.008);
  for (const side of [1, -1]) {
    group.add(
      strut(
        new THREE.Vector3(0, 0, -0.03),
        new THREE.Vector3((side * spread) / 2, length, -0.03),
        radius,
      ),
    );
  }
  const drive = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 20), materials.black);
  drive.position.y = 0.08;
  group.add(drive);
  return group;
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
  // A rolled-back rim, so the dish has an edge that catches the light.
  profile.push(new THREE.Vector2(r * 1.03, depth), new THREE.Vector2(r * 1.03, depth * 0.9));
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

/** A thin rod between two points, in aluminium unless given another material. */
export function strut(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material = materials.aluminium,
): THREE.Mesh {
  const length = from.distanceTo(to);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return mesh;
}

/** A cylinder along +Z, `diameter` across and `length` long, its base at the origin. */
export function can(diameter: number, length: number, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 24);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, length / 2);
  return new THREE.Mesh(geometry, material);
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

/**
 * A Hall-effect thruster firing towards −Z, `diameter` across, its back at the origin:
 * a squat body, the ring-shaped channel the plasma leaves from around a central pole,
 * and the cathode beside it.
 */
export function hallThruster(diameter: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'hall-thruster';
  const r = diameter / 2;
  const depth = r * 0.7;
  const body = can(diameter, depth, materials.engine);
  body.position.z = -depth;
  group.add(body);
  const channel = new THREE.Mesh(new THREE.RingGeometry(r * 0.5, r * 0.82, 40), materials.black);
  channel.rotation.x = Math.PI;
  channel.position.z = -depth - 0.002;
  group.add(channel);
  const pole = can(r * 0.9, r * 0.12, materials.aluminium);
  pole.position.z = -depth - r * 0.1;
  group.add(pole);
  const cathode = can(r * 0.24, r * 0.9, materials.aluminium);
  cathode.position.set(r * 1.25, 0, -r * 1.1);
  group.add(cathode);
  return group;
}
