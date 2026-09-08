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

/**
 * The Media Manager's list query — one function behind all six pages.
 *
 * KIND IS A FILTER, NOT A PAGE. FEAT §13's six sections are Images, Videos, 3D Models, Documents,
 * AI Assets and Brand Assets, and five of those are a `kind`. The sixth is not: AI Assets is
 * `source = 'HIGGSFIELD'` across IMAGE and VIDEO, which is why the enum has no AI value and why
 * this takes both filters rather than one. Modelling AI as a kind would have made an asset either
 * an image or AI-generated, when every Higgsfield asset is both.
 */
export type MediaListFilters = {
  readonly kind?: MediaAsset['kind']
  readonly source?: MediaAsset['source']
  /** Matches filename or title. Trigram-indexed on filename (0008). */
  readonly search?: string
  readonly limit?: number
}

export async function listMediaAssets(
  client: Client,
  filters: MediaListFilters = {},
): Promise<MediaAsset[]> {
  let query = client.from('media_assets').select('*')

  if (filters.kind !== undefined) query = query.eq('kind', filters.kind)
  if (filters.source !== undefined) query = query.eq('source', filters.source)
  if (filters.search !== undefined && filters.search.trim() !== '') {
    // `%` and `,` are PostgREST's own separators inside an `or` filter, so a search containing one
    // would change the shape of the query rather than the value being matched. Escaped, not
    // rejected: an editor searching for "50%" is asking a reasonable question.
    const term = filters.search.trim().replace(/[%,]/g, '\\$&')
    query = query.or(`filename.ilike.%${term}%,title.ilike.%${term}%`)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200)

  if (error) throw toRepositoryError(ENTITY, 'list', filters.kind ?? 'all', error)
  return parseRows(ENTITY, mediaAssetSchema, data ?? [])
}

/**
 * What the Studio may set when it records an asset after an upload.
 *
 * NARROWER THAN THE ROW ON PURPOSE. `bytes`, `width`, `height` and `duration_s` are absent:
 * those come from `MediaProvider.probe()` and are written by the caller from the provider's
 * answer, never from a form. A client that uploaded a 40 MB file can report 2 MB, and the row
 * would then assert something false about an asset an owner is making a decision about.
 *
 * `source` is required with no default here for the same reason it is `not null` with no default
 * in the database (0030): a forgotten value would become a provenance claim nobody made.
 */
export type NewMediaAsset = {
  readonly public_id: string
  readonly folder: string
  readonly resource_type: MediaAsset['resource_type']
  readonly kind: MediaAsset['kind']
  readonly source: MediaAsset['source']
  readonly alt_text: string
  readonly is_ai_generated: boolean
  readonly is_concept: boolean
  readonly filename?: string | null
  readonly title?: string | null
  readonly mime_type?: string | null
  readonly bytes?: number | null
  readonly width?: number | null
  readonly height?: number | null
  readonly duration_s?: number | null
  readonly uploaded_by?: string | null
}

export async function insertMediaAsset(client: Client, asset: NewMediaAsset): Promise<MediaAsset> {
  const { data, error } = await client
    .from('media_assets')
    .insert({ ...asset, provider: 'cloudinary', status: 'DRAFT' })
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'insert', asset.public_id, error)
  return parseRow(ENTITY, mediaAssetSchema, data)
}

/**
 * Edit the descriptive fields.
 *
 * `alt_text` is here and may not be cleared: the column is `not null` and non-empty in the
 * database, so an empty string would be refused there anyway — but refusing it in the type means
 * the failure is a compile error rather than a round trip.
 */
export type MediaAssetEdit = {
  readonly alt_text?: string
  readonly title?: string | null
  readonly caption?: string | null
  readonly tags?: string[]
  readonly subject_tags?: string[]
}

export async function updateMediaAsset(
  client: Client,
  id: string,
  edit: MediaAssetEdit,
  updatedBy: string,
): Promise<void> {
  const { error } = await client
    .from('media_assets')
    .update({ ...edit, updated_by: updatedBy })
    .eq('id', id)

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
}
