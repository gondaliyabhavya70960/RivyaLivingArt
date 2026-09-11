import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { MediaCropRow } from '@/lib/media/crop'
import type { Database } from '@/lib/supabase/database.types'

/**
 * `media_crops` reads and writes — Phase 43.
 *
 * ONE ROW PER (ASSET, RATIO), enforced by `media_crops_one_per_ratio`, so every write here is an
 * UPSERT on that pair rather than an insert-or-update decision the caller has to make. An editor
 * adjusting a crop is changing their mind about the same question, not asking a second one.
 *
 * THE PUBLIC RENDERER READS THROUGH THE ANON POLICY. `cropsForAssets` takes whichever client the
 * caller has — a visitor's anon session on a public page, a staff session in the Studio — and the
 * policy decides what comes back. A crop is visible exactly when its asset is published, which is
 * why the public read needs no service role and gets none.
 */

type Client = SupabaseClient<Database>

const COLUMNS = 'id, media_asset_id, aspect_ratio, x, y, width, height, gravity, note'

export interface MediaCrop extends MediaCropRow {
  readonly id: string
  readonly media_asset_id: string
  readonly note: string | null
}

export async function cropsForAsset(client: Client, assetId: string): Promise<MediaCrop[]> {
  const { data, error } = await client
    .from('media_crops')
    .select(COLUMNS)
    .eq('media_asset_id', assetId)
    .order('aspect_ratio')
  if (error !== null) throw new Error(`could not read crops: ${error.message}`)
  return (data ?? []) as MediaCrop[]
}

/**
 * Crops for several assets at once, for a page that renders many.
 *
 * ONE QUERY RATHER THAN ONE PER ASSET. A category page resolves a dozen slots, and a crop lookup
 * per slot would turn one render into a dozen round trips for rows that together weigh less than
 * the request headers asking for them.
 */
export async function cropsForAssets(
  client: Client,
  assetIds: readonly string[],
): Promise<MediaCrop[]> {
  if (assetIds.length === 0) return []
  const { data, error } = await client
    .from('media_crops')
    .select(COLUMNS)
    .in('media_asset_id', [...assetIds])
  if (error !== null) throw new Error(`could not read crops: ${error.message}`)
  return (data ?? []) as MediaCrop[]
}

export interface CropWrite {
  readonly mediaAssetId: string
  readonly aspectRatio: string
  readonly x: number | null
  readonly y: number | null
  readonly width: number | null
  readonly height: number | null
  readonly gravity: string | null
  readonly note: string | null
}

export async function saveCrop(
  client: Client,
  crop: CropWrite,
  actorId: string | null,
): Promise<void> {
  const { error } = await client.from('media_crops').upsert(
    {
      media_asset_id: crop.mediaAssetId,
      aspect_ratio: crop.aspectRatio,
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
      gravity: crop.gravity,
      note: crop.note,
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    },
    { onConflict: 'media_asset_id,aspect_ratio' },
  )
  if (error !== null) throw new Error(`could not save the crop: ${error.message}`)
}

/** Removing a crop restores the uncropped master for that ratio — it destroys nothing else. */
export async function deleteCrop(
  client: Client,
  assetId: string,
  aspectRatio: string,
): Promise<void> {
  const { error } = await client
    .from('media_crops')
    .delete()
    .eq('media_asset_id', assetId)
    .eq('aspect_ratio', aspectRatio)
  if (error !== null) throw new Error(`could not remove the crop: ${error.message}`)
}
