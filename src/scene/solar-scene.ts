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
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { defaultAttitude } from '../core/attitude.ts';
import { position, type BodyKind, type Chunk } from '../core/ephemeris.ts';
import type { ModelEntry } from '../core/models.ts';
import { galacticAxes, toScene } from '../core/frames.ts';
import { stateFromChunks } from '../core/interpolate.ts';
import {
  add,
  cross,
  dot,
  length,
  normalize,
  radians,
  scale,
  subtract,
  type Vector3,
} from '../core/math.ts';
import { pickAt } from '../core/pick.ts';
import { orbitPathThrough, type OrbitalElements } from '../core/orbits.ts';
import { bodyAxes, type RotationModel } from '../core/rotation.ts';
import { TRAIL_DAYS, trailPoints } from '../core/trails.ts';
import { KM_PER_AU } from '../core/units.ts';
import {
  apparentPx,
  CRAFT_MIN_DIAMETER_PX,
  displayRadius,
  MOON_MIN_DIAMETER_PX,
  SMALL_MIN_DIAMETER_PX,
  modelShows,
  nearPlaneKm,
  MIN_DIAMETER_PX,
  SUN_MIN_DIAMETER_PX,
  unitsPerPixel,
} from './apparent-size.ts';
import { CraftModels } from './craft-models.ts';
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
  /**
   * Where it is at an instant, heliocentric km (`positionAt`, ADR 0015); without it,
   * from `chunks`.
   */
  place?: ((t: number) => Vector3 | null) | undefined;
  /** For a moon: the planet it circles; it faces it, and hides when too close to it. */
  parent?: string | undefined;
  /**
   * Its ellipse at an instant, to draw: around its `parent` for a moon, around the Sun
   * for a small body (from its track, ADR 0015).
   */
  localOrbit?: ((t: number) => OrbitalElements | null) | undefined;
  /** A colour for a body without a texture map (a comet, a small asteroid). */
  color?: string | undefined;
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
  /** Called with a body's id when it's tapped or clicked. */
  onPick?: (id: string) => void;
  /** The spacecraft models: their folder (a URL ending in `/`) and what's there. */
  models?: { base: string; entries: readonly ModelEntry[] };
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
/**
 * A spacecraft has no size to frame: the camera stands back this many times its
 * distance from the Sun, outside it and looking in, so its neighbourhood shows (ADR
 * 0005): the inner planets for Psyche, the outer system for Voyager. At least the minimum.
 */
const CRAFT_FOCUS_SUN_DISTANCES = 1.5;
const CRAFT_FOCUS_MIN_KM = 0.05 * KM_PER_AU;
/** How close the camera may come to a spacecraft without a model: just a marker. */
const CRAFT_MIN_DISTANCE_KM = 1_000;
/** With a model, as close as this many times its length, from its centre. */
const MODEL_MIN_DISTANCE_LENGTHS = 0.8;
/**
 * How long a flight takes, from its shortest to its longest; none with reduced motion.
 * In between it grows with the orders of magnitude it crosses: a hop between planets is
 * quick, a dive from the solar system to a spacecraft's antenna takes its time.
 */
const FLIGHT_MS = { min: 900, perDecade: 220, max: 3_200 };
/** A close-up frames a spacecraft from this many times its length. */
const CLOSE_UP_LENGTHS = 2.2;
/**
 * A close-up looks at the spacecraft's sunlit side, this far round from the Sun's
 * direction (0° would be the Sun behind the camera, flat light) and this high above
 * the ecliptic.
 */
const CLOSE_UP_PHASE_DEG = 55;
const CLOSE_UP_ELEVATION_DEG = 18;
/** A press that moves less than this, in px, is a tap, not a turn of the camera. */
const TAP_SLOP_PX = 8;
/** Points per orbit line. */
const ORBIT_POINTS = 360;
/** A little light on the night sides, so planets don't vanish against space. */
const AMBIENT_INTENSITY = 0.06;
const SUN_INTENSITY = 2.5;
/** The sky's distance from the camera: beyond everything drawn, inside the far plane. */
const SKY_DISTANCE_KM = 500 * KM_PER_AU;
/** How bright the sky is drawn, 0 to 1: dim, so names and orbits stay readable. */
const SKY_BRIGHTNESS = 0.35;

/**
 * A body on screen: its sphere, and its orbit (planets) or trail (spacecraft); for a
 * spacecraft close enough, its model instead of the sphere.
 */
type Drawn = {
  body: SceneBody;
  mesh: THREE.Mesh;
  orbit?: THREE.Line;
  trail?: THREE.Line;
  modelShown?: boolean;
};

/** Each kind's smallest size on screen. */
const MINIMUM_PX: Record<BodyKind | 'sun', number> = {
  sun: SUN_MIN_DIAMETER_PX,
  planet: MIN_DIAMETER_PX,
  spacecraft: CRAFT_MIN_DIAMETER_PX,
  moon: MOON_MIN_DIAMETER_PX,
  small: SMALL_MIN_DIAMETER_PX,
};
/**
 * A moon shows once it's this many px clear of its planet's disc on screen; closer, it
 * and its orbit would only crowd the planet.
 */
const MOON_CLEARANCE_PX = 8;

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
  /** The selected body, whose label stands out; `null` when nothing is. */
  #selected: string | null = null;
  /** The origin used last frame: the focus's position, or a point on the way to it. */
  #origin: Vector3 = [0, 0, 0];
  /**
   * A flight under way: where it started and when; where it ends and how long it takes
   * are worked out on its first frame, once the target's position is known.
   */
  #flight:
    | {
        from: Vector3;
        direction: THREE.Vector3;
        distance: number;
        at: number;
        still: boolean;
        to?: { direction: THREE.Vector3; distance: number; ms: number };
      }
    | undefined;
  /** Whether the camera is (or is flying) close up to the focused spacecraft's model. */
  #closeUp = false;
  /** Where each body was on screen last frame, for taps. */
  #onScreen: ScreenBody[] = [];
  #press: { id: number; x: number; y: number } | undefined;
  #models: CraftModels | undefined;
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
    if (options.models) {
      // A soft studio surround for the models to reflect (see craft-models.ts), made
      // when the first model arrives: most visits never come that close.
      this.#models = new CraftModels(
        options.models.base,
        options.models.entries,
        () => new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture,
        () => this.refresh(),
      );
    }

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
    // A tap picks a body; OrbitControls takes drags, so only a press that stays put counts.
    canvas.addEventListener('pointerdown', (event) => {
      if (event.isPrimary)
        this.#press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointerup', (event) => this.#tap(event));

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

  /**
   * Selects a body: the camera orbits it, and its label stands out; with `null`, the
   * Sun. With `fly`, the camera flies there over `FLIGHT_MS` (unless the visitor
   * prefers reduced motion); otherwise it's there on the next frame.
   */
  select(id: string | null, fly = true): void {
    this.#selected = id;
    this.#labels.emphasise(id);
    const focus = id ?? 'sun';
    const target = this.#drawn.find((drawn) => drawn.body.id === focus);
    if (!target || (focus === this.#focus && !this.#closeUp)) return;
    this.#focus = focus;
    this.#closeUp = false;
    this.#startFlight(fly);
  }

  /** Whether a spacecraft has a model to see close up. */
  hasModel(id: string): boolean {
    return this.#models?.lengthKm(id) !== undefined;
  }

  /**
   * Flies to the focused spacecraft's model, on its sunlit side, or back out to its
   * neighbourhood. A dive across ten orders of magnitude, so it takes its time.
   */
  closeUp(on: boolean): void {
    if (on === this.#closeUp || !this.hasModel(this.#focus)) return;
    this.#closeUp = on;
    this.#startFlight(true);
  }

  #startFlight(fly: boolean): void {
    this.#flight = {
      from: this.#origin,
      direction: this.#camera.position.clone().normalize(),
      distance: this.#camera.position.length(),
      at: performance.now(),
      still: !fly || matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }

  /**
   * Moves the camera `factor` times closer to the focus (2 halves the distance), within
   * the limits a pinch or the wheel have.
   */
  zoomBy(factor: number): void {
    const { minDistance, maxDistance } = this.#controls;
    const distance = this.#camera.position.length() / factor;
    this.#camera.position.setLength(THREE.MathUtils.clamp(distance, minDistance, maxDistance));
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
        : new THREE.MeshStandardMaterial({
            roughness: 1,
            metalness: 0,
            color: body.color ?? 0xffffff,
          });
    const mesh = new THREE.Mesh(this.#sphere, material);
    mesh.name = body.id;
    this.#scene.add(mesh);
    if (body.texture) this.#loadTexture(mesh, body.texture);
    if (body.rings) mesh.add(this.#ringsFor(body.radiusKm, body.rings));
    const drawn: Drawn = { body, mesh };
    if (body.orbit || body.localOrbit) {
      drawn.orbit = this.#line(ORBIT_POINTS + 1, this.#orbitColor, 0.45);
    }
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
      if (body.place) {
        const at = body.place(this.#time);
        if (at) states.set(body.id, at);
        continue;
      }
      const state = stateFromChunks(body.chunks, this.#time);
      if (state) states.set(body.id, position(state));
    }
    const origin = this.#fly(states.get(this.#focus) ?? sunAt);
    this.#origin = origin;

    // Orbits and trails only move when the time or the origin does, not with the camera.
    const linesKey = `${this.#time}|${origin.join()}`;
    const redrawLines = linesKey !== this.#linesDrawnFor;
    this.#linesDrawnFor = linesKey;

    this.#controls.minDistance = this.#closest();
    this.#controls.update();
    // Close to a spacecraft the near plane must be millimetres; far out, 1 km.
    const near = nearPlaneKm(this.#camera.position.length());
    if (near !== this.#camera.near) {
      this.#camera.near = near;
      this.#camera.updateProjectionMatrix();
    }
    // Close up to a model, orbits and trails would cross the sky as stray lines,
    // hundreds of millions of km away: they step aside (as of last frame's state).
    const closeUp = this.#drawn.find((drawn) => drawn.body.id === this.#focus)?.modelShown;
    for (const drawn of this.#drawn) {
      const { body, mesh, orbit, trail } = drawn;
      const at = states.get(body.id);
      mesh.visible = at !== undefined;
      if (orbit) orbit.visible = !closeUp;
      if (trail) trail.visible = at !== undefined && !closeUp;
      if (!at) continue;
      mesh.position.set(...toScene(subtract(at, origin)));
      const minimum = MINIMUM_PX[body.id === 'sun' ? 'sun' : body.kind];
      const distance = this.#camera.position.distanceTo(mesh.position);
      // Spacecraft are markers, not bodies to scale (ADR 0005): true scale leaves them be.
      const trueScale = this.#trueScale && body.kind !== 'spacecraft';
      mesh.scale.setScalar(
        displayRadius(body.radiusKm, distance, FOV_DEG, this.#height, minimum, trueScale),
      );
      if (body.kind === 'spacecraft') this.#showModel(drawn, distance, at, states.get('earth'));
      if (redrawLines && body.rotation) this.#turn(mesh, body.rotation);
      if (redrawLines && orbit && body.orbit) this.#placeOrbit(orbit, body.orbit, at, origin);
      const parent = body.parent ? states.get(body.parent) : undefined;
      if (redrawLines && parent) this.#faceParent(mesh, at, parent);
      // A moon's ellipse is around its planet; a small body's, around the Sun.
      const center = body.parent ? parent : sunAt;
      if (redrawLines && orbit && center && body.localOrbit) {
        const ellipse = body.localOrbit(this.#time);
        if (ellipse) this.#placeOrbit(orbit, ellipse, at, origin, center);
      }
      if (redrawLines && trail) this.#placeTrail(trail, body.chunks, origin);
    }
    this.#hideCrowdedMoons();
    this.#sunLight.position.copy(this.#sun.mesh.position);
    // The sky moves with the camera, so it's always as far away: at infinity, in effect.
    this.#sky?.position.copy(this.#camera.position);
    this.#placeLabels();
    this.#renderer.render(this.#scene, this.#camera);
  }

  /**
   * Moves the camera along a flight, if one is under way, and returns this frame's
   * origin: part of the way from where the flight started to the focus, easing in and
   * out. The distance changes by equal factors (log scale), so a flight from 30 AU to a
   * planet's 12 radii doesn't rush through the last part. A spacecraft is seen from
   * outside its distance from the Sun, looking in (`CRAFT_FOCUS_SUN_DISTANCES`).
   */
  #fly(focusAt: Vector3): Vector3 {
    const flight = this.#flight;
    if (!flight) return focusAt;
    flight.to ??= this.#flightEnd(focusAt, flight.distance);
    const { to } = flight;
    const t = flight.still ? 1 : Math.min(1, (performance.now() - flight.at) / to.ms);
    const eased = t * t * (3 - 2 * t);
    const along = flight.direction.clone().lerp(to.direction, eased).normalize();
    this.#camera.position.copy(
      along.multiplyScalar(flight.distance * (to.distance / flight.distance) ** eased),
    );
    if (t === 1) this.#flight = undefined;
    return add(flight.from, scale(subtract(focusAt, flight.from), eased));
  }

  /** Where a flight to the focus (at `focusAt`) ends, and how long it takes from `from` km. */
  #flightEnd(focusAt: Vector3, from: number) {
    const target = this.#drawn.find((drawn) => drawn.body.id === this.#focus)!.body;
    let direction = this.#camera.position.clone().normalize();
    let distance = target.radiusKm * FOCUS_DISTANCE_RADII;
    const lengthKm = this.#models?.lengthKm(target.id);
    if (this.#focus === 'sun') distance = START_DISTANCE_KM;
    else if (this.#closeUp && lengthKm) {
      // The sunlit side, three-quarters on.
      distance = lengthKm * CLOSE_UP_LENGTHS;
      direction = new THREE.Vector3(...toScene(sunlitSide(focusAt)));
    } else if (target.kind === 'spacecraft') {
      distance = Math.max(CRAFT_FOCUS_MIN_KM, length(focusAt) * CRAFT_FOCUS_SUN_DISTANCES);
      // Outward from the Sun, tilted up from the ecliptic.
      const outward = Math.hypot(focusAt[0], focusAt[1]) || 1;
      const up = radians(START_ELEVATION_DEG);
      const ecliptic: Vector3 = [
        (Math.cos(up) * focusAt[0]) / outward,
        (Math.cos(up) * focusAt[1]) / outward,
        Math.sin(up),
      ];
      direction = new THREE.Vector3(...toScene(ecliptic));
    }
    const decades = Math.abs(Math.log10(distance / from));
    const ms = Math.min(FLIGHT_MS.max, FLIGHT_MS.min + FLIGHT_MS.perDecade * decades);
    return { direction, distance, ms };
  }

  /** How close the camera may come to the focus: outside a planet, or a model's length. */
  #closest(): number {
    const focus = this.#drawn.find((drawn) => drawn.body.id === this.#focus)?.body;
    if (!focus) return CRAFT_MIN_DISTANCE_KM;
    if (focus.radiusKm > 0) return focus.radiusKm * 1.5;
    const lengthKm = this.#models?.lengthKm(focus.id);
    return lengthKm ? lengthKm * MODEL_MIN_DISTANCE_LENGTHS : CRAFT_MIN_DISTANCE_KM;
  }

  /**
   * Swaps a spacecraft's marker for its model once the model, at true size, is bigger
   * on screen than the marker (ADR 0005). Loading starts a little earlier, when it's
   * about a pixel across, or as soon as it's the focus.
   */
  #showModel(drawn: Drawn, distance: number, at: Vector3, earth: Vector3 | undefined): void {
    const { id } = drawn.body;
    const lengthKm = this.#models?.lengthKm(id);
    if (!lengthKm || !this.#models) return;
    const wanted = this.#focus === id || apparentPx(lengthKm, distance, FOV_DEG, this.#height) >= 1;
    const model = wanted ? this.#models.get(id) : undefined;
    const shows =
      model !== undefined &&
      drawn.mesh.visible &&
      modelShows(lengthKm, distance, FOV_DEG, this.#height);
    if (model) {
      if (!model.parent) this.#scene.add(model);
      model.visible = shows;
      model.position.copy(drawn.mesh.position);
      // Antenna to Earth, the Sun across the arrays (core/attitude.ts).
      if (shows && earth) {
        const { x, y, z } = defaultAttitude(at, earth, this.#models.pointing(id));
        const axis = (v: Vector3) => new THREE.Vector3(...toScene(v));
        model.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(axis(x), axis(y), axis(z)),
        );
      }
    }
    drawn.modelShown = shows;
    if (shows) drawn.mesh.visible = false;
  }

  /** A press that didn't move picks the body under it, if any. */
  #tap(event: PointerEvent): void {
    const press = this.#press;
    this.#press = undefined;
    if (!press || press.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP_PX) return;
    const box = this.#renderer.domElement.getBoundingClientRect();
    const picked = pickAt(this.#onScreen, event.clientX - box.left, event.clientY - box.top);
    if (picked) this.#options.onPick?.(picked);
  }

  /** Where each visible body lands on screen, the selection and spacecraft first. */
  #placeLabels(): void {
    const onScreen: ScreenBody[] = [];
    const point = new THREE.Vector3();
    const rank = (body: SceneBody) =>
      body.id === this.#selected ? 2 : body.kind === 'spacecraft' ? 1 : 0;
    const order = [...this.#drawn].sort((a, b) => rank(b.body) - rank(a.body));
    for (const { body, mesh, modelShown } of order) {
      if (!mesh.visible && !modelShown) continue;
      point.copy(mesh.position).project(this.#camera);
      // Outside -1…1 in depth means behind the camera or past the far plane.
      if (point.z < -1 || point.z > 1) continue;
      const distance = this.#camera.position.distanceTo(mesh.position);
      const lengthKm = modelShown ? this.#models?.lengthKm(body.id) : undefined;
      onScreen.push({
        id: body.id,
        x: ((point.x + 1) / 2) * this.#width,
        y: ((1 - point.y) / 2) * this.#height,
        radius: lengthKm
          ? apparentPx(lengthKm, distance, FOV_DEG, this.#height) / 2
          : mesh.scale.x / unitsPerPixel(distance, FOV_DEG, this.#height),
      });
    }
    this.#onScreen = onScreen;
    // Close up, the card names the spacecraft; a label beside a model that fills the
    // screen would float far off. It can still be tapped.
    const close = this.#drawn.find((drawn) => drawn.body.id === this.#focus)?.modelShown;
    this.#labels.place(
      close ? onScreen.filter(({ id }) => id !== this.#focus) : onScreen,
      this.#width,
      this.#height,
    );
    // For tests and tools: which spacecraft's model fills the view, if any.
    const canvas = this.#renderer.domElement;
    if (close) canvas.dataset.model = this.#focus;
    else delete canvas.dataset.model;
  }

  /**
   * Writes an orbit's points relative to the focus, in 64-bit before the GPU's 32. The
   * line passes through the planet, densest there (`orbitPathThrough`).
   */
  #placeOrbit(
    line: THREE.Line,
    elements: OrbitalElements,
    at: Vector3,
    origin: Vector3,
    center: Vector3 = [0, 0, 0],
  ): void {
    const vertices = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    // Elements are around `center` (the Sun, or a moon's planet).
    orbitPathThrough(elements, ORBIT_POINTS, subtract(at, center)).forEach((point, i) => {
      vertices.setXYZ(i, ...toScene(subtract(add(point, center), origin)));
    });
    vertices.needsUpdate = true;
  }

  /**
   * Turns a moon so the same face looks at its planet, as tidally locked moons do: its
   * longitude 0 towards the planet, its pole as near ecliptic north as that allows.
   */
  #faceParent(mesh: THREE.Mesh, at: Vector3, parent: Vector3): void {
    const meridian = normalize(subtract(parent, at));
    const north: Vector3 = [0, 0, 1];
    const pole = normalize(subtract(north, scale(meridian, dot(north, meridian))));
    const [x, y, z] = sphereBasis({ pole, meridian, east: cross(pole, meridian) }).map(
      (axis) => new THREE.Vector3(...axis),
    ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  /** Hides moons (and their orbits) too close to their planet on screen to tell apart. */
  #hideCrowdedMoons(): void {
    const [moon, planet] = [new THREE.Vector3(), new THREE.Vector3()];
    for (const drawn of this.#drawn) {
      if (!drawn.body.parent || !drawn.mesh.visible) continue;
      const parent = this.#drawn.find((other) => other.body.id === drawn.body.parent);
      if (!parent?.mesh.visible) continue;
      moon.copy(drawn.mesh.position).project(this.#camera);
      planet.copy(parent.mesh.position).project(this.#camera);
      const apartPx = Math.hypot(
        ((moon.x - planet.x) / 2) * this.#width,
        ((moon.y - planet.y) / 2) * this.#height,
      );
      const distance = this.#camera.position.distanceTo(parent.mesh.position);
      const planetPx = parent.mesh.scale.x / unitsPerPixel(distance, FOV_DEG, this.#height);
      const shows = apartPx > planetPx + MOON_CLEARANCE_PX;
      drawn.mesh.visible = shows;
      if (drawn.orbit) drawn.orbit.visible &&= shows;
    }
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

/**
 * Where to look at a spacecraft at `at` from for a close-up, as a unit vector from it:
 * `CLOSE_UP_PHASE_DEG` round from the Sun's direction, within the ecliptic, then up.
 */
function sunlitSide(at: Vector3): Vector3 {
  const toSun = normalize(scale(at, -1));
  const across = normalize(cross([0, 0, 1], toSun));
  const phase = radians(CLOSE_UP_PHASE_DEG);
  const flat = normalize(add(scale(toSun, Math.cos(phase)), scale(across, Math.sin(phase))));
  const up = radians(CLOSE_UP_ELEVATION_DEG);
  return normalize(add(scale(flat, Math.cos(up)), [0, 0, Math.sin(up)]));
}
