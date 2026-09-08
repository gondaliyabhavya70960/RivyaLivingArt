import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { mediaAssetSchema, type MediaAsset } from '../schemas'
import { NotFoundError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'media asset'

/**
 * Media registry reads.
 *
 * `rivya_asset_id` is the authoritative identity, not the filename and not the Cloudinary public
 * ID (D6). Lookups that matter go through it, which is also what makes "has this already been
 * generated?" answerable — and therefore what makes regenerating an existing asset a detectable
 * defect rather than an easy mistake.
 *
 * The table is empty in Phase 03. Phase 06 adds the Cloudinary delivery columns; Phase 07 imports
 * the 250 manifest assets. Nothing in this file writes a row.
 */

export async function getMediaAssetById(client: Client, id: string): Promise<MediaAsset> {
  const { data, error } = await client.from('media_assets').select('*').eq('id', id).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  if (!data) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, mediaAssetSchema, data)
}

/** By the Rivya asset ID — the D6 identity. */
export async function getMediaAssetByRivyaId(
  client: Client,
  rivyaAssetId: string,
): Promise<MediaAsset> {
  const { data, error } = await client
    .from('media_assets')
    .select('*')
    .eq('rivya_asset_id', rivyaAssetId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', rivyaAssetId, error)
  if (!data) throw new NotFoundError(ENTITY, rivyaAssetId)
  return parseRow(ENTITY, mediaAssetSchema, data)
}

export async function listMediaAssetsByKind(
  client: Client,
  kind: MediaAsset['kind'],
): Promise<MediaAsset[]> {
  const { data, error } = await client
    .from('media_assets')
    .select('*')
    .eq('kind', kind)
    .order('created_at', { ascending: false })

  if (error) throw toRepositoryError(ENTITY, 'list', kind, error)
  return parseRows(ENTITY, mediaAssetSchema, data ?? [])
}

/**
 * Concept assets — AI-generated imagery that may illustrate a page but may never be presented as
 * a photograph of a piece the business has actually made. `is_concept` never clears, on any row.
 */
export async function listConceptMediaAssets(client: Client): Promise<MediaAsset[]> {
  const { data, error } = await client
    .from('media_assets')
    .select('*')
    .eq('is_concept', true)
    .order('created_at', { ascending: false })

  if (error) throw toRepositoryError(ENTITY, 'list', 'concept', error)
  return parseRows(ENTITY, mediaAssetSchema, data ?? [])
}
