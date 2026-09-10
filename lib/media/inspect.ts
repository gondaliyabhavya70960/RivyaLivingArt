import { MODEL_CEILINGS, type ModelFormat } from './model'

/**
 * Model inspection, the part that needs no decoder.
 *
 * ISOMORPHIC ON PURPOSE. A GLB's first chunk is JSON, and that JSON already says most of what the
 * ceilings need to know: how many bytes (the file), which extensions are used (so whether it is
 * compressed), how many triangles (every primitive's accessor declares its count, compressed or
 * not), how many textures, which variants, and whether any buffer or image lives outside the file.
 * The browser runs this BEFORE signing an upload, so a 20 MB uncompressed file is refused with
 * both reasons named and nothing has left the machine. The server runs it again on the bytes it
 * fetched, then goes on to `inspect-server.ts` for what needs a decoder: the decoded triangle
 * count and every texture's pixel size.
 *
 * WHAT A REJECTION MEANS. The row is not written. The inspector reports and refuses; it never
 * repairs, re-encodes or resizes (out of scope by the phase document — preparation happens before
 * upload). A warning is recorded on the row and shown, and the upload proceeds.
 */

export type RejectionCode =
  | 'wrong-format'
  | 'unparseable'
  | 'too-large'
  | 'compression-required'
  | 'too-many-triangles'
  | 'texture-too-large'
  | 'external-resources'

export type WarningCode = 'large' | 'many-triangles' | 'many-textures'

export type Finding<Code extends string> = {
  readonly code: Code
  /** The measured number or name the code is about, for the message. */
  readonly detail: string | null
}

export type TextureFact = {
  readonly mimeType: string | null
  readonly width: number | null
  readonly height: number | null
}

/** What was measured. `null` where this pass could not measure it. */
export type ModelFacts = {
  readonly format: ModelFormat
  readonly bytes: number
  readonly extensionsUsed: readonly string[]
  readonly draco: boolean
  readonly meshopt: boolean
  readonly ktx2: boolean
  /** Every buffer and image is inside the file (a GLB chunk or a data URI). */
  readonly selfContained: boolean
  readonly triangles: number | null
  readonly textureCount: number | null
  readonly textures: readonly TextureFact[]
  readonly maxTextureSize: number | null
  readonly variants: readonly string[]
  /** `true` once a decoder has read the geometry; the quick pass reports declared counts. */
  readonly decoded: boolean
}

export type InspectionReport = ModelFacts & {
  readonly ok: boolean
  readonly rejections: readonly Finding<RejectionCode>[]
  readonly warnings: readonly Finding<WarningCode>[]
}

export const DRACO_EXTENSION = 'KHR_draco_mesh_compression'
export const MESHOPT_EXTENSION = 'EXT_meshopt_compression'
export const KTX2_EXTENSION = 'KHR_texture_basisu'
export const VARIANTS_EXTENSION_NAME = 'KHR_materials_variants'

// --- The ceilings, applied ------------------------------------------------------------------------

/**
 * Facts in, verdict out. Pure, so the unit suite can hold every ceiling to its number without a
 * file, and so the browser and the server cannot disagree about what a fact means.
 */
export function evaluateFacts(
  facts: ModelFacts,
  extra: readonly Finding<RejectionCode>[] = [],
): InspectionReport {
  const rejections: Finding<RejectionCode>[] = [...extra]
  const warnings: Finding<WarningCode>[] = []
  const compressed = facts.draco || facts.meshopt

  if (facts.bytes > MODEL_CEILINGS.rejectBytes) {
    rejections.push({ code: 'too-large', detail: String(facts.bytes) })
  } else if (facts.bytes > MODEL_CEILINGS.warnBytes) {
    warnings.push({ code: 'large', detail: String(facts.bytes) })
  }
  if (facts.bytes > MODEL_CEILINGS.compressionRequiredBytes && !compressed) {
    rejections.push({ code: 'compression-required', detail: String(facts.bytes) })
  }
  if (!facts.selfContained) {
    rejections.push({ code: 'external-resources', detail: null })
  }
  if (facts.triangles !== null) {
    if (facts.triangles > MODEL_CEILINGS.rejectTriangles) {
      rejections.push({ code: 'too-many-triangles', detail: String(facts.triangles) })
    } else if (facts.triangles > MODEL_CEILINGS.warnTriangles) {
      warnings.push({ code: 'many-triangles', detail: String(facts.triangles) })
    }
  }
  if (facts.maxTextureSize !== null && facts.maxTextureSize > MODEL_CEILINGS.rejectTextureSize) {
    rejections.push({ code: 'texture-too-large', detail: String(facts.maxTextureSize) })
  }
  if (facts.textureCount !== null && facts.textureCount > MODEL_CEILINGS.warnTextureCount) {
    warnings.push({ code: 'many-textures', detail: String(facts.textureCount) })
  }

  return { ...facts, ok: rejections.length === 0, rejections, warnings }
}

// --- Reading the JSON without a decoder ----------------------------------------------------------

const GLB_MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a // 'JSON'

type GltfJson = {
  readonly asset?: { readonly version?: string }
  readonly extensionsUsed?: readonly string[]
  readonly extensions?: Record<string, unknown>
  readonly buffers?: readonly { readonly uri?: string }[]
  readonly images?: readonly { readonly uri?: string; readonly bufferView?: number }[]
  readonly textures?: readonly unknown[]
  readonly accessors?: readonly { readonly count?: number }[]
  readonly meshes?: readonly {
    readonly primitives?: readonly {
      readonly mode?: number
      readonly indices?: number
      readonly attributes?: Record<string, number>
    }[]
  }[]
}

/** The JSON chunk of a GLB, or null when the header is not a glTF 2 binary. */
export function readGlbJson(bytes: Uint8Array): GltfJson | null {
  if (bytes.byteLength < 20) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== GLB_MAGIC) return null
  if (view.getUint32(4, true) !== 2) return null
  const chunkLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== CHUNK_JSON) return null
  if (20 + chunkLength > bytes.byteLength) return null
  try {
    const text = new TextDecoder('utf-8').decode(bytes.subarray(20, 20 + chunkLength))
    return JSON.parse(text) as GltfJson
  } catch {
    return null
  }
}

/** A `.gltf` file's JSON, or null when it is not JSON or not glTF 2. */
export function readGltfJson(bytes: Uint8Array): GltfJson | null {
  try {
    const json = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as GltfJson
    return typeof json === 'object' && json !== null && json.asset !== undefined ? json : null
  } catch {
    return null
  }
}

function isExternal(uri: string | undefined): boolean {
  return uri !== undefined && !uri.startsWith('data:')
}

/** Triangles, from the declared accessor counts. Compression does not change a count. */
export function declaredTriangles(json: GltfJson): number {
  let total = 0
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const mode = primitive.mode ?? 4
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION
      const count = accessorIndex === undefined ? 0 : (json.accessors?.[accessorIndex]?.count ?? 0)
      total += trianglesFor(mode, count)
    }
  }
  return total
}

/** WebGL draw modes: 4 TRIANGLES, 5 TRIANGLE_STRIP, 6 TRIANGLE_FAN. Anything else draws none. */
export function trianglesFor(mode: number, count: number): number {
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function variantNamesOf(json: GltfJson): readonly string[] {
  const extension = json.extensions?.[VARIANTS_EXTENSION_NAME] as
    { readonly variants?: readonly { readonly name?: string }[] } | undefined
  return (extension?.variants ?? []).map((variant, index) => variant.name ?? `variant_${index}`)
}

/** Everything the JSON alone can say. */
export function factsFromJson(json: GltfJson, format: ModelFormat, bytes: number): ModelFacts {
  const extensionsUsed = json.extensionsUsed ?? []
  const textures = json.textures ?? []
  return {
    format,
    bytes,
    extensionsUsed,
    draco: extensionsUsed.includes(DRACO_EXTENSION),
    meshopt: extensionsUsed.includes(MESHOPT_EXTENSION),
    ktx2: extensionsUsed.includes(KTX2_EXTENSION),
    selfContained:
      !(json.buffers ?? []).some((buffer) => isExternal(buffer.uri)) &&
      !(json.images ?? []).some((image) => isExternal(image.uri)),
    triangles: declaredTriangles(json),
    textureCount: textures.length,
    textures: textures.map(() => ({ mimeType: null, width: null, height: null })),
    maxTextureSize: null,
    variants: variantNamesOf(json),
    decoded: false,
  }
}

const EMPTY_FACTS = (format: ModelFormat, bytes: number): ModelFacts => ({
  format,
  bytes,
  extensionsUsed: [],
  draco: false,
  meshopt: false,
  ktx2: false,
  selfContained: true,
  triangles: null,
  textureCount: null,
  textures: [],
  maxTextureSize: null,
  variants: [],
  decoded: false,
})

/**
 * The decoder-free pass. Runs in the browser before the upload is signed and on the server before
 * the decoder is spent on a file the JSON already condemns.
 */
export function quickInspect(bytes: Uint8Array, format: ModelFormat): InspectionReport {
  const json = format === 'GLB' ? readGlbJson(bytes) : readGltfJson(bytes)
  if (json === null) {
    const other = format === 'GLB' ? readGltfJson(bytes) : readGlbJson(bytes)
    return evaluateFacts(EMPTY_FACTS(format, bytes.byteLength), [
      { code: other === null ? 'unparseable' : 'wrong-format', detail: null },
    ])
  }
  return evaluateFacts(factsFromJson(json, format, bytes.byteLength))
}
