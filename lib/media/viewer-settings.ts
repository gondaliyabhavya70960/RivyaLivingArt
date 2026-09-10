import type { ModelVariantLabel } from '@/lib/supabase/schemas'

/**
 * The viewer's settings, capability gate and label rule — WITHOUT ZOD.
 *
 * `lib/media/model.ts` re-exports everything here and adds the Zod schema on top. The split is a
 * bundle decision: `components/three/**` and the mount's island import this module and never
 * `model.ts`, so the viewer chunk carries no schema library and the product page's first load
 * carries none for the capability probe. `tests/unit/model-policy.test.ts` reads the sources to
 * hold the line.
 */

// --- Decoders ------------------------------------------------------------------------------------

/** `DRACOLoader.setDecoderPath()`. Serves `public/draco/**`, vendored from three@0.186.0. */
export const DRACO_DECODER_PATH = '/draco/'
/** `KTX2Loader.setTranscoderPath()`. Serves `public/basis/**`, vendored from three@0.186.0. */
export const BASIS_TRANSCODER_PATH = '/basis/'

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

export type Vec3 = readonly [number, number, number]

/**
 * The shape `is_valid_viewer_settings()` enforces at the row (0194), written structurally so this
 * module needs no schema library; `viewerSettingsSchema` in `model.ts` is held to it by `satisfies`.
 */
export type ViewerSettings = {
  camera?: {
    position?: Vec3
    target?: Vec3
    fov?: number
  }
  exposure?: number
  lightingPreset?: LightingPresetKey
  environmentPreset?: EnvironmentPresetKey
  autoRotate?: boolean
  minDistance?: number
  maxDistance?: number
}

export type ResolvedViewerSettings = {
  readonly camera: {
    readonly position: Vec3 | null
    readonly target: Vec3 | null
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
