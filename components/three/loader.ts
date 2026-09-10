import { MeshoptDecoder } from 'meshoptimizer/decoder'
import type { WebGLRenderer } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

import { variantsPlugin } from './variants'
import { BASIS_TRANSCODER_PATH, DRACO_DECODER_PATH } from '@/lib/media/model'

/**
 * One place that knows how a GLB is decoded.
 *
 * THREE DECODERS, TWO FETCHED AND ONE BUNDLED, ALL FROM THE ORIGIN (amendment A21). Draco reads
 * its wrapper and WebAssembly from `/draco/`, the Basis transcoder reads from `/basis/`, and the
 * meshopt decoder is a module with its WebAssembly embedded, so it arrives inside this chunk.
 * `lib/media/model.ts` owns the two paths; this file is the only one that hands them to `three`.
 *
 * THE LOADERS ARE SHARED, NOT PER-MODEL. A `DRACOLoader` spins up a worker pool; making one per
 * viewer mount would make a page with two models pay twice. They are created lazily on the first
 * configure and live for the session.
 */

let draco: DRACOLoader | null = null
let ktx2: KTX2Loader | null = null

export function configureLoader(loader: GLTFLoader, gl: WebGLRenderer): void {
  draco ??= new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH)
  ktx2 ??= new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH)
  // Which compressed texture formats the GPU accepts is a property of this renderer; it costs a
  // few capability queries and must happen before the first KTX2 texture is parsed.
  ktx2.detectSupport(gl)

  loader.setDRACOLoader(draco)
  loader.setKTX2Loader(ktx2)
  loader.setMeshoptDecoder(MeshoptDecoder)
  loader.register(variantsPlugin)
}
