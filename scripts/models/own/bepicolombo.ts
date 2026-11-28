/**
 * BepiColombo as it flies in Mercury orbit before its two orbiters part (from November
 * 2026): the transfer module gone, ESA's Mercury Planetary Orbiter (MPO) carries JAXA's
 * Mio inside its sunshield, MOSIF.
 *
 * Sizes from ESA's factsheet (esa.int, "BepiColombo factsheet") and its MPO pages
 * (cosmos.esa.int/web/bepicolombo/mpo, sci.esa.int/web/bepicolombo/-/48872-spacecraft):
 * the MPO's body 3.9 × 2.2 × 1.7 m with its radiator 3.7 m wide on one side, always
 * away from the Sun; a single wing of three panels, 7.5 m deployed, a mix of cells and
 * mirrors (70–30) to keep it below 200 °C; a steerable 1 m high-gain dish, the
 * medium-gain antenna on its boom, the magnetometers on a 2.8 m boom; Mio 1.8 m across
 * and 1.1 m high. Largest dimension: the body's length plus the wing, 3.9 + 7.5 m.
 *
 * Here the radiator faces −X: the app keeps the Sun on the +X side (`defaultAttitude`),
 * so it stays in shade as the real one does, and MOSIF with Mio sits on the sunward +X
 * face.
 */
import * as THREE from 'three';
import {
  blanketBox,
  box,
  can,
  dish,
  engine,
  materials,
  solarPanel,
  solarWing,
  strut,
} from './parts.ts';

/** The MPO's body: thin along X (radiator to MOSIF), long along the wing's axis. */
const BUS = { x: 1.7, y: 3.9, z: 2.2 };
const WING = { width: 1.6, panelLength: 1.95, panels: 3, gap: 1.45 };
/** The wing's turn about its axis, off facing +Z: towards the Sun, but obliquely. */
const WING_TILT = (55 * Math.PI) / 180;
const MIO = { radius: 0.95, height: 1.1 };
/** MOSIF: a cone from the MPO's face that holds Mio's lower part. */
const MOSIF = { length: 1.1, baseRadius: 1.0, rimRadius: 1.22 };

/** Builds the model, in metres, in the body frame. */
export function build(): THREE.Object3D {
  const craft = new THREE.Group();
  craft.name = 'bepicolombo';
  craft.add(blanketBox(BUS.x, BUS.y, BUS.z, materials.ceramic));

  const wing = solarWing({ ...WING, cellsAcross: 9, reflectorEvery: 3 });
  wing.position.y = BUS.y / 2;
  wing.rotation.y = WING_TILT;
  craft.add(wing);

  craft.add(radiator());
  craft.add(sunshieldWithMio());

  // The high-gain dish on its two-axis mast, near the far end from the wing.
  const mast = new THREE.Vector3(0, -1.3, BUS.z / 2);
  craft.add(strut(mast, mast.clone().setZ(BUS.z / 2 + 0.7), 0.06));
  const gimbal = box(0.22, 0.22, 0.18, materials.black);
  gimbal.position.copy(mast).setZ(BUS.z / 2 + 0.72);
  craft.add(gimbal);
  const highGain = dish(1, 0.16);
  highGain.position.copy(mast).setZ(BUS.z / 2 + 0.8);
  craft.add(highGain);
  // The medium-gain antenna on its boom.
  const boomBase = new THREE.Vector3(0.3, 0.9, BUS.z / 2);
  const boomTip = new THREE.Vector3(0.3, 0.4, BUS.z / 2 + 1.1);
  craft.add(strut(boomBase, boomTip, 0.035));
  const mediumGain = dish(0.8, 0.07);
  mediumGain.position.copy(boomTip);
  craft.add(mediumGain);

  // The magnetometer boom, its sensors at the tip and 0.8 m in from it.
  const root = new THREE.Vector3(0, -1.55, -BUS.z / 2);
  craft.add(strut(root, root.clone().setZ(-BUS.z / 2 - 2.8), 0.03));
  for (const along of [2.8, 2]) {
    const sensor = box(0.12, 0.12, 0.12, materials.ceramic);
    sensor.position.copy(root).setZ(-BUS.z / 2 - along);
    craft.add(sensor);
  }
  // The underside: instruments' apertures and the four small thrusters at the corners.
  for (const [x, y, d] of [
    [-0.3, 0.2, 0.32],
    [0.35, 0.55, 0.22],
    [-0.35, 1.2, 0.26],
  ] as const) {
    const aperture = can(d, 0.18, materials.black);
    aperture.rotation.x = Math.PI;
    aperture.position.set(x, y, -BUS.z / 2);
    craft.add(aperture);
  }
  for (const x of [0.6, -0.6]) {
    for (const y of [1.7, -1.7]) {
      const thruster = engine(0.09, 0.14);
      thruster.position.set(x, y, -BUS.z / 2 - 0.07);
      craft.add(thruster);
    }
  }
  return craft;
}

/**
 * The MPO's radiator on its −X face: a white panel behind rows of slanted slats that
 * keep Mercury's heat off it, and the star trackers' baffles at its edge.
 */
function radiator(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'radiator';
  const face = -BUS.x / 2 - 0.03;
  const panel = box(0.04, 3.7, 2.0, materials.white);
  panel.position.x = face;
  group.add(panel);
  const slats = 14;
  for (let k = 0; k < slats; k++) {
    const slat = box(0.16, 3.62, 0.012, materials.aluminium);
    slat.rotation.y = (-20 * Math.PI) / 180;
    slat.position.set(face - 0.08, 0, -0.93 + (1.86 * k) / (slats - 1));
    group.add(slat);
  }
  for (const y of [1.2, 1.5, 1.8]) {
    const baffle = can(0.16, 0.25, materials.black);
    baffle.rotation.y = -Math.PI / 2 + 0.4;
    baffle.position.set(face, y - 0.05, BUS.z / 2 - 0.05);
    group.add(baffle);
  }
  return group;
}

/**
 * MOSIF and Mio on the MPO's +X face: a cone of white blanket, faceted like its gores,
 * holding Mio, an octagonal drum whose sides are half solar cells (the outer half) and
 * half mirrors, its antenna on its far deck. Built along +Y (three's cylinders), then
 * turned to +X.
 */
function sunshieldWithMio(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'mosif-mio';
  const cone = new THREE.CylinderGeometry(
    MOSIF.rimRadius,
    MOSIF.baseRadius,
    MOSIF.length,
    16,
    1,
    true,
  ).toNonIndexed();
  cone.computeVertexNormals();
  cone.translate(0, MOSIF.length / 2, 0);
  const shield = materials.ceramic.clone();
  shield.name = 'mosif';
  shield.side = THREE.DoubleSide;
  group.add(new THREE.Mesh(cone, shield));
  for (const [y, radius] of [
    [0, MOSIF.baseRadius],
    [MOSIF.length, MOSIF.rimRadius],
  ] as const) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.03, 8, 48), materials.aluminium);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    group.add(hoop);
  }
  const bottom = MOSIF.length * 0.35;
  const top = bottom + MIO.height;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(MIO.radius * 0.96, MIO.radius * 0.96, MIO.height, 8),
    materials.ceramic,
  );
  core.position.y = bottom + MIO.height / 2;
  group.add(core);
  // Each of the eight sides: a panel of mirrors below, one of cells above.
  const apothem = MIO.radius * Math.cos(Math.PI / 8);
  const side = 2 * MIO.radius * Math.sin(Math.PI / 8) - 0.02;
  for (let k = 0; k < 8; k++) {
    const angle = ((k + 0.5) * Math.PI) / 4;
    for (const [reflectorEvery, y] of [
      [1, bottom],
      [undefined, bottom + MIO.height / 2],
    ] as const) {
      const panel = solarPanel({
        width: side,
        length: MIO.height / 2 - 0.01,
        cellsAcross: 4,
        reflectorEvery,
      });
      panel.rotation.y = angle;
      panel.position.set(Math.sin(angle) * apothem, y, Math.cos(angle) * apothem);
      group.add(panel);
    }
  }
  const antenna = dish(0.6, 0.06);
  antenna.rotation.x = -Math.PI / 2;
  antenna.position.y = top + 0.3;
  group.add(antenna);
  group.add(strut(new THREE.Vector3(0, top, 0), new THREE.Vector3(0, top + 0.32, 0), 0.08));
  group.rotation.z = -Math.PI / 2;
  group.position.x = BUS.x / 2;
  return group;
}
