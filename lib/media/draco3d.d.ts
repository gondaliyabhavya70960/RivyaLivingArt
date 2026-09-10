/**
 * `draco3d` ships no types. The two factories are all the inspector uses; the modules they resolve
 * are handed straight to gltf-transform, which types them as `unknown` on its side too.
 */
declare module 'draco3d' {
  export function createDecoderModule(config?: object): Promise<unknown>
  export function createEncoderModule(config?: object): Promise<unknown>
}
