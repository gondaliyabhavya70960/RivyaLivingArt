import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
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

/** Assets by id for a whole page, in one query. Ids RLS hides are simply absent. */
export async function loadPageMedia(
  client: Client,
  sections: readonly PageSection[],
): Promise<ReadonlyMap<string, MediaAsset>> {
  return listMediaAssetsByIds(client, pageMediaIds(sections))
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
  readonly desktop: MediaAsset | null
  readonly mobile: MediaAsset | null
  /**
   * Payload entries for one declared slot, in payload order — index 0 is `slot[0]`.
   *
   * POSITIONS ARE PRESERVED AND MISSING ASSETS COME BACK AS `null`. Compacting the array would
   * renumber it, and a card holding `media_index: 2` would then draw a different picture than the
   * editor chose — silently, and only for the visitors whose RLS hid the earlier one.
   */
  readonly slot: (slotId: string) => readonly (MediaAsset | null)[]
}

export function sectionMediaFor(
  section: PageSection,
  assets: ReadonlyMap<string, MediaAsset>,
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
