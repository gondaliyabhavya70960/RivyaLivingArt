import 'server-only'

import { ImageUtils, NodeIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRMaterialsVariants } from '@gltf-transform/extensions'
import { createDecoderModule } from 'draco3d'
import { MeshoptDecoder } from 'meshoptimizer/decoder'

import {
  type InspectionReport,
  type ModelFacts,
  type TextureFact,
  evaluateFacts,
  factsFromJson,
  quickInspect,
  readGlbJson,
  readGltfJson,
  trianglesFor,
} from './inspect'
import { MODEL_CEILINGS, type ModelFormat } from './model'

/**
 * The decoder pass: what the JSON cannot say.
 *
 * TWO THINGS ONLY. The DECODED triangle count — the same number the JSON declared, in practice,
 * but read from geometry a decoder actually produced, so a file whose Draco stream is broken is
 * refused here rather than in a visitor's browser — and every texture's pixel size, which needs
 * the image bytes. Everything else is `quickInspect()`, run first so a file the JSON condemns
 * never reaches a decoder.
 *
 * THE DECODERS ARE NODE'S. `draco3d` is the Node build of the same decoder the viewer serves from
 * `public/draco/`; `meshoptimizer/decoder` is the same module the viewer bundles. Both are
 * registered once and reused.
 */

let ioPromise: Promise<NodeIO> | null = null

function io(): Promise<NodeIO> {
  ioPromise ??= (async () => {
    const decoder = await createDecoderModule()
    await MeshoptDecoder.ready
    return new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'draco3d.decoder': decoder, 'meshopt.decoder': MeshoptDecoder })
  })()
  return ioPromise
}

function decodedTriangles(document: Document): number {
  let total = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices()
      const count =
        indices === null
          ? (primitive.getAttribute('POSITION')?.getCount() ?? 0)
          : indices.getCount()
      total += trianglesFor(primitive.getMode(), count)
    }
  }
  return total
}

function textureFacts(document: Document): readonly TextureFact[] {
  return document
    .getRoot()
    .listTextures()
    .map((texture) => {
      const image = texture.getImage()
      const mimeType =
        texture.getMimeType() || (image === null ? null : ImageUtils.getMimeType(image))
      const size = image === null || mimeType === null ? null : ImageUtils.getSize(image, mimeType)
      return { mimeType, width: size?.[0] ?? null, height: size?.[1] ?? null }
    })
}

function variantNames(document: Document): readonly string[] {
  const extension = document
    .getRoot()
    .listExtensionsUsed()
    .find((used): used is KHRMaterialsVariants => used instanceof KHRMaterialsVariants)
  return extension === undefined ? [] : extension.listVariants().map((variant) => variant.getName())
}

export async function inspectModel(
  bytes: Uint8Array,
  format: ModelFormat,
): Promise<InspectionReport> {
  const quick = quickInspect(bytes, format)
  // A file the JSON already refuses, or one no parser can read, stops here: spending a decoder on
  // it would only produce the same verdict more slowly.
  if (quick.rejections.some((r) => r.code !== 'too-large' && r.code !== 'compression-required')) {
    return quick
  }
  if (bytes.byteLength > MODEL_CEILINGS.rejectBytes) return quick

  const json = format === 'GLB' ? readGlbJson(bytes) : readGltfJson(bytes)
  if (json === null) return quick
  const declared = factsFromJson(json, format, bytes.byteLength)

  let document: Document
  try {
    const reader = await io()
    document =
      format === 'GLB'
        ? await reader.readBinary(bytes)
        : await reader.readJSON({
            json: json as Parameters<NodeIO['readJSON']>[0]['json'],
            resources: {},
          })
  } catch {
    return evaluateFacts(declared, [{ code: 'unparseable', detail: null }])
  }

  const textures = textureFacts(document)
  const sizes = textures.flatMap((t) => [t.width ?? 0, t.height ?? 0])
  const facts: ModelFacts = {
    ...declared,
    triangles: decodedTriangles(document),
    textureCount: textures.length,
    textures,
    maxTextureSize: sizes.length === 0 ? null : Math.max(...sizes),
    variants: variantNames(document),
    decoded: true,
  }
  return evaluateFacts(facts)
}

/**
 * The bytes of an uploaded model, from the delivery origin. A `content-length` above the ceiling
 * is refused before the body is read; a body that turns out larger is refused after.
 */
export async function fetchModelBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`model fetch failed: ${response.status}`)
  const declared = Number(response.headers.get('content-length') ?? '0')
  if (declared > MODEL_CEILINGS.rejectBytes * 2) throw new Error('model too large to inspect')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MODEL_CEILINGS.rejectBytes * 2)
    throw new Error('model too large to inspect')
  return bytes
}
