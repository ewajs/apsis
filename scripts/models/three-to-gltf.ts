/**
 * Turns a three.js object (meshes with standard materials) into a glTF document, in
 * Node: three's own exporter needs a browser (FileReader), gltf-transform doesn't. Used
 * for our own models, built in code from three's geometries (docs/guides/models.md).
 */
import { Document, type Material, type Node as GltfNode } from '@gltf-transform/core';
import * as THREE from 'three';

/**
 * A glTF document with one scene holding `root`'s meshes, their transforms and
 * materials (colour, metalness, roughness, emission, double-sidedness). Textures aren't
 * carried: our models are made of flat-coloured parts.
 */
export function threeToDocument(root: THREE.Object3D): Document {
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(root.name || 'model');
  const materials = new Map<THREE.Material, Material>();

  const material = (source: THREE.Material): Material => {
    const known = materials.get(source);
    if (known) return known;
    const standard = source as THREE.MeshStandardMaterial;
    const color = standard.color ?? new THREE.Color(1, 1, 1);
    const emissive = standard.emissive ?? new THREE.Color(0, 0, 0);
    const made = document
      .createMaterial(source.name || 'material')
      .setBaseColorFactor([color.r, color.g, color.b, source.opacity])
      .setMetallicFactor(standard.metalness ?? 0)
      .setRoughnessFactor(standard.roughness ?? 1)
      .setEmissiveFactor([emissive.r, emissive.g, emissive.b])
      .setDoubleSided(source.side === THREE.DoubleSide);
    if (source.transparent) made.setAlphaMode('BLEND');
    materials.set(source, made);
    return made;
  };

  const convert = (object: THREE.Object3D): GltfNode => {
    const node = document
      .createNode(object.name)
      .setTranslation(object.position.toArray())
      .setRotation(object.quaternion.toArray() as [number, number, number, number])
      .setScale(object.scale.toArray());
    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry as THREE.BufferGeometry;
      const primitive = document.createPrimitive().setMaterial(material(object.material));
      const attribute = (name: string, glName: string, type: 'VEC2' | 'VEC3') => {
        const source = geometry.getAttribute(name);
        if (!source) return;
        primitive.setAttribute(
          glName,
          document
            .createAccessor()
            .setType(type)
            .setArray(new Float32Array(source.array as ArrayLike<number>))
            .setBuffer(buffer),
        );
      };
      attribute('position', 'POSITION', 'VEC3');
      attribute('normal', 'NORMAL', 'VEC3');
      attribute('uv', 'TEXCOORD_0', 'VEC2');
      if (geometry.index) {
        primitive.setIndices(
          document
            .createAccessor()
            .setType('SCALAR')
            .setArray(new Uint32Array(geometry.index.array as ArrayLike<number>))
            .setBuffer(buffer),
        );
      }
      node.setMesh(document.createMesh(object.name).addPrimitive(primitive));
    }
    for (const child of object.children) node.addChild(convert(child));
    return node;
  };

  scene.addChild(convert(root));
  return document;
}
