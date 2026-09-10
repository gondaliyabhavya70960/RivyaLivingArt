import { z } from 'zod'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '../database.types'
import {
  type MediaAsset,
  type ModelVariantLabel,
  mediaAssetSchema,
  modelVariantLabelSchema,
} from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

/**
 * Reads and writes for the Phase 21 model surfaces: the model row's 3D metadata, its variant
 * labels, and the one function that associates it with a product or a project.
 *
 * THE PUBLIC READ IS ONE SHAPE. `loadPublicModel()` returns the model, its poster and its labels
 * together, or null, because every mount point asks the same question — "is there a model here
 * that a page may show?" — and the answer has three parts that must agree. RLS does the filtering
 * on the public client: a DRAFT model, a DRAFT poster or an unpublished label parent simply does
 * not come back, and the caller treats absence as "no model".
 */

const ENTITY = 'model'

// --- Public --------------------------------------------------------------------------------------

export type PublicModel = {
  readonly model: MediaAsset
  /** Never null: a model with no poster is not shown, by the 0194 constraint and by this read. */
  readonly poster: MediaAsset
  readonly labels: readonly ModelVariantLabel[]
}

export async function loadPublicModel(
  client: Client,
  assetId: string,
): Promise<PublicModel | null> {
  const { data, error } = await client
    .from('media_assets')
    .select('*')
    .eq('id', assetId)
    .eq('kind', 'MODEL_3D')
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'select', assetId, error)
  if (data === null) return null

  const model = parseRow(ENTITY, mediaAssetSchema, data)
  if (model.model_poster_id === null) return null

  const [posterResult, labelsResult] = await Promise.all([
    client.from('media_assets').select('*').eq('id', model.model_poster_id).maybeSingle(),
    client
      .from('model_variant_labels')
      .select('*')
      .eq('media_asset_id', model.id)
      .order('position', { ascending: true }),
  ])
  if (posterResult.error) {
    throw toRepositoryError(ENTITY, 'select', model.model_poster_id, posterResult.error)
  }
  if (labelsResult.error) throw toRepositoryError(ENTITY, 'select', model.id, labelsResult.error)
  if (posterResult.data === null) return null

  return {
    model,
    poster: parseRow(ENTITY, mediaAssetSchema, posterResult.data),
    labels: parseRows(ENTITY, modelVariantLabelSchema, labelsResult.data),
  }
}

/** Published models associated with a project — what `/portfolio/[slug]` mounts. */
export async function listModelIdsForProject(client: Client, projectId: string): Promise<string[]> {
  const { data, error } = await client
    .from('media_assets')
    .select('id')
    .eq('kind', 'MODEL_3D')
    .eq('associated_project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw toRepositoryError(ENTITY, 'select', projectId, error)
  return parseRows(ENTITY, z.object({ id: z.string().uuid() }), data).map((row) => row.id)
}

// --- Studio --------------------------------------------------------------------------------------

export async function listVariantLabels(
  client: Client,
  assetId: string,
): Promise<ModelVariantLabel[]> {
  const { data, error } = await client
    .from('model_variant_labels')
    .select('*')
    .eq('media_asset_id', assetId)
    .order('position', { ascending: true })
  if (error) throw toRepositoryError(ENTITY, 'select', assetId, error)
  return parseRows(ENTITY, modelVariantLabelSchema, data)
}

/**
 * The FEAT §13 block and the Phase 21 additions, written from the inspector's parse and from the
 * Studio editor — never from a visitor. `viewer_settings` arrives already validated by
 * `viewerSettingsSchema`; the row constraint checks it again.
 */
export type ModelMetadataPatch = {
  readonly model_format?: 'GLB' | 'GLTF'
  readonly file_size_bytes?: number | null
  readonly bytes?: number | null
  readonly poly_count?: number | null
  readonly texture_count?: number | null
  readonly model_poster_id?: string | null
  readonly model_thumbnail_id?: string | null
  readonly viewer_settings?: Json
}

export async function updateModelMetadata(
  client: Client,
  assetId: string,
  patch: ModelMetadataPatch,
  updatedBy: string,
): Promise<void> {
  const { error } = await client
    .from('media_assets')
    .update({ ...patch, updated_by: updatedBy })
    .eq('id', assetId)
    .eq('kind', 'MODEL_3D')
  if (error) throw toRepositoryError(ENTITY, 'update', assetId, error)
}

export type VariantLabelInput = {
  readonly variant_key: string
  readonly label: string
  readonly material_id: string | null
  readonly position: number
  readonly owner_verification: ModelVariantLabel['owner_verification']
}

/**
 * Replace the label set for one model. Keys the file no longer declares are removed; the rest are
 * upserted on `(media_asset_id, variant_key)`. One label per variant, always.
 */
export async function replaceVariantLabels(
  client: Client,
  assetId: string,
  labels: readonly VariantLabelInput[],
  updatedBy: string,
): Promise<void> {
  const keep = labels.map((label) => label.variant_key)
  const remove = client.from('model_variant_labels').delete().eq('media_asset_id', assetId)
  const { error: deleteError } = await (keep.length === 0
    ? remove
    : remove.not(
        'variant_key',
        'in',
        `(${keep.map((key) => `"${key.replace(/"/g, '')}"`).join(',')})`,
      ))
  if (deleteError) throw toRepositoryError(ENTITY, 'delete', assetId, deleteError)

  if (labels.length === 0) return
  const { error } = await client.from('model_variant_labels').upsert(
    labels.map((label) => ({
      media_asset_id: assetId,
      variant_key: label.variant_key,
      label: label.label,
      material_id: label.material_id,
      position: label.position,
      owner_verification: label.owner_verification,
      fact_classification: label.material_id === null ? 'EDITORIAL_COPY' : 'PRODUCT_FACT',
      updated_by: updatedBy,
    })),
    { onConflict: 'media_asset_id,variant_key' },
  )
  if (error) throw toRepositoryError(ENTITY, 'upsert', assetId, error)
}

/**
 * `set_model_association()` — both sides in one transaction. `null, null` clears. RLS inside the
 * function decides what this session may touch; a refusal surfaces as a repository error.
 */
export async function setModelAssociation(
  client: Client,
  assetId: string,
  productId: string | null,
  projectId: string | null,
): Promise<void> {
  const { error } = await client.rpc('set_model_association', {
    p_asset_id: assetId,
    p_product_id: productId,
    p_project_id: projectId,
  })
  if (error) throw toRepositoryError(ENTITY, 'rpc', assetId, error)
}
