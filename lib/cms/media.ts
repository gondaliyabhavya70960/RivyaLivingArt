import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { cropsByRatio, type CropsByRatio, type MediaCropRow } from '@/lib/media/crop'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import { cropsForAssets } from '@/lib/supabase/repositories/media-crops'
import type { MediaAsset, PageSection } from '@/lib/supabase/schemas'

import { blockMediaEntries } from './block-media'

type Client = SupabaseClient<Database>

/**
 * Turning a page's media ids into assets, once, before anything renders.
 *
 * WHY THIS IS NOT DONE IN THE RENDERER. A section component that fetched its own asset would be an
 * async Server Component doing a round trip per image, in sequence, inside the render — the
 * classic waterfall. `resolvePage` gives us every section up front, so every id is knowable before
 * the first component runs, and one `in (…)` query answers all of them.
 *
 * IT ALSO KEEPS THE RENDERERS SYNCHRONOUS AND PURE, which is what lets them be tested with a
 * fixture map and rendered inside the Studio preview where there is no server client at all.
 */

/** Every media id a section refers to: its own pair, plus its payload's reserved entries. */
export function sectionMediaIds(section: PageSection): readonly string[] {
  const ids: string[] = []
  if (section.media_desktop_id !== null) ids.push(section.media_desktop_id)
  if (section.media_mobile_id !== null) ids.push(section.media_mobile_id)
  for (const entry of blockMediaEntries(section.payload)) ids.push(entry.media_id)
  return ids
}

export function pageMediaIds(sections: readonly PageSection[]): readonly string[] {
  return [...new Set(sections.flatMap(sectionMediaIds))]
}

/**
 * A `media_assets` row carrying the crops an editor stored for it.
 *
 * A PLAIN `MediaAsset` IS ASSIGNABLE TO THIS, because `crops` is optional — so every existing
 * caller and every test fixture keeps working unchanged, and a component that does not care about
 * crops never learns they exist.
 *
 * THE ALTERNATIVE WAS TWENTY CALL SITES. The crop for a picture depends on the RATIO it is being
 * rendered at, and the only place that knows both the asset and the ratio is the frame itself —
 * `BlockImage`, deep inside `MediaSlot`. Threading a separate crops map down from `renderCmsPage`
 * would have meant a new prop on every renderer that draws a picture, to express one rule. Carrying
 * the crops ON the asset puts the rule where the decision is.
 */
export type BoundMediaAsset = MediaAsset & { readonly crops?: CropsByRatio }

/**
 * Assets by id for a whole page, with their crops, in two queries. Ids RLS hides are simply absent.
 *
 * TWO QUERIES, NOT ONE PER PICTURE. `cropsForAssets` takes the whole id list at once, for the
 * reason its own header gives: a category page resolves a dozen slots, and a crop lookup per slot
 * would turn one render into a dozen round trips for rows that together weigh less than the request
 * headers asking for them.
 *
 * A CROP FAILURE IS NOT A PAGE FAILURE. `media_crops` is an enhancement — the master renders
 * perfectly well uncropped — so a read that throws costs the focal points and nothing else. A page
 * that 500s because an editor's crop table was unreachable would be a worse outcome than the
 * centre crop it was trying to improve on.
 */
export async function loadPageMedia(
  client: Client,
  sections: readonly PageSection[],
): Promise<ReadonlyMap<string, BoundMediaAsset>> {
  const assets = await listMediaAssetsByIds(client, pageMediaIds(sections))
  if (assets.size === 0) return assets

  const rows = await cropsForAssets(client, [...assets.keys()]).catch(() => [])
  if (rows.length === 0) return assets

  const byAsset = new Map<string, MediaCropRow[]>()
  for (const row of rows) {
    const existing = byAsset.get(row.media_asset_id)
    if (existing === undefined) byAsset.set(row.media_asset_id, [row])
    else existing.push(row)
  }

  return new Map(
    [...assets].map(([id, asset]) => {
      const own = byAsset.get(id)
      return [id, own === undefined ? asset : { ...asset, crops: cropsByRatio(own) }]
    }),
  )
}

/**
 * Re-exported from `lib/media/ref.ts`, which has no server dependency.
 *
 * It moved because the gallery's client components need it and this module opens with
 * `import 'server-only'` — a Client Component importing anything from here fails `next build`.
 * The re-export keeps every existing caller working and keeps one implementation.
 */
export { mediaRefOf } from '@/lib/media/ref'

/**
 * The alt text to render, given the section may override it.
 *
 * THE OVERRIDE WINS, AND NEITHER SIDE MAY BE EMPTY. `media_assets.alt_text` describes the picture;
 * `page_sections.media_alt_override` describes what it is doing HERE, which is a different
 * sentence when the same photograph appears as a hero and as a thumbnail. A blank override is
 * treated as absent — an editor who cleared the field wants the asset's own words back, not
 * silence, and an empty `alt` tells a screen reader the image carries no information at all.
 */
export function altTextOf(asset: MediaAsset, override: string | null): string {
  const trimmed = override?.trim() ?? ''
  return trimmed === '' ? asset.alt_text : trimmed
}

/**
 * What a renderer is handed for one section.
 *
 * Resolution, not policy: it answers "which asset is this" and nothing about how to display it.
 */
export type SectionMedia = {
  readonly desktop: BoundMediaAsset | null
  readonly mobile: BoundMediaAsset | null
  /**
   * Payload entries for one declared slot, in payload order — index 0 is `slot[0]`.
   *
   * POSITIONS ARE PRESERVED AND MISSING ASSETS COME BACK AS `null`. Compacting the array would
   * renumber it, and a card holding `media_index: 2` would then draw a different picture than the
   * editor chose — silently, and only for the visitors whose RLS hid the earlier one.
   */
  readonly slot: (slotId: string) => readonly (BoundMediaAsset | null)[]
}

export function sectionMediaFor(
  section: PageSection,
  assets: ReadonlyMap<string, BoundMediaAsset>,
): SectionMedia {
  const lookup = (id: string | null) => (id === null ? null : (assets.get(id) ?? null))
  const entries = blockMediaEntries(section.payload)

  return {
    desktop: lookup(section.media_desktop_id),
    mobile: lookup(section.media_mobile_id),
    slot: (slotId) =>
      entries
        .filter((entry) => entry.slot === slotId)
        .map((entry) => assets.get(entry.media_id) ?? null),
  }
}
