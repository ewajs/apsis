/** The Draco decoder for Node, as gltf-transform uses it (the package ships no types). */
declare module 'draco3dgltf' {
  const draco3d: {
    createDecoderModule(): Promise<unknown>;
    createEncoderModule(): Promise<unknown>;
  };
  export default draco3d;
}
