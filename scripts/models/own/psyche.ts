/**
 * Psyche, simplified. Sizes from JPL's press kit (jpl.nasa.gov/press-kits/psyche, "The
 * Spacecraft"): a panel-box bus 2.2 m wide by 2.4 m deep, 4.9 m tall with the 2 m booms
 * of two instruments (the magnetometers and the gamma-ray and neutron spectrometer); two
 * cross-shaped wings of five panels, each 11.3 by 7.3 m, deployed from opposite sides
 * (24.76 m in all); the 2 m fixed high-gain dish, with the laser-communications
 * telescope beside it, aligned with it; and four Hall-effect thrusters, in two pairs on
 * the bottom.
 *
 * Here the bus stands along X: the instrument deck at +X, the thrusters at −X.
 */
import * as THREE from 'three';
import {
  blanketBox,
  box,
  can,
  dish,
  hallThruster,
  materials,
  solarPanel,
  strut,
  yoke,
} from './parts.ts';

const BUS = { height: 2.9, width: 2.2, depth: 2.4 };
/** Each wing: from the bus's side to its tip, and across. */
const WING = { length: 11.3, width: 7.3 };
const PANEL_GAP = 0.05;
/** The panels are square-ish: three across make the wing's width. */
const PANEL_WIDTH = (WING.width - 2 * PANEL_GAP) / 3;
const PANEL_LENGTH = 2.6;
const YOKE = WING.length - 3 * PANEL_LENGTH - 2 * PANEL_GAP;

/** Builds the model, in metres, in the body frame. */
export function build(): THREE.Object3D {
  const craft = new THREE.Group();
  craft.name = 'psyche';
  craft.add(blanketBox(BUS.height, BUS.width, BUS.depth, materials.silver));
  for (const side of [1, -1]) {
    const wing = crossWing();
    wing.position.y = (side * BUS.width) / 2;
    wing.rotation.z = side === 1 ? 0 : Math.PI;
    craft.add(wing);
  }

  const antenna = dish(2);
  antenna.position.set(0.35, 0, BUS.depth / 2 + 0.12);
  craft.add(antenna);
  const pedestal = can(0.3, 0.12, materials.aluminium);
  pedestal.position.set(0.35, 0, BUS.depth / 2);
  craft.add(pedestal);
  // The laser-communications telescope in its sunshade, beside the dish.
  const telescope = can(0.42, 0.9, materials.silver);
  telescope.position.set(-1.05, 0.6, BUS.depth / 2);
  craft.add(telescope);
  const aperture = can(0.3, 0.02, materials.black);
  aperture.position.set(-1.05, 0.6, BUS.depth / 2 + 0.89);
  craft.add(aperture);

  // The thrusters, in two pairs on gimballed plates at the bottom, firing along −X.
  for (const z of [0.55, -0.55]) {
    const plate = box(0.06, 0.9, 0.5, materials.aluminium);
    plate.position.set(-BUS.height / 2 - 0.03, 0, z);
    craft.add(plate);
    for (const y of [0.22, -0.22]) {
      const thruster = hallThruster(0.3);
      thruster.rotation.y = Math.PI / 2;
      thruster.position.set(-BUS.height / 2 - 0.06, y, z);
      craft.add(thruster);
    }
  }

  // The instrument booms on the deck: magnetometers (two, one at the tip and one part
  // way), and the spectrometer at the tip of the other.
  const deck = BUS.height / 2;
  const magnetometer = new THREE.Vector3(deck, -0.55, -0.7);
  craft.add(strut(magnetometer, magnetometer.clone().setX(deck + 2), 0.035));
  for (const along of [2, 1.25]) {
    const sensor = box(0.14, 0.14, 0.14, materials.white);
    sensor.position.copy(magnetometer).setX(deck + along);
    craft.add(sensor);
  }
  const spectrometer = new THREE.Vector3(deck, 0.55, -0.7);
  craft.add(strut(spectrometer, spectrometer.clone().setX(deck + 1.7), 0.05));
  const head = can(0.28, 0.4, materials.gold);
  head.rotation.y = Math.PI / 2;
  head.position.copy(spectrometer).setX(deck + 1.65);
  craft.add(head);
  // The pair of imagers on the deck.
  for (const y of [0.25, -0.25]) {
    const imager = can(0.18, 0.35, materials.white);
    imager.rotation.y = Math.PI / 2;
    imager.position.set(deck, y, 0.6);
    craft.add(imager);
    const lens = can(0.11, 0.01, materials.black);
    lens.rotation.y = Math.PI / 2;
    lens.position.set(deck + 0.35, y, 0.6);
    craft.add(lens);
  }
  return craft;
}

/**
 * One of Psyche's wings along +Y, its hinge at the origin: a yoke, then three panels in
 * a row and two more on either side of the middle one, cells facing +Z.
 */
function crossWing(): THREE.Group {
  const wing = new THREE.Group();
  wing.name = 'solar-wing';
  wing.add(yoke(YOKE, PANEL_WIDTH * 0.7));
  const step = PANEL_LENGTH + PANEL_GAP;
  const places: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [-1, 1],
  ];
  for (const [across, along] of places) {
    const panel = solarPanel({ width: PANEL_WIDTH, length: PANEL_LENGTH, cellsAcross: 8 });
    panel.position.set(across * (PANEL_WIDTH + PANEL_GAP), YOKE + along * step, 0);
    wing.add(panel);
  }
  return wing;
}
