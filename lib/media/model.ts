import { z } from 'zod'

import { rawUrl } from './url'
import type { MediaAsset, ModelVariantLabel } from '@/lib/supabase/schemas'

/**
 * Loader policy for the Phase 21 model viewer: where the decoders are, what a model may weigh,
 * what `viewer_settings` may say, and when a page may offer the viewer at all.
 *
 * ISOMORPHIC AND DEPENDENCY-FREE, ON PURPOSE. This module is imported by the server (the mount
 * points and the Studio inspector), by the client island that decides whether to load the viewer,
 * and by the viewer itself. It therefore imports no `three`, no React and nothing server-only:
 * a `three` import here would put the whole engine in every product page's first load, which is
 * the one thing FEAT §14 forbids.
 *
 * NO EXTERNAL ORIGIN APPEARS IN THIS FILE, and `tests/unit/model-policy.test.ts` reads the source
 * to prove it. The decoders are vendored under `public/` (amendment A21); a CDN path here would
 * be a runtime fetch outside the origin, which breaks offline, breaks under the CSP, and puts a
 * third party between the visitor and the page.
 *
 * THE CEILINGS ARE THE DATABASE'S, REPEATED. `0194` holds 15 MB and 250,000 triangles as CHECK
 * constraints; the inspector rejects at the same numbers and WARNS earlier (8 MB, 150,000). Both
 * copies exist because the inspector can say why in words and the constraint cannot be bypassed.
 */

// --- Decoders ------------------------------------------------------------------------------------

/** `DRACOLoader.setDecoderPath()`. Serves `public/draco/**`, vendored from three@0.186.0. */
export const DRACO_DECODER_PATH = '/draco/'
/** `KTX2Loader.setTranscoderPath()`. Serves `public/basis/**`, vendored from three@0.186.0. */
export const BASIS_TRANSCODER_PATH = '/basis/'

// --- Ceilings (FEAT §14, PERFORMANCE.md §4.3) --------------------------------------------------------

const MB = 1024 * 1024

export const MODEL_CEILINGS = {
  /** Refused, by the inspector and by `media_assets_model_size_ceiling`. */
  rejectBytes: 15 * MB,
  /** Accepted with a warning. PERFORMANCE.md §4.3's per-GLB budget. */
  warnBytes: 8 * MB,
  /** Above this, Draco or meshopt compression is required or the file is refused. */
  compressionRequiredBytes: 5 * MB,
  /** Refused, by the inspector and by `media_assets_model_triangle_ceiling`. */
  rejectTriangles: 250_000,
  warnTriangles: 150_000,
  /** Any texture wider or taller than this is refused. */
  rejectTextureSize: 2048,
  /** More textures than this is a warning. */
  warnTextureCount: 4,
} as const

// --- Format ----------------------------------------------------------------------------------------

export type ModelFormat = 'GLB' | 'GLTF'

const MIME_TO_FORMAT: Readonly<Record<string, ModelFormat>> = {
  'model/gltf-binary': 'GLB',
  'model/gltf+json': 'GLTF',
}

/**
 * GLB or GLTF, from whatever the caller has — a MIME type first, then a filename or public id.
 *
 * The MIME type wins when it is one of the two the upload allowlist admits. It is consulted first
 * because a browser reports it from the file's own signature more reliably than an extension a
 * person typed; the name is the fallback for a Cloudinary public id, which carries no MIME type.
 */
export function detectModelFormat(input: {
  readonly mimeType?: string | null
  readonly filename?: string | null
  readonly publicId?: string | null
}): ModelFormat | null {
  const mime = input.mimeType?.toLowerCase().split(';')[0]?.trim()
  if (mime !== undefined && mime in MIME_TO_FORMAT) return MIME_TO_FORMAT[mime] ?? null

  for (const name of [input.filename, input.publicId]) {
    const lower = name?.toLowerCase() ?? ''
    if (lower.endsWith('.glb')) return 'GLB'
    if (lower.endsWith('.gltf')) return 'GLTF'
  }
  return null
}

/**
 * The address the viewer fetches. A raw Cloudinary URL on the delivery host every image already
 * uses; null when the row is not a model or the environment has no cloud name.
 */
export function modelFileUrl(cloudName: string, asset: MediaAsset): string | null {
  if (cloudName === '' || asset.kind !== 'MODEL_3D' || asset.resource_type !== 'raw') return null
  return rawUrl(cloudName, { publicId: asset.public_id, resourceType: 'raw' })
}

// --- viewer_settings -----------------------------------------------------------------------------

export const LIGHTING_PRESET_KEYS = [
  'studio-soft',
  'gallery-directional',
  'daylight-window',
  'low-key',
] as const
export type LightingPresetKey = (typeof LIGHTING_PRESET_KEYS)[number]

export const ENVIRONMENT_PRESET_KEYS = ['neutral-room', 'dark-gallery', 'warm-interior'] as const
export type EnvironmentPresetKey = (typeof ENVIRONMENT_PRESET_KEYS)[number]

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])

/**
 * The same shape `is_valid_viewer_settings()` enforces at the row (0194). Strict objects, so an
 * unknown key is a parse failure here exactly as it is a refused row there: the two copies must
 * agree, and `tests/unit/model-policy.test.ts` holds them to it.
 */
export const viewerSettingsSchema = z
  .strictObject({
    camera: z
      .strictObject({
        position: vec3.optional(),
        target: vec3.optional(),
        fov: z.number().min(10).max(120).optional(),
      })
      .optional(),
    exposure: z.number().min(0.1).max(4).optional(),
    lightingPreset: z.enum(LIGHTING_PRESET_KEYS).optional(),
    environmentPreset: z.enum(ENVIRONMENT_PRESET_KEYS).optional(),
    autoRotate: z.boolean().optional(),
    minDistance: z.number().positive().optional(),
    maxDistance: z.number().positive().optional(),
  })
  .refine(
    (value) =>
      value.minDistance === undefined ||
      value.maxDistance === undefined ||
      value.minDistance < value.maxDistance,
    { message: 'minDistance must be below maxDistance', path: ['maxDistance'] },
  )

export type ViewerSettings = z.infer<typeof viewerSettingsSchema>

/**
 * `media_assets.viewer_settings`, parsed. A malformed blob — which the constraint should have
 * refused, but a schema is a boundary and not a belief — yields the empty object, so the viewer
 * falls back to its defaults rather than failing to mount over a setting.
 */
export function parseViewerSettings(value: unknown): ViewerSettings {
  const parsed = viewerSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : {}
}

export type ResolvedViewerSettings = {
  readonly camera: {
    readonly position: readonly [number, number, number] | null
    readonly target: readonly [number, number, number] | null
    readonly fov: number
  }
  readonly exposure: number
  readonly lightingPreset: LightingPresetKey
  readonly environmentPreset: EnvironmentPresetKey
  readonly autoRotate: boolean
  readonly minDistance: number | null
  readonly maxDistance: number | null
}

export const DEFAULT_FOV = 40

/**
 * Settings with every default filled in. Camera position, target and the distance bounds stay
 * null when unset: they depend on the model's bounds, which only the loaded scene knows, and the
 * viewer fits them at mount. Everything else has a value here so a consumer never re-decides it.
 */
export function resolveViewerSettings(settings: ViewerSettings): ResolvedViewerSettings {
  return {
    camera: {
      position: settings.camera?.position ?? null,
      target: settings.camera?.target ?? null,
      fov: settings.camera?.fov ?? DEFAULT_FOV,
    },
    exposure: settings.exposure ?? 1,
    lightingPreset: settings.lightingPreset ?? 'studio-soft',
    environmentPreset: settings.environmentPreset ?? 'neutral-room',
    autoRotate: settings.autoRotate ?? false,
    minDistance: settings.minDistance ?? null,
    maxDistance: settings.maxDistance ?? null,
  }
}

// --- Capability probe (FEAT §14) -----------------------------------------------------------------

export const VIEWER_MIN_VIEWPORT = 768

export type CapabilityInput = {
  /** `matchMedia('(min-width: 768px)')`. */
  readonly wideViewport: boolean
  /** `prefers-reduced-motion: reduce`. */
  readonly reducedMotion: boolean
  /** `navigator.connection.saveData === true`. */
  readonly saveData: boolean
  /** `navigator.deviceMemory < 4`. Unreported memory is NOT low. */
  readonly lowMemory: boolean
  /** A WebGL context could be created. */
  readonly webgl: boolean
}

export type CapabilityReason = 'save-data' | 'low-memory' | 'no-webgl'

export type Capability = {
  /** The control is shown at all. False means the poster is the whole experience. */
  readonly offered: boolean
  /** The viewer may load on intersection without a click. */
  readonly autoLoad: boolean
  /** Opening the viewer goes fullscreen at once. */
  readonly fullscreenByDefault: boolean
  /** Why it is not offered, for the Studio preview and for tests; empty when offered. */
  readonly reasons: readonly CapabilityReason[]
}

/**
 * The FEAT §14 gate, as a pure function so the same rule runs in the island and in a unit test.
 *
 * NOT OFFERED under `saveData`, with less than 4 GB reported, or without WebGL: PERFORMANCE.md
 * §4.3 says "not offered" for the first two, and a control that opens nothing is worse than none.
 * OFFERED BUT OPT-IN under reduced motion and below 768px: a click still loads the viewer, an
 * intersection never does. Fullscreen by default below 768px, per RC-228.
 */
export function probeCapability(input: CapabilityInput): Capability {
  const reasons: CapabilityReason[] = []
  if (!input.webgl) reasons.push('no-webgl')
  if (input.saveData) reasons.push('save-data')
  if (input.lowMemory) reasons.push('low-memory')

  const offered = reasons.length === 0
  return {
    offered,
    autoLoad: offered && input.wideViewport && !input.reducedMotion,
    fullscreenByDefault: !input.wideViewport,
    reasons,
  }
}

// --- Variant labels (D10) ------------------------------------------------------------------------

export type PublicVariantLabel = {
  readonly variantKey: string
  readonly label: string
  /** Present ONLY when the row is owner-VERIFIED. An unverified association carries no material. */
  readonly materialId: string | null
  readonly position: number
}

/**
 * The public read of `model_variant_labels`: every label, in position order, with the material
 * reference stripped from any row the owner has not verified.
 *
 * THIS IS THE D10 LINE FOR THE VIEWER. A label is words; a material is a claim that the named
 * material is in a real object. The row may carry the claim at OWNER_VERIFICATION_REQUIRED so the
 * owner can review it in Studio — the visitor sees the words and nothing else until VERIFIED.
 */
export function publicVariantLabels(
  rows: readonly ModelVariantLabel[],
): readonly PublicVariantLabel[] {
  return [...rows]
    .sort((a, b) => a.position - b.position || a.variant_key.localeCompare(b.variant_key))
    .map((row) => ({
      variantKey: row.variant_key,
      label: row.label,
      materialId: row.owner_verification === 'VERIFIED' ? row.material_id : null,
      position: row.position,
    }))
}

/**
 * Words for a variant key the model exposes but Studio has not labelled: the key itself, made
 * readable. `walnut_01` → `walnut 01`. Never a material name — a mesh name is not a specification.
 */
export function fallbackVariantLabel(variantKey: string): string {
  return variantKey.replace(/[_-]+/g, ' ').trim()
}
