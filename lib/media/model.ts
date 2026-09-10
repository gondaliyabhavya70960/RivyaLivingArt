import { z } from 'zod'

import { rawUrl } from './url'
import {
  ENVIRONMENT_PRESET_KEYS,
  LIGHTING_PRESET_KEYS,
  type ViewerSettings,
} from './viewer-settings'
import type { MediaAsset } from '@/lib/supabase/schemas'

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
// The two paths live in `viewer-settings.ts` (the zod-free module the viewer imports) and are
// re-exported here so a server reader has one import.

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

// --- viewer_settings (the Zod boundary) ------------------------------------------------------------

export {
  BASIS_TRANSCODER_PATH,
  DEFAULT_FOV,
  DRACO_DECODER_PATH,
  ENVIRONMENT_PRESET_KEYS,
  LIGHTING_PRESET_KEYS,
  VIEWER_MIN_VIEWPORT,
  fallbackVariantLabel,
  probeCapability,
  publicVariantLabels,
  resolveViewerSettings,
} from './viewer-settings'
export type {
  Capability,
  CapabilityInput,
  CapabilityReason,
  EnvironmentPresetKey,
  LightingPresetKey,
  PublicVariantLabel,
  ResolvedViewerSettings,
  Vec3,
  ViewerSettings,
} from './viewer-settings'

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])

/**
 * The same shape `is_valid_viewer_settings()` enforces at the row (0194). Strict objects, so an
 * unknown key is a parse failure here exactly as it is a refused row there: the two copies must
 * agree, and `tests/unit/model-policy.test.ts` holds them to it. `satisfies` holds this schema to
 * the structural `ViewerSettings` type the viewer reads, so the three cannot drift apart.
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
  ) satisfies z.ZodType<ViewerSettings>

/**
 * `media_assets.viewer_settings`, parsed. A malformed blob — which the constraint should have
 * refused, but a schema is a boundary and not a belief — yields the empty object, so the viewer
 * falls back to its defaults rather than failing to mount over a setting.
 */
export function parseViewerSettings(value: unknown): ViewerSettings {
  const parsed = viewerSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : {}
}
