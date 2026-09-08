import { purposeFor, type AssetPurpose } from '@/content/asset-purposes'
import { MEDIA_SLOTS, type MediaSlot } from '@/content/media-slots'

import type { ManifestAsset } from './manifest'

/**
 * The Inventory tab's row model and its filters, kept out of the component.
 *
 * WHY THIS IS A MODULE AND NOT A `.filter()` IN THE PAGE. The phase's verification step 7 asserts
 * three exact counts through the UI — family `material-macro` → 39, page `process` → 79, type
 * video → 26 — and an e2e run proves those only on a machine with a database and a browser. The
 * same predicate tested here proves them in 30 milliseconds on every commit, so a filter that
 * silently starts dropping rows is caught by the unit suite rather than by whoever next opens the
 * page.
 */

export type InventoryEntry = {
  readonly asset: ManifestAsset
  /** A `media_assets` row exists for this generation id. */
  readonly migrated: boolean
  /**
   * `media_usages.slot_key` values bound to this asset — FEAT §34's "CMS placement".
   *
   * Read from the database rather than from the manifest's own `cms_placement` field, which is
   * `null` on all 250 and would make the column a permanent blank. The manifest is a record of
   * what was generated; only `media_usages` knows what is actually used.
   */
  readonly slotKeys: readonly string[]
  /**
   * FEAT §34's "Purpose", from the `HIGGSFIELD_ASSET_STATUS.md` §2.1 vocabulary.
   *
   * `null` only for a family the vocabulary does not cover, which is a defect rather than a state:
   * the Studio shows it plainly so a manifest rebuild that adds a family is visible here rather
   * than discovered later in a generated document.
   */
  readonly purpose: AssetPurpose | null
  /**
   * The declared slots this asset's family could fill.
   *
   * Not the same question as Purpose. Purpose says what KIND of picture this is; this says which
   * declared surface could actually take it. An empty list is the orphan case — an asset in the
   * library that no page can consume, which the Gaps tab reports as a finding.
   */
  readonly candidateSlotKeys: readonly string[]
}

export type InventoryFilters = {
  readonly type?: 'image' | 'video'
  readonly family?: string
  readonly page?: string
  readonly ratio?: string
  /** `true` keeps migrated rows, `false` keeps unmigrated. Undefined keeps both. */
  readonly migrated?: boolean
  /** `true` keeps rows bound to at least one slot, `false` keeps unbound. */
  readonly used?: boolean
}

/** Slots whose `fillableBy` names this family. Precomputed once per render, not per row. */
function purposeIndex(slots: readonly MediaSlot[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const slot of slots) {
    for (const family of slot.fillableBy) {
      const list = index.get(family)
      if (list) list.push(slot.key)
      else index.set(family, [slot.key])
    }
  }
  return index
}

export function buildInventory(
  assets: readonly ManifestAsset[],
  migratedGenerationIds: ReadonlySet<string>,
  slotKeysByAssetId: ReadonlyMap<string, readonly string[]>,
  slots: readonly MediaSlot[] = MEDIA_SLOTS,
): readonly InventoryEntry[] {
  const purpose = purposeIndex(slots)
  return assets.map((asset) => ({
    asset,
    migrated: migratedGenerationIds.has(asset.higgsfield_generation_id),
    slotKeys: slotKeysByAssetId.get(asset.rivya_asset_id) ?? [],
    purpose: purposeFor(asset.family),
    candidateSlotKeys: purpose.get(asset.family) ?? [],
  }))
}

export function filterInventory(
  entries: readonly InventoryEntry[],
  filters: InventoryFilters,
): readonly InventoryEntry[] {
  return entries.filter((entry) => {
    if (filters.type !== undefined && entry.asset.type !== filters.type) return false
    if (filters.family !== undefined && entry.asset.family !== filters.family) return false
    if (filters.page !== undefined && entry.asset.page !== filters.page) return false
    if (filters.ratio !== undefined && entry.asset.aspect_ratio !== filters.ratio) return false
    if (filters.migrated !== undefined && entry.migrated !== filters.migrated) return false
    // `used` is about whether anything is bound, not how many things are.
    if (filters.used !== undefined && entry.slotKeys.length > 0 !== filters.used) return false
    return true
  })
}

/** How many filters are on, so an empty table is never mistaken for an empty library. */
export function activeFilterCount(filters: InventoryFilters): number {
  return Object.values(filters).filter((v) => v !== undefined).length
}

export type InventoryFacets = {
  readonly families: readonly string[]
  readonly pages: readonly string[]
  readonly ratios: readonly string[]
}

/**
 * The values the filter selects offer.
 *
 * DERIVED FROM THE ASSETS, NOT HARD-CODED. A manifest rebuild that adds a family must not need a
 * matching edit here, and an option list containing a family with no assets is a dead end that
 * always returns nothing.
 */
export function inventoryFacets(assets: readonly ManifestAsset[]): InventoryFacets {
  const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort()
  return {
    families: sorted(assets.map((a) => a.family)),
    pages: sorted(assets.map((a) => a.page)),
    ratios: sorted(assets.map((a) => a.aspect_ratio)),
  }
}

/** Read the filters out of a Next.js `searchParams` bag, ignoring anything unrecognised. */
export function parseInventoryFilters(
  params: Record<string, string | string[] | undefined>,
): InventoryFilters {
  const one = (key: string): string | undefined => {
    const value = params[key]
    // An empty string is what the "all" option in a `<select>` submits. It means no filter, and
    // treating it as a value would filter every row out.
    return typeof value === 'string' && value !== '' ? value : undefined
  }

  const type = one('type')
  const migrated = one('migrated')
  const used = one('used')

  return {
    ...(type === 'image' || type === 'video' ? { type } : {}),
    ...(one('family') === undefined ? {} : { family: one('family')! }),
    ...(one('page') === undefined ? {} : { page: one('page')! }),
    ...(one('ratio') === undefined ? {} : { ratio: one('ratio')! }),
    ...(migrated === 'yes' ? { migrated: true } : migrated === 'no' ? { migrated: false } : {}),
    ...(used === 'yes' ? { used: true } : used === 'no' ? { used: false } : {}),
  }
}
