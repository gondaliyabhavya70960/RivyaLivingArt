import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ENVIRONMENT_PRESETS, LIGHTING_PRESETS, presetTokens } from '@/components/three/presets'
import {
  DRACO_DECODER_PATH,
  BASIS_TRANSCODER_PATH,
  ENVIRONMENT_PRESET_KEYS,
  LIGHTING_PRESET_KEYS,
  MODEL_CEILINGS,
  detectModelFormat,
  modelFileUrl,
  parseViewerSettings,
  probeCapability,
  publicVariantLabels,
  resolveViewerSettings,
  viewerSettingsSchema,
} from '@/lib/media/model'
import type { MediaAsset, ModelVariantLabel } from '@/lib/supabase/schemas'

/**
 * Phase 21's policy, held to the phase document.
 *
 * Three kinds of assertion. The ceilings, the settings shape and the capability gate are tested as
 * functions. The two copies of the settings shape — the Zod schema and `is_valid_viewer_settings()`
 * in 0194 — are compared by reading the migration, so they cannot drift apart silently. And four
 * files are read as text for what they must NOT contain: an external origin in the loader policy,
 * and any `three` import in the components that must cost the page nothing.
 */

const ROOT = process.cwd()
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8')

const MB = 1024 * 1024

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    provider: 'cloudinary',
    resource_type: 'raw',
    public_id: 'rivya/models/chair.glb',
    folder: 'rivya/models',
    filename: 'chair.glb',
    rivya_asset_id: null,
    kind: 'MODEL_3D',
    alt_text: 'A chair',
    is_ai_generated: false,
    is_concept: false,
    width: null,
    height: null,
    aspect_ratio: null,
    duration_s: null,
    uploaded_by: null,
    source: 'USER_UPLOAD',
    title: null,
    caption: null,
    tags: [],
    subject_tags: [],
    mime_type: 'model/gltf-binary',
    bytes: null,
    checksum: null,
    poster_public_id: null,
    model_format: 'GLB',
    file_size_bytes: null,
    poly_count: null,
    texture_count: null,
    model_thumbnail_id: null,
    model_poster_id: null,
    associated_product_id: null,
    associated_project_id: null,
    viewer_settings: {},
    higgsfield_generation_id: null,
    higgsfield_model: null,
    higgsfield_prompt: null,
    manifest_version: null,
    migrated_at: null,
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T00:00:00.000Z',
    updated_by: null,
    status: 'PUBLISHED',
    owner_verification: 'NOT_REQUIRED',
    fact_classification: null,
    published_at: null,
    published_by: null,
    ...overrides,
  } as MediaAsset
}

function label(overrides: Partial<ModelVariantLabel>): ModelVariantLabel {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    media_asset_id: '00000000-0000-4000-8000-000000000001',
    variant_key: 'walnut',
    label: 'Walnut',
    material_id: null,
    position: 0,
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: 'NOT_REQUIRED',
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T00:00:00.000Z',
    updated_by: null,
    ...overrides,
  }
}

describe('the ceilings (FEAT §14)', () => {
  it('are the phase document numbers', () => {
    expect(MODEL_CEILINGS.rejectBytes).toBe(15 * MB)
    expect(MODEL_CEILINGS.warnBytes).toBe(8 * MB)
    expect(MODEL_CEILINGS.compressionRequiredBytes).toBe(5 * MB)
    expect(MODEL_CEILINGS.rejectTriangles).toBe(250_000)
    expect(MODEL_CEILINGS.warnTriangles).toBe(150_000)
    expect(MODEL_CEILINGS.rejectTextureSize).toBe(2048)
    expect(MODEL_CEILINGS.warnTextureCount).toBe(4)
  })

  it('match the CHECK constraints in 0194', () => {
    const sql = read('supabase/migrations/0194_phase21_model_metadata.sql')
    expect(sql).toContain('file_size_bytes <= 15 * 1024 * 1024')
    expect(sql).toContain('poly_count <= 250000')
  })
})

describe('viewer_settings', () => {
  it('accepts the full documented shape', () => {
    const parsed = viewerSettingsSchema.safeParse({
      camera: { position: [1, 2, 3], target: [0, 0, 0], fov: 45 },
      exposure: 1.2,
      lightingPreset: 'low-key',
      environmentPreset: 'dark-gallery',
      autoRotate: true,
      minDistance: 1,
      maxDistance: 5,
    })
    expect(parsed.success).toBe(true)
  })

  it.each([
    ['an unknown key', { bogus: 1 }],
    ['a string exposure', { exposure: 'x' }],
    ['an exposure out of range', { exposure: 9 }],
    ['a two-component position', { camera: { position: [1, 2] } }],
    ['an unknown camera key', { camera: { roll: 1 } }],
    ['a fov below 10', { camera: { fov: 5 } }],
    ['min not below max', { minDistance: 2, maxDistance: 1 }],
    ['an unknown preset', { lightingPreset: 'sunset' }],
  ])('refuses %s', (_name, value) => {
    expect(viewerSettingsSchema.safeParse(value).success).toBe(false)
  })

  it('parses a malformed blob to the empty object rather than failing the page', () => {
    expect(parseViewerSettings({ exposure: 'x' })).toEqual({})
    expect(parseViewerSettings(null)).toEqual({})
    expect(parseViewerSettings({ exposure: 1.5 })).toEqual({ exposure: 1.5 })
  })

  it('resolves defaults without inventing a camera', () => {
    const resolved = resolveViewerSettings({})
    expect(resolved.lightingPreset).toBe('studio-soft')
    expect(resolved.environmentPreset).toBe('neutral-room')
    expect(resolved.exposure).toBe(1)
    expect(resolved.autoRotate).toBe(false)
    // The bounds are the loaded scene's to decide; nothing here guesses them.
    expect(resolved.camera.position).toBeNull()
    expect(resolved.camera.target).toBeNull()
    expect(resolved.minDistance).toBeNull()
    expect(resolved.maxDistance).toBeNull()
  })

  it('names exactly the keys and presets is_valid_viewer_settings() names', () => {
    const sql = read('supabase/migrations/0194_phase21_model_metadata.sql')
    const keyList =
      /value - array\[([^\]]+)\] = '\{\}'::jsonb\s+and \(not \(value \? 'camera'\)/.exec(sql)
    expect(keyList).not.toBeNull()
    const sqlKeys = [...(keyList?.[1] ?? '').matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]).sort()
    expect(sqlKeys).toEqual(Object.keys(viewerSettingsSchema.shape).sort())

    for (const key of LIGHTING_PRESET_KEYS) expect(sql).toContain(`'${key}'`)
    for (const key of ENVIRONMENT_PRESET_KEYS) expect(sql).toContain(`'${key}'`)
    expect(Object.keys(LIGHTING_PRESETS).sort()).toEqual([...LIGHTING_PRESET_KEYS].sort())
    expect(Object.keys(ENVIRONMENT_PRESETS).sort()).toEqual([...ENVIRONMENT_PRESET_KEYS].sort())
  })
})

describe('format and address', () => {
  it('detects GLB and GLTF from the MIME type first, then the name', () => {
    expect(detectModelFormat({ mimeType: 'model/gltf-binary' })).toBe('GLB')
    expect(detectModelFormat({ mimeType: 'model/gltf+json', filename: 'x.glb' })).toBe('GLTF')
    expect(detectModelFormat({ filename: 'Chair.GLB' })).toBe('GLB')
    expect(detectModelFormat({ publicId: 'rivya/models/chair.gltf' })).toBe('GLTF')
    expect(detectModelFormat({ mimeType: 'image/png', filename: 'chair.png' })).toBeNull()
    expect(detectModelFormat({})).toBeNull()
  })

  it('builds a raw delivery URL on the origin every image uses, and nothing for a non-model', () => {
    expect(modelFileUrl('demo', asset())).toBe(
      'https://res.cloudinary.com/demo/raw/upload/rivya/models/chair.glb',
    )
    expect(modelFileUrl('', asset())).toBeNull()
    expect(modelFileUrl('demo', asset({ kind: 'IMAGE', resource_type: 'image' }))).toBeNull()
  })
})

describe('the capability gate (FEAT §14)', () => {
  const wide = {
    wideViewport: true,
    reducedMotion: false,
    saveData: false,
    lowMemory: false,
    webgl: true,
  }

  it('offers and auto-loads on a wide screen with motion and no constraint', () => {
    expect(probeCapability(wide)).toEqual({
      offered: true,
      autoLoad: true,
      fullscreenByDefault: false,
      reasons: [],
    })
  })

  it.each([
    ['saveData', { ...wide, saveData: true }, 'save-data'],
    ['deviceMemory < 4', { ...wide, lowMemory: true }, 'low-memory'],
    ['no WebGL', { ...wide, webgl: false }, 'no-webgl'],
  ])('does not offer the viewer under %s', (_name, input, reason) => {
    const capability = probeCapability(input)
    expect(capability.offered).toBe(false)
    expect(capability.autoLoad).toBe(false)
    expect(capability.reasons).toContain(reason)
  })

  it('is opt-in only under reduced motion', () => {
    const capability = probeCapability({ ...wide, reducedMotion: true })
    expect(capability.offered).toBe(true)
    expect(capability.autoLoad).toBe(false)
  })

  it('is opt-in and fullscreen by default below 768px', () => {
    const capability = probeCapability({ ...wide, wideViewport: false })
    expect(capability.offered).toBe(true)
    expect(capability.autoLoad).toBe(false)
    expect(capability.fullscreenByDefault).toBe(true)
  })
})

describe('variant labels (D10)', () => {
  it('hands the material to the public viewer only at VERIFIED', () => {
    const material = '00000000-0000-4000-8000-0000000000bb'
    const rows = [
      label({
        variant_key: 'b',
        position: 1,
        material_id: material,
        owner_verification: 'OWNER_VERIFICATION_REQUIRED',
      }),
      label({
        variant_key: 'a',
        position: 0,
        material_id: material,
        owner_verification: 'VERIFIED',
      }),
      label({ variant_key: 'c', position: 2 }),
    ]
    expect(publicVariantLabels(rows)).toEqual([
      { variantKey: 'a', label: 'Walnut', materialId: material, position: 0 },
      { variantKey: 'b', label: 'Walnut', materialId: null, position: 1 },
      { variantKey: 'c', label: 'Walnut', materialId: null, position: 2 },
    ])
  })
})

describe('what the files must not contain', () => {
  it('names no external origin in the loader policy', () => {
    const source = read('lib/media/model.ts')
    expect(source).not.toMatch(/https?:\/\//)
    expect(source).not.toMatch(/\/\/[a-z0-9-]+\.[a-z]{2,}/i)
    expect(DRACO_DECODER_PATH.startsWith('/')).toBe(true)
    expect(BASIS_TRANSCODER_PATH.startsWith('/')).toBe(true)
  })

  it('serves both decoder paths from public/', () => {
    for (const file of ['draco_wasm_wrapper.js', 'draco_decoder.wasm']) {
      expect(() => read(`public${DRACO_DECODER_PATH}${file}`)).not.toThrow()
    }
    for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
      expect(() => read(`public${BASIS_TRANSCODER_PATH}${file}`)).not.toThrow()
    }
  })

  it.each([
    'components/three/DimensionOverlay.tsx',
    'components/three/PosterFallback.tsx',
    'components/three/types.ts',
    'components/patterns/ModelViewerMount/index.tsx',
  ])('keeps %s free of the engine', (path) => {
    const source = read(path)
    expect(source).not.toMatch(/from ['"]three['"]/)
    expect(source).not.toMatch(/from ['"]three\//)
    expect(source).not.toMatch(/from ['"]@react-three/)
  })

  it('reaches the viewer only through a dynamic import with ssr off', () => {
    const source = read('components/patterns/ModelViewerMount/Island.tsx')
    expect(source).toMatch(/import\('@\/components\/three\/ModelViewer'\)/)
    expect(source).toMatch(/ssr: false/)
    // No static import of the viewer, the canvas or the engine.
    expect(source).not.toMatch(
      /^import .* from '@\/components\/three\/(ModelViewer|ViewerCanvas)'/m,
    )
    expect(source).not.toMatch(/from ['"]three/)
    expect(source).not.toMatch(/from ['"]@react-three/)
  })

  it('renders dimensions the server parsed from products.dimensions and never from geometry', () => {
    const source = read('components/three/DimensionOverlay.tsx')
    expect(source).toMatch(/import type \{ DimensionFact \} from '\.\/types'/)
    expect(source).not.toMatch(/Box3|boundingBox|geometry|\.scene\b|useLoader|useThree/)
    const mount = read('components/patterns/ModelViewerMount/index.tsx')
    expect(mount).toContain("from '@/lib/catalog/dimensions'")
  })

  it('keeps zod out of the viewer chunk and the island', () => {
    // The viewer and the island read `lib/media/viewer-settings`, which has no schema library;
    // `lib/media/model.ts` is the Zod boundary and is the server's and the Studio's to import.
    expect(read('lib/media/viewer-settings.ts')).not.toMatch(/from ['"]zod['"]/)
    for (const path of [
      'components/three/ModelViewer.tsx',
      'components/three/ViewerCanvas.tsx',
      'components/three/loader.ts',
      'components/three/LoadingProgress.tsx',
      'components/three/DimensionOverlay.tsx',
      'components/three/presets.ts',
      'components/patterns/ModelViewerMount/Island.tsx',
    ]) {
      const source = read(path)
      expect(source, path).not.toMatch(/from ['"]zod['"]/)
      expect(source, path).not.toMatch(/^import (?!type).*from '@\/lib\/media\/model'/m)
      expect(source, path).not.toMatch(/^import (?!type).*from '@\/lib\/catalog\/dimensions'/m)
    }
  })
})

describe('presets', () => {
  it('name only tokens that tokens.css declares, and carry no colour literal of their own', () => {
    const css = read('app/styles/tokens.css')
    for (const { token } of presetTokens()) {
      const match = new RegExp(`${token.replace(/[-]/g, '\\-')}:\\s*([^;]+);`).exec(css)
      expect(match, token).not.toBeNull()
    }
    // The palette lives in app/styles/ and nowhere else (design:check-tokens); a fallback hex here
    // would hide a mistyped token behind a plausible colour.
    expect(read('components/three/presets.ts')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })

  it('fetch nothing: no environment map, no texture, no URL', () => {
    const source = read('components/three/presets.ts')
    expect(source).not.toMatch(/https?:\/\/|\.hdr|\.exr|TextureLoader|RGBELoader/)
  })
})
