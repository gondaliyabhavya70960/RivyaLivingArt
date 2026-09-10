import * as React from 'react'

import { ModelViewerIsland } from './Island'
import { BlockImage } from '@/components/patterns/MediaSlot'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'
import type { ModelViewerCopy, ModelViewerData } from '@/components/three/types'
import { DIMENSION_KEYS, type DimensionKey } from '@/lib/catalog/dimensions'
import { interpolate, siteString, type SiteStrings } from '@/lib/cms/strings'
import {
  ENVIRONMENT_PRESET_KEYS,
  LIGHTING_PRESET_KEYS,
  type EnvironmentPresetKey,
  type LightingPresetKey,
  modelFileUrl,
  parseViewerSettings,
  publicVariantLabels,
} from '@/lib/media/model'
import type { AspectRatio } from '@/lib/media/types'
import type { PublicModel } from '@/lib/supabase/repositories/models'
import type { Material } from '@/lib/supabase/schemas'

/**
 * The server half of the mount (registry RC-228).
 *
 * WHAT IT RENDERS WITHOUT A VIEWER: the poster, as a server-rendered `BlockImage` with the same
 * srcset a hero gets — that is the LCP element the contract names, and it exists before any client
 * code runs. What it renders with one: the island around that poster, carrying every fact the
 * viewer needs as plain data. The `three` chunk is nowhere in this file's import graph.
 *
 * WHEN IT RENDERS NOTHING: the flag is off, the cloud name is missing, or the model has no format.
 * The caller already established there is a published model WITH a poster (`loadPublicModel`
 * returns null otherwise), so "no model" never reaches here — and the page shows its gallery or
 * its own imagery with no empty slot.
 *
 * WHEN IT RENDERS THE POSTER ALONE: an essential string is missing from `global_content`. A
 * control with no name, or a canvas with no name, is not offered.
 */

export type ModelViewerMountProps = {
  readonly model: PublicModel
  /** Published materials; only those a VERIFIED label names are handed to the viewer. */
  readonly materials: readonly Material[]
  /** `products.dimensions` for a product mount; null on a project or a section. */
  readonly dimensions: unknown
  readonly title: string
  readonly strings: SiteStrings
  readonly cloudName: string
  /** The `three_d_viewer` flag. */
  readonly enabled: boolean
  readonly ratio?: AspectRatio
  readonly sizes?: string
}

function presetNames<K extends string>(
  strings: SiteStrings,
  keys: readonly K[],
  group: string,
): Readonly<Record<K, string>> | null {
  const out: Partial<Record<K, string>> = {}
  for (const key of keys) {
    const value = siteString(strings, `UI_LABEL.model.${group}.${key.replace(/-/g, '_')}`)
    if (value === null) return null
    out[key] = value
  }
  return out as Readonly<Record<K, string>>
}

/** Null when a name the viewer cannot do without is missing. */
export function buildModelViewerCopy(strings: SiteStrings, title: string): ModelViewerCopy | null {
  const inspect = siteString(strings, 'UI_LABEL.model.inspect')
  const viewerName = siteString(strings, 'UI_LABEL.model.viewer.name')
  const viewerDescription = siteString(strings, 'UI_LABEL.model.viewer.description')
  const loading = siteString(strings, 'UI_LABEL.model.loading')
  const failed = siteString(strings, 'UI_LABEL.model.failed')
  const reset = siteString(strings, 'UI_LABEL.model.reset')
  const fullscreen = siteString(strings, 'UI_LABEL.model.fullscreen')
  const exitFullscreen = siteString(strings, 'UI_LABEL.model.exit_fullscreen')
  const close = siteString(strings, 'UI_LABEL.model.close')
  const materialToggle = siteString(strings, 'UI_LABEL.model.material.toggle')
  const materialHeading = siteString(strings, 'UI_LABEL.model.material.heading')
  const variants = siteString(strings, 'UI_LABEL.model.variants')
  const dimensionsToggle = siteString(strings, 'UI_LABEL.model.dimensions.toggle')
  const dimensionsHeading = siteString(strings, 'UI_LABEL.model.dimensions.heading')
  const lighting = siteString(strings, 'UI_LABEL.model.lighting')
  const environment = siteString(strings, 'UI_LABEL.model.environment')
  const lightingPresets = presetNames<LightingPresetKey>(strings, LIGHTING_PRESET_KEYS, 'lighting')
  const environmentPresets = presetNames<EnvironmentPresetKey>(
    strings,
    ENVIRONMENT_PRESET_KEYS,
    'environment',
  )

  if (
    inspect === null ||
    viewerName === null ||
    viewerDescription === null ||
    loading === null ||
    failed === null ||
    reset === null ||
    fullscreen === null ||
    exitFullscreen === null ||
    close === null ||
    materialToggle === null ||
    materialHeading === null ||
    variants === null ||
    dimensionsToggle === null ||
    dimensionsHeading === null ||
    lighting === null ||
    environment === null ||
    lightingPresets === null ||
    environmentPresets === null
  ) {
    return null
  }

  const dimensionLabels: Partial<Record<DimensionKey, string>> = {}
  for (const key of DIMENSION_KEYS) {
    const label = siteString(strings, `UI_LABEL.product.dimension.${key}`)
    if (label !== null) dimensionLabels[key] = label
  }

  return {
    inspect,
    viewerName: interpolate(viewerName, { title }),
    viewerDescription,
    loading,
    failed,
    reset,
    fullscreen,
    exitFullscreen,
    close,
    materialToggle,
    materialHeading,
    variants,
    dimensionsToggle,
    dimensionsHeading,
    lighting,
    environment,
    lightingPresets,
    environmentPresets,
    dimensionLabels,
    conceptNotice: siteString(strings, 'UI_LABEL.model.concept_notice'),
  }
}

export function ModelViewerMount({
  model,
  materials,
  dimensions,
  title,
  strings,
  cloudName,
  enabled,
  ratio = '4:3',
  sizes = '(min-width: 1024px) 60vw, 100vw',
}: ModelViewerMountProps): React.ReactElement | null {
  if (!enabled) return null
  const format = model.model.model_format
  const modelUrl = modelFileUrl(cloudName, model.model)
  if (format === null || modelUrl === null) return null

  const regionName = siteString(strings, 'UI_LABEL.model.region')
  const poster = (
    <BlockImage
      asset={model.poster}
      ratio={ratio}
      preset="hero"
      sizes={sizes}
      strings={strings}
      cloudName={cloudName}
    />
  )

  const copy = buildModelViewerCopy(strings, title)
  if (copy === null) {
    return (
      <section data-model-mount="" data-model-state="poster-only">
        {poster}
      </section>
    )
  }

  const variants = publicVariantLabels(model.labels)
  const named = new Set(
    variants.flatMap((label) => (label.materialId === null ? [] : [label.materialId])),
  )
  const materialNames = Object.fromEntries(
    materials
      .filter((material) => named.has(material.id))
      .map((material) => [material.id, material.name]),
  )

  const data: ModelViewerData = {
    modelUrl,
    format,
    settings: parseViewerSettings(model.model.viewer_settings),
    variants,
    materialNames,
    dimensions,
    isConcept: model.model.is_concept,
  }

  return (
    <section data-model-mount="" {...(regionName === null ? {} : { 'aria-label': regionName })}>
      {regionName === null ? null : <VisuallyHidden>{regionName}</VisuallyHidden>}
      <ModelViewerIsland poster={poster} data={data} copy={copy} />
    </section>
  )
}
