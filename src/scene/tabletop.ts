/**
 * The solar system on a table, at the shown instant, for AR (ADR 0014): built here as
 * a three.js group in metres with +Y up, then handed to Quick Look as USDZ or shown live
 * in WebXR. Layout and sizes come from `core/tabletop.ts`; see docs/guides/ar.md.
 */
import * as THREE from 'three/webgpu';
import type { BodyKind } from '../core/ephemeris.ts';
import { toScene } from '../core/frames.ts';
import type { Vector3 } from '../core/math.ts';
import { orbitPath, type OrbitalElements } from '../core/orbits.ts';
import { bodyAxes, type RotationModel } from '../core/rotation.ts';
import { CRAFT_RADIUS_M, TABLE_RADIUS_M, tableRadius, tableSpot } from '../core/tabletop.ts';
import { sphereBasis } from './sphere-basis.ts';

/** A body on the table, as it is at the shown instant. */
export type TableBody = {
  id: string;
  kind: BodyKind | 'sun';
  /** Heliocentric ecliptic km. */
  at: Vector3;
  radiusKm: number;
  /** A texture in the textures folder (planets and the Sun). */
  texture?: string | undefined;
  orbit?: OrbitalElements | undefined;
  rotation?: RotationModel | undefined;
  /** Saturn's rings, in km from its centre. */
  rings?: { innerKm: number; outerKm: number } | undefined;
  /** A spacecraft's last days, heliocentric km, oldest first. */
  trail?: readonly Vector3[] | undefined;
};

/** How thick the orbit and trail threads are, in metres. */
const ORBIT_TUBE_M = 0.0006;
const TRAIL_TUBE_M = 0.0004;
/** How far the base disc sits below the ecliptic, in metres. */
const BASE_DROP_M = 0.035;
/** Points per orbit thread. */
const ORBIT_POINTS = 160;

/** Ecliptic metres to AR metres: the table is the ecliptic, +Y is ecliptic north. */
const toTable = (at: Vector3) => new THREE.Vector3(...toScene(tableSpot(at)));

/**
 * The table, its bodies and their orbits, at `tdb` (TDB seconds since J2000), with the
 * textures loaded (an exporter needs their images).
 * @param texturesBase Where texture files live (a URL ending in `/`).
 * @param craftColor The spacecraft's colour, from the design tokens.
 */
export async function buildTabletop(
  bodies: readonly TableBody[],
  tdb: number,
  texturesBase: string,
  craftColor: string,
): Promise<THREE.Group> {
  const table = new THREE.Group();
  table.name = 'apsis-tabletop';
  const loader = new THREE.TextureLoader();
  const texture = async (file: string) => {
    const map = await loader.loadAsync(`${texturesBase}${file}`);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  };

  // A dark disc under it all, so it reads as one object standing on the table.
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(TABLE_RADIUS_M * 1.04, 96),
    new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      roughness: 0.9,
      transparent: true,
      opacity: 0.6,
    }),
  );
  base.rotation.x = -Math.PI / 2;
  // Below the tilted orbits' lowest dips (Mercury's 7° reaches about 1.6 cm), which a
  // disc just under the ecliptic would hide.
  base.position.y = -BASE_DROP_M;
  table.add(base);

  const thread = new THREE.MeshStandardMaterial({
    color: 0xc8d0dc,
    roughness: 0.6,
    transparent: true,
    opacity: 0.5,
  });
  const craft = new THREE.MeshStandardMaterial({
    color: craftColor,
    emissive: craftColor,
    emissiveIntensity: 0.6,
    roughness: 0.4,
  });
  const sphere = new THREE.SphereGeometry(1, 48, 24);

  for (const body of bodies) {
    const spot = toTable(body.at);
    if (body.kind === 'spacecraft') {
      const bead = new THREE.Mesh(sphere, craft);
      bead.name = body.id;
      bead.scale.setScalar(CRAFT_RADIUS_M);
      bead.position.copy(spot);
      table.add(bead);
      if (body.trail && body.trail.length > 1) {
        const curve = new THREE.CatmullRomCurve3(body.trail.map(toTable));
        table.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(curve, body.trail.length * 2, TRAIL_TUBE_M, 6),
            craft,
          ),
        );
      }
      continue;
    }
    const map = body.texture ? await texture(body.texture) : null;
    const material =
      body.kind === 'sun'
        ? new THREE.MeshStandardMaterial({
            emissive: 0xffffff,
            emissiveMap: map,
            emissiveIntensity: 1.6,
            color: 0x000000,
          })
        : new THREE.MeshStandardMaterial({ map, roughness: 1 });
    const ball = new THREE.Mesh(sphere, material);
    ball.name = body.id;
    const radius = tableRadius(body.id, body.radiusKm);
    ball.position.copy(spot);
    ball.scale.setScalar(radius);
    if (body.rotation) {
      const [x, y, z] = sphereBasis(bodyAxes(body.rotation, tdb)).map(
        (axis) => new THREE.Vector3(...axis),
      );
      ball.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x!, y!, z!));
    }
    if (body.rings) {
      // In the planet's own units (radii), lying in its equator (local x–z).
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(
          body.rings.innerKm / body.radiusKm,
          body.rings.outerKm / body.radiusKm,
          96,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xd8c9a3,
          roughness: 0.8,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ball.add(ring);
    }
    table.add(ball);
    if (body.orbit) {
      const curve = new THREE.CatmullRomCurve3(
        orbitPath(body.orbit, ORBIT_POINTS).map(toTable),
        true,
      );
      table.add(
        new THREE.Mesh(new THREE.TubeGeometry(curve, ORBIT_POINTS, ORBIT_TUBE_M, 6, true), thread),
      );
    }
  }
  return table;
}
