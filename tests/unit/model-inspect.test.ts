import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'
import { createDecoderModule, createEncoderModule } from 'draco3d'
import { MeshoptDecoder } from 'meshoptimizer/decoder'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  type ModelFacts,
  evaluateFacts,
  quickInspect,
  readGlbJson,
  trianglesFor,
} from '@/lib/media/inspect'
import { inspectModel } from '@/lib/media/inspect-server'

/**
 * The inspector, against files it builds itself.
 *
 * NO FIXTURE FILE IS COMMITTED. A GLB in the repository would be a model, and the phase ships with
 * none; the suite constructs each one in memory with gltf-transform — the same library the server
 * reads with — and throws it away. The Draco case runs the real encoder and the real decoder, so
 * "Draco decoders served from the origin" is backed by a decode that actually happened.
 */

const MB = 1024 * 1024

// A 1×1 transparent PNG.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

let io: NodeIO

beforeAll(async () => {
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.encoder': await createEncoderModule(),
    'draco3d.decoder': await createDecoderModule(),
    'meshopt.decoder': MeshoptDecoder,
  })
})

async function buildGlb({
  triangles,
  texture = false,
  draco = false,
}: {
  triangles: number
  texture?: boolean
  draco?: boolean
}): Promise<Uint8Array> {
  const document = new Document()
  const buffer = document.createBuffer()
  const vertexCount = triangles * 3
  const positions = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount; i += 1) {
    positions[i * 3] = i
    positions[i * 3 + 1] = (i * 7) % 11
    positions[i * 3 + 2] = (i * 13) % 17
  }
  const position = document.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)
  const indices = document
    .createAccessor()
    .setType('SCALAR')
    .setArray(Uint32Array.from({ length: vertexCount }, (_, i) => i))
    .setBuffer(buffer)
  const primitive = document
    .createPrimitive()
    .setAttribute('POSITION', position)
    .setIndices(indices)
    .setMode(4)

  if (texture) {
    const image = document.createTexture('base').setImage(PNG).setMimeType('image/png')
    primitive.setMaterial(document.createMaterial('material').setBaseColorTexture(image))
  }

  const mesh = document.createMesh('mesh').addPrimitive(primitive)
  const node = document.createNode('node').setMesh(mesh)
  document.createScene('scene').addChild(node)
  if (draco) document.createExtension(KHRDracoMeshCompression).setRequired(true)
  return io.writeBinary(document)
}

function facts(overrides: Partial<ModelFacts>): ModelFacts {
  return {
    format: 'GLB',
    bytes: 1 * MB,
    extensionsUsed: [],
    draco: false,
    meshopt: false,
    ktx2: false,
    selfContained: true,
    triangles: 1000,
    textureCount: 1,
    textures: [],
    maxTextureSize: 1024,
    variants: [],
    decoded: true,
    ...overrides,
  }
}

describe('evaluateFacts — the ceilings in words', () => {
  it('accepts a small, compressed-or-not model outright', () => {
    const report = evaluateFacts(facts({}))
    expect(report.ok).toBe(true)
    expect(report.rejections).toEqual([])
    expect(report.warnings).toEqual([])
  })

  it('refuses above 15 MB and names the size', () => {
    const report = evaluateFacts(facts({ bytes: 16 * MB, draco: true }))
    expect(report.rejections.map((r) => r.code)).toEqual(['too-large'])
  })

  it('refuses an uncompressed 6 MB file and accepts a compressed one', () => {
    expect(evaluateFacts(facts({ bytes: 6 * MB })).rejections.map((r) => r.code)).toEqual([
      'compression-required',
    ])
    expect(evaluateFacts(facts({ bytes: 6 * MB, draco: true })).ok).toBe(true)
    expect(evaluateFacts(facts({ bytes: 6 * MB, meshopt: true })).ok).toBe(true)
  })

  it('names BOTH reasons for a 20 MB uncompressed file', () => {
    const report = evaluateFacts(facts({ bytes: 20 * MB }))
    expect(report.rejections.map((r) => r.code).sort()).toEqual([
      'compression-required',
      'too-large',
    ])
  })

  it('warns from 8 MB, refuses from 15 MB', () => {
    expect(
      evaluateFacts(facts({ bytes: 9 * MB, draco: true })).warnings.map((w) => w.code),
    ).toEqual(['large'])
    expect(evaluateFacts(facts({ bytes: 15 * MB, draco: true })).ok).toBe(true)
    expect(evaluateFacts(facts({ bytes: 15 * MB + 1, draco: true })).ok).toBe(false)
  })

  it('warns at 150,001 triangles and refuses at 250,001', () => {
    expect(evaluateFacts(facts({ triangles: 150_001 })).warnings.map((w) => w.code)).toEqual([
      'many-triangles',
    ])
    expect(evaluateFacts(facts({ triangles: 250_000 })).ok).toBe(true)
    expect(evaluateFacts(facts({ triangles: 250_001 })).rejections.map((r) => r.code)).toEqual([
      'too-many-triangles',
    ])
  })

  it('refuses a texture over 2048px and warns above four textures', () => {
    expect(evaluateFacts(facts({ maxTextureSize: 4096 })).rejections.map((r) => r.code)).toEqual([
      'texture-too-large',
    ])
    expect(evaluateFacts(facts({ maxTextureSize: 2048 })).ok).toBe(true)
    expect(evaluateFacts(facts({ textureCount: 5 })).warnings.map((w) => w.code)).toEqual([
      'many-textures',
    ])
  })

  it('refuses a file that reaches outside itself', () => {
    expect(evaluateFacts(facts({ selfContained: false })).rejections.map((r) => r.code)).toEqual([
      'external-resources',
    ])
  })

  it('judges nothing it could not measure', () => {
    const report = evaluateFacts(
      facts({ triangles: null, maxTextureSize: null, textureCount: null }),
    )
    expect(report.ok).toBe(true)
  })
})

describe('trianglesFor', () => {
  it('counts lists, strips and fans, and nothing for lines or points', () => {
    expect(trianglesFor(4, 300)).toBe(100)
    expect(trianglesFor(5, 12)).toBe(10)
    expect(trianglesFor(6, 12)).toBe(10)
    expect(trianglesFor(1, 300)).toBe(0)
    expect(trianglesFor(0, 300)).toBe(0)
  })
})

describe('quickInspect — the decoder-free pass', () => {
  it('reads a GLB header and counts declared triangles and textures', async () => {
    const glb = await buildGlb({ triangles: 12, texture: true })
    const report = quickInspect(glb, 'GLB')
    expect(report.ok).toBe(true)
    expect(report.decoded).toBe(false)
    expect(report.triangles).toBe(12)
    expect(report.textureCount).toBe(1)
    expect(report.selfContained).toBe(true)
    expect(report.draco).toBe(false)
    expect(readGlbJson(glb)?.asset?.version).toBe('2.0')
  })

  it('sees Draco in the extensions list without decoding anything', async () => {
    const glb = await buildGlb({ triangles: 40, draco: true })
    const report = quickInspect(glb, 'GLB')
    expect(report.draco).toBe(true)
    expect(report.extensionsUsed).toContain('KHR_draco_mesh_compression')
    // Declared counts survive compression: the accessor still says how many.
    expect(report.triangles).toBe(40)
  })

  it('refuses a GLB presented as GLTF, and garbage as either', async () => {
    const glb = await buildGlb({ triangles: 1 })
    expect(quickInspect(glb, 'GLTF').rejections.map((r) => r.code)).toEqual(['wrong-format'])
    const garbage = new TextEncoder().encode('not a model')
    expect(quickInspect(garbage, 'GLB').rejections.map((r) => r.code)).toEqual(['unparseable'])
  })

  it('refuses a .gltf whose buffers live in other files', () => {
    const json = {
      asset: { version: '2.0' },
      buffers: [{ uri: 'model.bin', byteLength: 12 }],
      images: [{ uri: 'data:image/png;base64,AA==' }],
    }
    const report = quickInspect(new TextEncoder().encode(JSON.stringify(json)), 'GLTF')
    expect(report.selfContained).toBe(false)
    expect(report.rejections.map((r) => r.code)).toEqual(['external-resources'])
  })

  it('reads the KHR_materials_variants names', () => {
    const json = {
      asset: { version: '2.0' },
      extensionsUsed: ['KHR_materials_variants'],
      extensions: { KHR_materials_variants: { variants: [{ name: 'walnut' }, { name: 'oak' }] } },
    }
    const report = quickInspect(new TextEncoder().encode(JSON.stringify(json)), 'GLTF')
    expect(report.variants).toEqual(['walnut', 'oak'])
  })
})

describe('inspectModel — the decoder pass', () => {
  it('decodes a Draco-compressed GLB with the vendored decoder and counts its triangles', async () => {
    const glb = await buildGlb({ triangles: 64, draco: true })
    const report = await inspectModel(glb, 'GLB')
    expect(report.ok).toBe(true)
    expect(report.decoded).toBe(true)
    expect(report.draco).toBe(true)
    expect(report.triangles).toBe(64)
  })

  it('measures every texture', async () => {
    const glb = await buildGlb({ triangles: 2, texture: true })
    const report = await inspectModel(glb, 'GLB')
    expect(report.textureCount).toBe(1)
    expect(report.textures[0]).toEqual({ mimeType: 'image/png', width: 1, height: 1 })
    expect(report.maxTextureSize).toBe(1)
  })

  it('stops at the quick pass for a file the JSON already refuses', async () => {
    const glb = await buildGlb({ triangles: 1 })
    const report = await inspectModel(glb, 'GLTF')
    expect(report.decoded).toBe(false)
    expect(report.rejections.map((r) => r.code)).toEqual(['wrong-format'])
  })
})
