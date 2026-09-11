import type { SupabaseClient } from '@supabase/supabase-js'

import {
  mediaAssetHashRowSchema,
  mediaAssetHashWithAssetSchema,
  type MediaAssetHashRow,
  type MediaAssetHashWithAsset,
} from '@/lib/supabase/schemas/similarity'

import type { Database } from '../database.types'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'media asset hash'

const COLUMNS = 'id, media_asset_id, kind, checksum, phash, dhash, computed_at'
const WITH_ASSET = `${COLUMNS}, media_assets ( rivya_asset_id, public_id, filename )`

/**
 * `media_asset_hashes` and nothing else — a FIRST-PARTY repository.
 *
 * IT IMPORTS NOTHING FROM THE RESEARCH REPOSITORIES, and the research repositories import nothing
 * from it. The upload guard compares the two corpora in TypeScript over two reads; this module is
 * one of them. Writes take the admin client: the table has no session write policy, because a
 * hash a session could insert is a hash somebody typed.
 */

export interface NewMediaAssetHash {
  readonly media_asset_id: string
  readonly kind: 'IMAGE' | 'VIDEO'
  readonly checksum: string
  readonly phash: string | null
  readonly dhash: string | null
}

export async function upsertMediaAssetHash(
  admin: Client,
  row: NewMediaAssetHash,
): Promise<MediaAssetHashRow> {
  const { data, error } = await admin
    .from('media_asset_hashes')
    .upsert({ ...row, computed_at: new Date().toISOString() }, { onConflict: 'media_asset_id' })
    .select(COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'upsert', row.media_asset_id, error)
  return parseRow(ENTITY, mediaAssetHashRowSchema, data)
}

/** Every row, with the asset's identity beside it. The library is hundreds of rows, not millions. */
export async function listMediaAssetHashes(client: Client): Promise<MediaAssetHashWithAsset[]> {
  const { data, error } = await client
    .from('media_asset_hashes')
    .select(WITH_ASSET)
    .order('computed_at', { ascending: true })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, mediaAssetHashWithAssetSchema, data ?? [])
}

export async function getMediaAssetHash(
  client: Client,
  mediaAssetId: string,
): Promise<MediaAssetHashRow | null> {
  const { data, error } = await client
    .from('media_asset_hashes')
    .select(COLUMNS)
    .eq('media_asset_id', mediaAssetId)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', mediaAssetId, error)
  return data === null ? null : parseRow(ENTITY, mediaAssetHashRowSchema, data)
}

export interface HashCoverage {
  readonly kind: 'IMAGE' | 'VIDEO'
  readonly assets: number
  readonly hashed: number
  readonly withPhash: number
}

/**
 * How much of the library is hashed, per kind — the figure the Studio and `media:hash` print.
 * Two counts and a diff in TypeScript; PostgREST has no `not exists`.
 */
export async function hashCoverage(client: Client): Promise<HashCoverage[]> {
  const assets = await client.from('media_assets').select('id, kind').in('kind', ['IMAGE', 'VIDEO'])
  if (assets.error !== null) throw toRepositoryError(ENTITY, 'coverage', 'assets', assets.error)
  const hashes = await client.from('media_asset_hashes').select('media_asset_id, kind, phash')
  if (hashes.error !== null) throw toRepositoryError(ENTITY, 'coverage', 'hashes', hashes.error)
  const out: HashCoverage[] = []
  for (const kind of ['IMAGE', 'VIDEO'] as const) {
    const rows = (hashes.data ?? []).filter((row) => row.kind === kind)
    out.push({
      kind,
      assets: (assets.data ?? []).filter((row) => row.kind === kind).length,
      hashed: rows.length,
      withPhash: rows.filter((row) => row.phash !== null).length,
    })
  }
  return out
}

export interface UnhashedAsset {
  readonly id: string
  readonly kind: 'IMAGE' | 'VIDEO'
  readonly public_id: string
  readonly resource_type: string
  readonly rivya_asset_id: string | null
}

/** Every image and video asset, oldest first — what the backfill may hash. */
export async function listHashableAssets(client: Client): Promise<UnhashedAsset[]> {
  const assets = await client
    .from('media_assets')
    .select('id, kind, public_id, resource_type, rivya_asset_id')
    .in('kind', ['IMAGE', 'VIDEO'])
    .order('created_at', { ascending: true })
  if (assets.error !== null) throw toRepositoryError(ENTITY, 'hashable', 'assets', assets.error)
  return (assets.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as 'IMAGE' | 'VIDEO',
    public_id: row.public_id,
    resource_type: row.resource_type,
    rivya_asset_id: row.rivya_asset_id,
  }))
}

/** Image and video assets with no hash row yet, oldest first — the backfill's work list. */
export async function listUnhashedAssets(client: Client): Promise<UnhashedAsset[]> {
  const [assets, hashes] = await Promise.all([
    listHashableAssets(client),
    client.from('media_asset_hashes').select('media_asset_id'),
  ])
  if (hashes.error !== null) throw toRepositoryError(ENTITY, 'unhashed', 'hashes', hashes.error)
  const done = new Set((hashes.data ?? []).map((row) => row.media_asset_id))
  return assets.filter((row) => !done.has(row.id))
}
