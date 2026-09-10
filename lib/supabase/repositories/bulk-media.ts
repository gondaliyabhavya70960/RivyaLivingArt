import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { toRepositoryError } from './support'
import type { BulkWriteResult } from './bulk-products'

type Client = SupabaseClient<Database>

const ENTITY = 'bulk media'

/**
 * The reads and writes the media bulk operations need.
 *
 * `IMMUTABLE_MEDIA_COLUMNS` IS THE MOST IMPORTANT EXPORT IN THIS FILE. Four columns may never be
 * written in bulk, and the guard is here — at the only place a bulk media write happens — rather
 * than in the four operations, because the failure it closes is a fifth operation added later by
 * somebody who did not read the other four.
 *
 *   `rivya_asset_id`           the asset's identity in the manifest; changing it in bulk detaches
 *                              a row from the 250-asset ledger `media:check-status` reconciles
 *   `higgsfield_generation_id` the provenance of a generated image; without it "was this made or
 *                              photographed" has no answer
 *   `is_ai_generated`          the same question, as a boolean a renderer reads
 *   `is_concept`               THE ONE THAT MATTERS MOST. A concept render is a picture of
 *                              something that does not exist. Clearing this on a page of selected
 *                              rows would launder a set of them into real assets, after which
 *                              nothing downstream could tell them from photographs of real work
 *                              (D6, D10). The Phase 14 trigger refuses a concept asset as a
 *                              product hero; this refuses the shortcut around it.
 */
/** The asset's `updated_at` right now — the version a write leaves behind, for undo. */
async function mediaVersion(admin: Client, mediaId: string): Promise<string | null> {
  const { data } = await admin
    .from('media_assets')
    .select('updated_at')
    .eq('id', mediaId)
    .maybeSingle()
  return data?.updated_at ?? null
}

export const IMMUTABLE_MEDIA_COLUMNS = [
  'rivya_asset_id',
  'higgsfield_generation_id',
  'is_ai_generated',
  'is_concept',
] as const

export interface BulkMediaRow {
  readonly id: string
  readonly label: string
  readonly status: string
  readonly folder: string | null
  readonly tags: readonly string[]
  readonly isConcept: boolean
  /** How many `media_usages` rows bind this asset. Reported in the preview, never a refusal. */
  readonly usageCount: number
}

export async function listBulkMediaContext(
  admin: Client,
  mediaIds: readonly string[],
): Promise<BulkMediaRow[]> {
  if (mediaIds.length === 0) return []
  const ids = [...mediaIds]

  const [assets, usages] = await Promise.all([
    admin
      .from('media_assets')
      .select('id, title, filename, rivya_asset_id, public_id, status, folder, tags, is_concept')
      .in('id', ids),
    admin.from('media_usages').select('media_id').in('media_id', ids),
  ])

  if (assets.error) throw toRepositoryError(ENTITY, 'list', 'selection', assets.error)

  const usageCount = new Map<string, number>()
  for (const row of usages.data ?? []) {
    usageCount.set(row.media_id, (usageCount.get(row.media_id) ?? 0) + 1)
  }

  return (assets.data ?? []).map((asset) => ({
    id: asset.id,
    // The same four-candidate chain the search index uses, and for the same reason: an asset may
    // legitimately have no title, no Rivya id and no filename, and a preview row with no name is
    // a row the operator cannot identify.
    label:
      (asset.title ?? '').trim() ||
      (asset.rivya_asset_id ?? '') ||
      (asset.filename ?? '').trim() ||
      asset.public_id,
    status: asset.status,
    folder: asset.folder,
    tags: asset.tags ?? [],
    isConcept: asset.is_concept,
    usageCount: usageCount.get(asset.id) ?? 0,
  }))
}

/** Refuse an immutable column before it reaches the database. Shared by both media writes. */
function assertMutable(columns: Record<string, unknown>): void {
  for (const column of IMMUTABLE_MEDIA_COLUMNS) {
    if (column in columns) {
      throw new Error(`${column} cannot be changed in bulk.`)
    }
  }
}

export async function setMediaColumns(
  admin: Client,
  mediaId: string,
  columns: Record<string, unknown>,
): Promise<BulkWriteResult> {
  assertMutable(columns)

  const { data: current, error: readError } = await admin
    .from('media_assets')
    .select('*')
    .eq('id', mediaId)
    .maybeSingle()
  if (readError) throw toRepositoryError(ENTITY, 'read', mediaId, readError)
  if (current === null) throw new Error('That asset no longer exists.')

  const before: Record<string, unknown> = {}
  for (const key of Object.keys(columns)) {
    before[key] = (current as Record<string, unknown>)[key]
  }

  const { error } = await admin
    .from('media_assets')
    .update(columns as never)
    .eq('id', mediaId)
  if (error !== null) throw new Error(error.message)

  return {
    before,
    after: columns,
    // AFTER THE WRITE, for the reason `ApplyResult.rowVersionForUndo` gives at length: the version
    // undo compares against is the one this operation left behind, not the one it read.
    rowVersionForUndo: await mediaVersion(admin, mediaId),
  }
}

/**
 * Add to or replace an asset's tags.
 *
 * ADD IS THE DEFAULT SHAPE AND REPLACE IS OFFERED DELIBERATELY. Bulk-tagging thirty assets usually
 * means "these all belong to the autumn shoot", not "forget everything else about them" — but an
 * operator correcting a bad import means exactly the second, and making them clear tags one asset
 * at a time would be worse than giving them the mode.
 */
export async function setMediaTags(
  admin: Client,
  mediaId: string,
  tags: readonly string[],
  mode: 'ADD' | 'REPLACE',
): Promise<BulkWriteResult> {
  const { data: current, error: readError } = await admin
    .from('media_assets')
    .select('tags')
    .eq('id', mediaId)
    .maybeSingle()
  if (readError) throw toRepositoryError(ENTITY, 'read', mediaId, readError)
  if (current === null) throw new Error('That asset no longer exists.')

  const existing = current.tags ?? []
  const next = mode === 'REPLACE' ? [...tags] : [...new Set([...existing, ...tags])]

  const { error } = await admin.from('media_assets').update({ tags: next }).eq('id', mediaId)
  if (error !== null) throw new Error(error.message)

  return {
    before: { tags: existing },
    after: { tags: next },
    rowVersionForUndo: await mediaVersion(admin, mediaId),
  }
}
