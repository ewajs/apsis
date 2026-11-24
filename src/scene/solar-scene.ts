/**
 * The 3D view (ADR 0001, 0004, 0005): the Sun and the planets at true size with a
 * minimum size on screen and their orbits, the spacecraft with their trails, and every
 * body's name (`LabelLayer`), around whatever the camera looks at.
 * See docs/guides/scene.md.
 *
 * Positions stay in km as 64-bit numbers. Every frame, the focus's position is
 * subtracted before anything reaches three.js (the floating origin), so the GPU's
 * 32-bit floats only see small numbers near what you're looking at.
 */
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { position, type BodyKind, type Chunk } from '../core/ephemeris.ts';
import { galacticAxes, toScene } from '../core/frames.ts';
import { stateFromChunks } from '../core/interpolate.ts';
import { subtract, type Vector3 } from '../core/math.ts';
import { orbitPathThrough, type OrbitalElements } from '../core/orbits.ts';
import { bodyAxes, type RotationModel } from '../core/rotation.ts';
import { TRAIL_DAYS, trailPoints } from '../core/trails.ts';
import { KM_PER_AU } from '../core/units.ts';
import {
  CRAFT_MIN_DIAMETER_PX,
  displayRadius,
  MIN_DIAMETER_PX,
  SUN_MIN_DIAMETER_PX,
  unitsPerPixel,
} from './apparent-size.ts';
import { LabelLayer, type ScreenBody } from './label-layer.ts';
import { sphereBasis } from './sphere-basis.ts';

/** A body the scene can draw. */
export type SceneBody = {
  id: string;
  kind: BodyKind;
  /** Shown on the body's label, in the visitor's language. */
  name: string;
  radiusKm: number;
  chunks: ReadonlyMap<number, Chunk>;
  /** File name in the textures folder, for bodies drawn as spheres. */
  texture?: string | undefined;
  orbit?: OrbitalElements | undefined;
  /** How it's tilted and spins; without one it isn't turned. */
  rotation?: RotationModel | undefined;
  /** Rings in its equatorial plane, in km from its centre (Saturn). */
  rings?: { innerKm: number; outerKm: number; texture: string } | undefined;
};

/** Which GPU interface draws the scene. */
export type Backend = 'webgpu' | 'webgl2';

/** What the scene needs from its host. */
export type SceneOptions = {
  /** The element the canvas fills. */
  container: HTMLElement;
  /** What the canvas shows, for screen readers. */
  label: string;
  /** Where `SceneBody.texture` files live (a URL ending in `/`). */
  texturesBase: string;
  /** `webgl2` forces the fallback, as browser tests do; otherwise three.js picks. */
  backend?: 'auto' | 'webgl2';
  /** The background's texture file: the Milky Way, in galactic coordinates. */
  sky?: string;
};

/** Vertical field of view, in degrees. */
const FOV_DEG = 45;
/** Camera clipping: from 1 km to 1,000 AU. The logarithmic depth buffer copes. */
const NEAR_KM = 1;
const FAR_KM = 1_000 * KM_PER_AU;
/** Where the camera starts: this far from the Sun, this high above the ecliptic. */
const START_DISTANCE_KM = 3.2 * KM_PER_AU;
const START_ELEVATION_DEG = 32;
/** How far the camera can pull back. */
const MAX_DISTANCE_KM = 400 * KM_PER_AU;
/** On a new focus, the camera frames it from this many radii away. */
const FOCUS_DISTANCE_RADII = 12;
/** Points per orbit line. */
const ORBIT_POINTS = 360;
/** A little light on the night sides, so planets don't vanish against space. */
const AMBIENT_INTENSITY = 0.06;
const SUN_INTENSITY = 2.5;
/** The sky's distance from the camera: beyond everything drawn, inside the far plane. */
const SKY_DISTANCE_KM = 500 * KM_PER_AU;
/** How bright the sky is drawn, 0 to 1: dim, so names and orbits stay readable. */
const SKY_BRIGHTNESS = 0.35;

/** A body on screen: its sphere, and its orbit (planets) or trail (spacecraft). */
type Drawn = { body: SceneBody; mesh: THREE.Mesh; orbit?: THREE.Line; trail?: THREE.Line };

/** Each kind's smallest size on screen. */
const MINIMUM_PX: Record<BodyKind | 'sun', number> = {
  sun: SUN_MIN_DIAMETER_PX,
  planet: MIN_DIAMETER_PX,
  spacecraft: CRAFT_MIN_DIAMETER_PX,
};

/** The 3D view. Create it with `SolarScene.create`, which resolves once it can draw. */
export class SolarScene {
  #renderer: THREE.WebGPURenderer;
  #scene = new THREE.Scene();
  #camera = new THREE.PerspectiveCamera(FOV_DEG, 1, NEAR_KM, FAR_KM);
  #controls: OrbitControls;
  #sunLight = new THREE.PointLight(0xffffff, SUN_INTENSITY, 0, 0);
  #sphere = new THREE.SphereGeometry(1, 64, 32);
  #textures = new THREE.TextureLoader();
  #drawn: Drawn[] = [];
  #sun: Drawn;
  #options: SceneOptions;
  #observer: ResizeObserver;
  #width = 1;
  #height = 1;
  #labels: LabelLayer;
  #sky?: THREE.Mesh;
  #time = 0;
  #focus = 'sun';
  #trueScale = false;
  #orbitColor: THREE.Color;
  #craftColor: THREE.Color;
  /** The time and focus the orbit lines and trails were last drawn for. */
  #linesDrawnFor = '';

  /** Creates the renderer (WebGPU, or WebGL 2 where WebGPU is missing) and the scene. */
  static async create(options: SceneOptions): Promise<SolarScene> {
    const renderer = new THREE.WebGPURenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
      forceWebGL: options.backend === 'webgl2',
    });
    await renderer.init();
    return new SolarScene(renderer, options);
  }

  private constructor(renderer: THREE.WebGPURenderer, options: SceneOptions) {
    this.#renderer = renderer;
    this.#options = options;
    const style = getComputedStyle(options.container);
    // Colours come from the design tokens (styles.css), like everything else.
    renderer.setClearColor(new THREE.Color(style.getPropertyValue('--color-bg').trim()));
    this.#orbitColor = new THREE.Color(style.getPropertyValue('--color-muted').trim());
    this.#craftColor = new THREE.Color(style.getPropertyValue('--color-craft').trim());

    const canvas = renderer.domElement;
    // Absolutely placed, so the canvas's own size never feeds back into its container's
    // (which the ResizeObserver below follows).
    canvas.style.cssText =
      'position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', options.label);
    canvas.dataset.backend = this.backend;
    options.container.append(canvas);
    this.#labels = new LabelLayer(options.container);

    this.#scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY), this.#sunLight);
    if (options.sky) this.#sky = this.#skyFor(options.sky);
    this.#sun = this.#add({ id: 'sun', kind: 'planet', name: '', radiusKm: 0, chunks: new Map() });
    // The Sun is the light, so it isn't lit: swap the standard material for a basic one.
    (this.#sun.mesh.material as THREE.Material).dispose();
    this.#sun.mesh.material = new THREE.MeshBasicMaterial();

    const elevation = (START_ELEVATION_DEG * Math.PI) / 180;
    this.#camera.position.set(
      0,
      START_DISTANCE_KM * Math.sin(elevation),
      START_DISTANCE_KM * Math.cos(elevation),
    );
    this.#controls = new OrbitControls(this.#camera, canvas);
    // The camera always orbits the focus, at the origin: panning would break that.
    this.#controls.enablePan = false;
    this.#controls.enableDamping = true;
    this.#controls.maxDistance = MAX_DISTANCE_KM;

    this.#observer = new ResizeObserver(() => this.#resize());
    this.#observer.observe(options.container);
    this.#resize();
  }

  /** The GPU interface actually in use. */
  get backend(): Backend {
    const backend = this.#renderer.backend as { isWebGPUBackend?: boolean };
    return backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
  }

  /** The bodies to draw, replacing any before. The Sun is always there. */
  setBodies(
    bodies: readonly SceneBody[],
    sun: { name: string; radiusKm: number; texture: string; rotation?: RotationModel },
  ): void {
    for (const drawn of this.#drawn.filter((d) => d !== this.#sun)) this.#remove(drawn);
    this.#drawn = [this.#sun];
    this.#sun.body = {
      ...this.#sun.body,
      name: sun.name,
      radiusKm: sun.radiusKm,
      rotation: sun.rotation,
    };
    this.#loadTexture(this.#sun.mesh, sun.texture);
    for (const body of bodies) this.#add(body);
    this.#controls.minDistance = sun.radiusKm * 1.5;
    this.#linesDrawnFor = '';
    this.#labels.setNames(this.#drawn.map(({ body }) => body));
  }

  /** Renames bodies, by id (after a language change). */
  setNames(names: Readonly<Record<string, string>>): void {
    for (const drawn of this.#drawn) {
      const name = names[drawn.body.id];
      if (name !== undefined) drawn.body = { ...drawn.body, name };
    }
    this.#labels.setNames(this.#drawn.map(({ body }) => body));
  }

  /** The instant shown, in TDB seconds since J2000. */
  set time(value: number) {
    this.#time = value;
  }

  /** Redraws orbits and trails on the next frame: call when new data has arrived. */
  refresh(): void {
    this.#linesDrawnFor = '';
  }

  /** The id of the body the camera orbits ('sun' by default). */
  set focus(id: string) {
    const target = this.#drawn.find((drawn) => drawn.body.id === id);
    if (!target || id === this.#focus) return;
    this.#focus = id;
    // Keep the viewing direction, move in to frame the new focus.
    const direction = this.#camera.position.clone().normalize();
    const radius = target.body.radiusKm;
    this.#camera.position.copy(direction.multiplyScalar(radius * FOCUS_DISTANCE_RADII));
    this.#controls.minDistance = radius * 1.5;
  }

  /**
   * Whether the Sun and the planets are drawn at true size only, with no minimum on
   * screen (ADR 0005). Spacecraft keep their markers either way.
   */
  set trueScale(value: boolean) {
    this.#trueScale = value;
  }

  /** Starts drawing every frame. */
  start(): void {
    void this.#renderer.setAnimationLoop(() => this.#frame());
  }

  /** Stops drawing, for when the view is hidden. */
  stop(): void {
    void this.#renderer.setAnimationLoop(null);
  }

  /** Stops drawing and frees the GPU resources; the canvas leaves the page. */
  dispose(): void {
    this.stop();
    this.#observer.disconnect();
    this.#controls.dispose();
    for (const drawn of this.#drawn) this.#remove(drawn);
    if (this.#sky) {
      const material = this.#sky.material as THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
    }
    this.#sphere.dispose();
    this.#labels.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  #add(body: SceneBody): Drawn {
    // Spacecraft are a flat dot in their own colour; planets are lit by the Sun.
    const material =
      body.kind === 'spacecraft'
        ? new THREE.MeshBasicMaterial({ color: this.#craftColor })
        : new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(this.#sphere, material);
    mesh.name = body.id;
    this.#scene.add(mesh);
    if (body.texture) this.#loadTexture(mesh, body.texture);
    if (body.rings) mesh.add(this.#ringsFor(body.radiusKm, body.rings));
    const drawn: Drawn = { body, mesh };
    if (body.orbit) drawn.orbit = this.#line(ORBIT_POINTS + 1, this.#orbitColor, 0.45);
    if (body.kind === 'spacecraft') drawn.trail = this.#line(TRAIL_DAYS + 1, this.#craftColor, 0.6);
    this.#drawn.push(drawn);
    return drawn;
  }

  /** An empty line of up to `points` points, filled in as time and focus change. */
  #line(points: number, color: THREE.Color, opacity: number): THREE.Line {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points * 3), 3));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    // Its bounds change as the focus moves; always draw it.
    line.frustumCulled = false;
    this.#scene.add(line);
    return line;
  }

  /**
   * A flat ring in the body's equatorial plane, as a child of its sphere, so it scales
   * and turns with it. Sizes are in body radii (the sphere has radius 1). The texture
   * is a radial strip: its left edge at the inner radius, its right at the outer.
   */
  #ringsFor(radiusKm: number, rings: NonNullable<SceneBody['rings']>): THREE.Mesh {
    const [inner, outer] = [rings.innerKm / radiusKm, rings.outerKm / radiusKm];
    const geometry = new THREE.RingGeometry(inner, outer, 128, 1);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const r = Math.hypot(position.getX(i), position.getY(i));
      uv.setXY(i, (r - inner) / (outer - inner), 0.5);
    }
    // RingGeometry lies in the xy plane; the sphere's equator is its xz plane.
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      roughness: 1,
      metalness: 0,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geometry, material);
    this.#loadTexture(ring, rings.texture);
    return ring;
  }

  #remove({ mesh, orbit, trail }: Drawn): void {
    for (const child of mesh.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      child.geometry.dispose();
      (child.material as THREE.MeshStandardMaterial).map?.dispose();
      (child.material as THREE.Material).dispose();
    }
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.map?.dispose();
    material.dispose();
    mesh.removeFromParent();
    for (const line of [orbit, trail]) {
      if (!line) continue;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      line.removeFromParent();
    }
  }

  #loadTexture(mesh: THREE.Mesh, file: string): void {
    this.#textures.load(`${this.#options.texturesBase}${file}`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.map = texture;
      material.needsUpdate = true;
    });
  }

  #frame(): void {
    const sunAt: Vector3 = [0, 0, 0];
    const states = new Map<string, Vector3>([['sun', sunAt]]);
    for (const { body } of this.#drawn) {
      if (body.id === 'sun') continue;
      const state = stateFromChunks(body.chunks, this.#time);
      if (state) states.set(body.id, position(state));
    }
    const origin = states.get(this.#focus) ?? sunAt;

    // Orbits and trails only move when the time or the focus does, not with the camera.
    const linesKey = `${this.#time}|${this.#focus}`;
    const redrawLines = linesKey !== this.#linesDrawnFor;
    this.#linesDrawnFor = linesKey;

    this.#controls.update();
    for (const { body, mesh, orbit, trail } of this.#drawn) {
      const at = states.get(body.id);
      mesh.visible = at !== undefined;
      if (trail) trail.visible = at !== undefined;
      if (!at) continue;
      mesh.position.set(...toScene(subtract(at, origin)));
      const minimum = MINIMUM_PX[body.id === 'sun' ? 'sun' : body.kind];
      const distance = this.#camera.position.distanceTo(mesh.position);
      // Spacecraft are markers, not bodies to scale (ADR 0005): true scale leaves them be.
      const trueScale = this.#trueScale && body.kind !== 'spacecraft';
      mesh.scale.setScalar(
        displayRadius(body.radiusKm, distance, FOV_DEG, this.#height, minimum, trueScale),
      );
      if (redrawLines && body.rotation) this.#turn(mesh, body.rotation);
      if (redrawLines && orbit && body.orbit) this.#placeOrbit(orbit, body.orbit, at, origin);
      if (redrawLines && trail) this.#placeTrail(trail, body.chunks, origin);
    }
    this.#sunLight.position.copy(this.#sun.mesh.position);
    // The sky moves with the camera, so it's always as far away: at infinity, in effect.
    this.#sky?.position.copy(this.#camera.position);
    this.#placeLabels();
    this.#renderer.render(this.#scene, this.#camera);
  }

  /** Where each visible body lands on screen, spacecraft first, for the labels. */
  #placeLabels(): void {
    const onScreen: ScreenBody[] = [];
    const point = new THREE.Vector3();
    const order = [...this.#drawn].sort(
      (a, b) => Number(b.body.kind === 'spacecraft') - Number(a.body.kind === 'spacecraft'),
    );
    for (const { body, mesh } of order) {
      if (!mesh.visible) continue;
      point.copy(mesh.position).project(this.#camera);
      // Outside -1…1 in depth means behind the camera or past the far plane.
      if (point.z < -1 || point.z > 1) continue;
      const distance = this.#camera.position.distanceTo(mesh.position);
      onScreen.push({
        id: body.id,
        x: ((point.x + 1) / 2) * this.#width,
        y: ((1 - point.y) / 2) * this.#height,
        radius: mesh.scale.x / unitsPerPixel(distance, FOV_DEG, this.#height),
      });
    }
    this.#labels.place(onScreen, this.#width, this.#height);
  }

  /**
   * Writes an orbit's points relative to the focus, in 64-bit before the GPU's 32. The
   * line passes through the planet, densest there (`orbitPathThrough`).
   */
  #placeOrbit(line: THREE.Line, elements: OrbitalElements, at: Vector3, origin: Vector3): void {
    const vertices = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    orbitPathThrough(elements, ORBIT_POINTS, at).forEach((point, i) => {
      vertices.setXYZ(i, ...toScene(subtract(point, origin)));
    });
    vertices.needsUpdate = true;
  }

  /**
   * The Milky Way behind everything: a sphere seen from inside, drawn first and never
   * hiding anything. The texture is in galactic coordinates (the band along its middle,
   * the galactic centre at its centre), so it's turned to put that band on the real
   * galactic plane and its centre towards Sagittarius. It's artwork, not a star
   * catalogue: individual stars aren't the real ones (docs/guides/scene.md).
   */
  #skyFor(file: string): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      color: new THREE.Color(SKY_BRIGHTNESS, SKY_BRIGHTNESS, SKY_BRIGHTNESS),
    });
    const sky = new THREE.Mesh(this.#sphere, material);
    sky.name = 'sky';
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    sky.scale.setScalar(SKY_DISTANCE_KM);
    const { centre, north, east } = galacticAxes();
    const [x, y, z] = sphereBasis({ pole: north, meridian: centre, east }).map(
      (axis) => new THREE.Vector3(...axis),
    ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    sky.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.#loadTexture(sky, file);
    this.#scene.add(sky);
    return sky;
  }

  /** Tilts and spins a body's sphere to how it stands at the shown instant. */
  #turn(mesh: THREE.Mesh, rotation: RotationModel): void {
    const [x, y, z] = sphereBasis(bodyAxes(rotation, this.#time)).map(
      (axis) => new THREE.Vector3(...axis),
    ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  /** A spacecraft's last `TRAIL_DAYS`, relative to the focus. */
  #placeTrail(line: THREE.Line, chunks: ReadonlyMap<number, Chunk>, origin: Vector3): void {
    const vertices = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const points = trailPoints(chunks, this.#time);
    points.forEach((point, i) => vertices.setXYZ(i, ...toScene(subtract(point, origin))));
    vertices.needsUpdate = true;
    line.geometry.setDrawRange(0, points.length);
  }

  #resize(): void {
    const { clientWidth: width, clientHeight: height } = this.#options.container;
    if (width === 0 || height === 0) return;
    this.#width = width;
    this.#height = height;
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }
}
