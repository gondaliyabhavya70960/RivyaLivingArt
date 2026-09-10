import type { DimensionKey } from '@/lib/catalog/dimensions'
import type { ModelFormat } from '@/lib/media/model'
import type {
  EnvironmentPresetKey,
  LightingPresetKey,
  PublicVariantLabel,
  ViewerSettings,
} from '@/lib/media/viewer-settings'

/**
 * The viewer's contract with the page that mounts it.
 *
 * NO `three` IMPORT IN THIS FILE, and none may be added. `ModelViewerMount` and its island import
 * these types to build the props they hand across the dynamic boundary; a `three` type here would
 * be erased at compile time, but a `three` VALUE would not, and the difference is the entire
 * FEAT §14 budget. Keep this file to shapes.
 *
 * EVERY WORD THE VIEWER SHOWS ARRIVES IN `copy`. The components under `components/three/**` render
 * `copy.reset`, never "Reset view": the strings are `global_content` rows seeded by
 * `content/seed/model-viewer-ui.ts`, and an owner rewords them in Studio.
 */

export type ModelViewerCopy = {
  /** The control on the poster. */
  readonly inspect: string
  /** The canvas's accessible name, already interpolated with the title. */
  readonly viewerName: string
  /** The canvas's description: every control route, for `aria-describedby`. */
  readonly viewerDescription: string
  /** `{{percent}}` template, announced at 0, 50 and 100. */
  readonly loading: string
  readonly failed: string
  readonly reset: string
  readonly fullscreen: string
  readonly exitFullscreen: string
  readonly close: string
  readonly materialToggle: string
  readonly materialHeading: string
  readonly variants: string
  readonly dimensionsToggle: string
  readonly dimensionsHeading: string
  readonly lighting: string
  readonly environment: string
  readonly lightingPresets: Readonly<Record<LightingPresetKey, string>>
  readonly environmentPresets: Readonly<Record<EnvironmentPresetKey, string>>
  /** `UI_LABEL.product.dimension.<key>`; a key without a label is not rendered. */
  readonly dimensionLabels: Readonly<Partial<Record<DimensionKey, string>>>
  /** Rendered in the chrome when the model is `is_concept`. */
  readonly conceptNotice: string | null
}

/** One owner-entered measurement, ready to print. */
export type DimensionFact = {
  readonly key: DimensionKey
  readonly value: number
  readonly unit: string | null
}

/** What a mount point knows about the model, serialisable across the dynamic boundary. */
export type ModelViewerData = {
  readonly modelUrl: string
  readonly format: ModelFormat
  readonly settings: ViewerSettings
  readonly variants: readonly PublicVariantLabel[]
  /** `materials.id` → `materials.name`, for the VERIFIED associations only. */
  readonly materialNames: Readonly<Record<string, string>>
  /**
   * `products.dimensions`, already parsed and labelled by the server through
   * `lib/catalog/dimensions`; empty where there is no product or the owner entered none. The
   * viewer receives values, never the column, and never anything read from the model.
   */
  readonly dimensions: readonly DimensionFact[]
  readonly isConcept: boolean
}

export type ModelViewerProps = ModelViewerData & {
  readonly copy: ModelViewerCopy
  /** Below 768px. The viewer opens fullscreen and `Escape` closes it outright. */
  readonly fullscreenByDefault: boolean
  /** `prefers-reduced-motion: reduce`, read by the island so the viewer cannot forget to. */
  readonly reducedMotion: boolean
  readonly onClose: () => void
  /** The engine or the model failed. The island returns to the poster with the reason. */
  readonly onError: () => void
}
