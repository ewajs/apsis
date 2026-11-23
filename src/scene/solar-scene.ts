/**
 * The 3D view (ADR 0001, 0004, 0005): the Sun and the planets at true size with a
 * minimum size on screen, and the planets' orbits, around whatever the camera looks at.
 * See docs/guides/scene.md.
 *
 * Positions stay in km as 64-bit numbers. Every frame, the focus's position is
 * subtracted before anything reaches three.js (the floating origin), so the GPU's
 * 32-bit floats only see small numbers near what you're looking at.
 */
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { position, type BodyKind, type Chunk } from '../core/ephemeris.ts';
import { toScene } from '../core/frames.ts';
import { stateFromChunks } from '../core/interpolate.ts';
import { subtract, type Vector3 } from '../core/math.ts';
import { orbitPathThrough, type OrbitalElements } from '../core/orbits.ts';
import { KM_PER_AU } from '../core/units.ts';
import { displayRadius, MIN_DIAMETER_PX, SUN_MIN_DIAMETER_PX } from './apparent-size.ts';

/** A body the scene can draw. */
export type SceneBody = {
  id: string;
  kind: BodyKind;
  radiusKm: number;
  chunks: ReadonlyMap<number, Chunk>;
  /** File name in the textures folder, for bodies drawn as spheres. */
  texture?: string | undefined;
  orbit?: OrbitalElements | undefined;
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

type Drawn = { body: SceneBody; mesh: THREE.Mesh; orbit?: THREE.Line };

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
  #height = 1;
  #time = 0;
  #focus = 'sun';
  #trueScale = false;
  #orbitColor: THREE.Color;
  /** The time and focus the orbit lines were last drawn for. */
  #orbitsDrawnFor = '';

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

    const canvas = renderer.domElement;
    // Absolutely placed, so the canvas's own size never feeds back into its container's
    // (which the ResizeObserver below follows).
    canvas.style.cssText =
      'position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', options.label);
    canvas.dataset.backend = this.backend;
    options.container.append(canvas);

    this.#scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY), this.#sunLight);
    this.#sun = this.#add({ id: 'sun', kind: 'planet', radiusKm: 0, chunks: new Map() });
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
  setBodies(bodies: readonly SceneBody[], sun: { radiusKm: number; texture: string }): void {
    for (const drawn of this.#drawn.filter((d) => d !== this.#sun)) this.#remove(drawn);
    this.#drawn = [this.#sun];
    this.#sun.body = { ...this.#sun.body, radiusKm: sun.radiusKm };
    this.#loadTexture(this.#sun.mesh, sun.texture);
    for (const body of bodies) this.#add(body);
    this.#controls.minDistance = sun.radiusKm * 1.5;
  }

  /** The instant shown, in TDB seconds since J2000. */
  set time(value: number) {
    this.#time = value;
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

  /** Whether bodies are drawn at true size only, with no minimum on screen (ADR 0005). */
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
    this.#sphere.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  #add(body: SceneBody): Drawn {
    const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(this.#sphere, material);
    mesh.name = body.id;
    this.#scene.add(mesh);
    if (body.texture) this.#loadTexture(mesh, body.texture);
    const drawn: Drawn = { body, mesh };
    if (body.orbit) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array((ORBIT_POINTS + 1) * 3), 3),
      );
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: this.#orbitColor, transparent: true, opacity: 0.45 }),
      );
      // Its bounds change as the focus moves; always draw it.
      line.frustumCulled = false;
      this.#scene.add(line);
      drawn.orbit = line;
    }
    this.#drawn.push(drawn);
    return drawn;
  }

  #remove({ mesh, orbit }: Drawn): void {
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.map?.dispose();
    material.dispose();
    mesh.removeFromParent();
    if (orbit) {
      orbit.geometry.dispose();
      (orbit.material as THREE.Material).dispose();
      orbit.removeFromParent();
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

    // Orbit lines only move when the time or the focus does, not with the camera.
    const orbitsKey = `${this.#time}|${this.#focus}`;
    const redrawOrbits = orbitsKey !== this.#orbitsDrawnFor;
    this.#orbitsDrawnFor = orbitsKey;

    for (const { body, mesh, orbit } of this.#drawn) {
      const at = states.get(body.id);
      mesh.visible = at !== undefined;
      if (!at) continue;
      mesh.position.set(...toScene(subtract(at, origin)));
      const minimum = body.id === 'sun' ? SUN_MIN_DIAMETER_PX : MIN_DIAMETER_PX;
      const distance = this.#camera.position.distanceTo(mesh.position);
      mesh.scale.setScalar(
        displayRadius(body.radiusKm, distance, FOV_DEG, this.#height, minimum, this.#trueScale),
      );
      if (redrawOrbits && orbit && body.orbit) this.#placeOrbit(orbit, body.orbit, at, origin);
    }
    this.#sunLight.position.copy(this.#sun.mesh.position);

    this.#controls.update();
    this.#renderer.render(this.#scene, this.#camera);
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

  #resize(): void {
    const { clientWidth: width, clientHeight: height } = this.#options.container;
    if (width === 0 || height === 0) return;
    this.#height = height;
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }
}
