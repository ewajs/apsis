/**
 * Spacecraft models in the 3D view (ADR 0005, 0013): each loads the first time the
 * camera comes close enough for it to matter, and is drawn at true size, in metres,
 * once it's bigger on screen than the spacecraft's marker. See docs/guides/models.md.
 */
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { ModelEntry } from '../core/models.ts';

/** Models are in metres; the scene is in km. */
const KM_PER_M = 1e-3;
/**
 * How strongly models reflect a soft studio surround, besides the Sun. In space there's
 * nothing else to reflect and metal goes black; studio renders of spacecraft cheat the
 * same way. Planets don't get it: their night sides stay dark.
 */
const FILL = 0.45;

/** A model, loaded or on its way. */
type Slot = { state: 'loading' } | { state: 'ready'; object: THREE.Object3D } | { state: 'failed' };

/** The models the app has, and the ones loaded so far. */
export class CraftModels {
  #base: string;
  #entries: Map<string, ModelEntry>;
  #slots = new Map<string, Slot>();
  #loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  #makeFill: () => THREE.Texture;
  #fill: THREE.Texture | undefined;
  #onLoad: () => void;

  /**
   * @param base The models folder's URL, ending in `/`.
   * @param entries The models there are (`loadModels`).
   * @param makeFill Makes the surround models reflect (a prefiltered environment); called
   *   once, when the first model arrives.
   * @param onLoad Called whenever a model finishes loading (to redraw).
   */
  constructor(
    base: string,
    entries: readonly ModelEntry[],
    makeFill: () => THREE.Texture,
    onLoad: () => void,
  ) {
    this.#base = base;
    this.#entries = new Map(entries.map((entry) => [entry.id, entry]));
    this.#makeFill = makeFill;
    this.#onLoad = onLoad;
  }

  /** What a spacecraft's model faces in flight (Earth unless it says the Sun). */
  pointing(id: string): 'earth' | 'sun' {
    return this.#entries.get(id)?.pointing ?? 'earth';
  }

  /** A spacecraft's size in km, if it has a model. */
  lengthKm(id: string): number | undefined {
    const entry = this.#entries.get(id);
    return entry ? entry.lengthM * KM_PER_M : undefined;
  }

  /**
   * The model, if it has loaded; asking starts the load. The object is in km (scaled from
   * the file's metres), to be placed and turned by the caller.
   */
  get(id: string): THREE.Object3D | undefined {
    const slot = this.#slots.get(id);
    if (slot) return slot.state === 'ready' ? slot.object : undefined;
    const entry = this.#entries.get(id);
    if (!entry) return undefined;
    this.#slots.set(id, { state: 'loading' });
    this.#loader.load(
      `${this.#base}${entry.file}`,
      (gltf) => {
        this.#fill ??= this.#makeFill();
        const fill = this.#fill;
        gltf.scene.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          for (const material of [node.material].flat()) {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.envMap = fill;
              material.envMapIntensity = FILL;
            }
          }
        });
        const object = new THREE.Group();
        object.name = `model:${id}`;
        gltf.scene.scale.setScalar(KM_PER_M);
        object.add(gltf.scene);
        this.#slots.set(id, { state: 'ready', object });
        this.#onLoad();
      },
      undefined,
      (error) => {
        console.error(error);
        this.#slots.set(id, { state: 'failed' });
      },
    );
    return undefined;
  }
}
