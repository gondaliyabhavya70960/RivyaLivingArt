import { MEDIA_SLOTS, type MediaSlot } from '@/content/media-slots'

import type { ManifestAsset } from './manifest'
import type { AspectRatio } from './types'

/**
 * The gap engine: what the site declares it needs, joined against what exists.
 *
 * PURE, AND TAKES ITS INPUTS AS ARGUMENTS. Neither the manifest nor the database is read here.
 * That is what lets `tests/unit/media-gaps.test.ts` drive real manifest data and synthetic
 * bindings through it with no network, and it is why the tracker page can compute the same report
 * a script does — one implementation, two callers, no chance of the Studio and the generated
 * `HIGGSFIELD_ASSET_STATUS.md` disagreeing about what is missing.
 *
 * THE JOIN IS ON `slot_key`. `media_usages.slot_key` is free text as far as the database is
 * concerned — the check constraint only requires it to be non-blank. This registry is what gives
 * those strings meaning, so a binding whose key matches no declared slot is invisible here by
 * design: it is a CMS row for a surface the design never claimed, which Phase 08 review should
 * catch, not something this engine should invent a slot for.
 */

/**
 * FILLED  — enough `media_usages` rows bind assets to this slot. Done.
 * COVERED — not bound yet, but the library holds enough candidates to bind. Phase 08 work.
 * THIN    — candidates exist but too few; binding would leave the surface repeating one image.
 * GAP     — nothing in the library can fill it. New generation, or an empty state.
 */
export type SlotState = 'FILLED' | 'COVERED' | 'THIN' | 'GAP'

export type SlotStatus = {
  readonly slot: MediaSlot
  readonly state: SlotState
  /** Assets in the slot's `fillableBy` families. */
  readonly candidateCount: number
  /** `media_usages` rows carrying this `slot_key`. */
  readonly boundCount: number
  /**
   * Declared ratios that no candidate holds NATIVELY.
   *
   * Advisory, not disqualifying: `ratioCrop()` can deliver any ratio from any source, so a
   * mismatch never makes a slot a gap. It does mean the delivered image is a crop of a frame
   * composed for a different shape — the one thing an AI-generated still tends to survive least
   * well, because the subject was placed for the original edges. Empty when there are no
   * candidates at all: there the gap is the finding and a ratio list is noise.
   */
  readonly missingRatios: readonly AspectRatio[]
}

export type PageStatus = {
  readonly page: string
  readonly slots: readonly SlotStatus[]
  readonly gapCount: number
}

export type ThinFamily = {
  readonly family: string
  readonly assetCount: number
  /** The slots left thin by this family, so a brief can name what it is blocking. */
  readonly slotKeys: readonly string[]
}

export type OrphanFamily = {
  readonly family: string
  readonly assetCount: number
}

export type GapReport = {
  /** Every declared page, in registry order, each with its slots. */
  readonly pages: readonly PageStatus[]
  /** GAP slots only, flattened — what the Gaps tab lists and what earns a brief. */
  readonly gaps: readonly SlotStatus[]
  readonly thinFamilies: readonly ThinFamily[]
  /**
   * Families no slot can consume. The inverse of a gap: assets that were migrated and paid for
   * and which no declared surface will ever show. Worth seeing next to the gaps, because the
   * honest fix is sometimes to declare a slot rather than to generate anything.
   */
  readonly orphanFamilies: readonly OrphanFamily[]
  readonly totals: {
    readonly slots: number
    readonly filled: number
    readonly covered: number
    readonly thin: number
    readonly gap: number
  }
}

/** The single field this engine needs from a `media_usages` row. */
export type SlotBinding = { readonly slot_key: string }

export type GapInput = {
  readonly assets: readonly ManifestAsset[]
  readonly bindings: readonly SlotBinding[]
  /** Overridable so tests can assert the engine's rules rather than the registry's contents. */
  readonly slots?: readonly MediaSlot[]
}

function classify(boundCount: number, candidateCount: number, minAssets: number): SlotState {
  if (boundCount >= minAssets) return 'FILLED'
  // Order matters below: a slot may be partially bound and still be a gap or thin, and what
  // decides the remaining work is the library, not the bindings already made.
  if (candidateCount === 0) return 'GAP'
  if (candidateCount < minAssets) return 'THIN'
  return 'COVERED'
}

export function computeGaps(input: GapInput): GapReport {
  const slots = input.slots ?? MEDIA_SLOTS

  const assetsByFamily = new Map<string, ManifestAsset[]>()
  for (const asset of input.assets) {
    const list = assetsByFamily.get(asset.family)
    if (list) list.push(asset)
    else assetsByFamily.set(asset.family, [asset])
  }

  const boundBySlot = new Map<string, number>()
  for (const binding of input.bindings) {
    boundBySlot.set(binding.slot_key, (boundBySlot.get(binding.slot_key) ?? 0) + 1)
  }

  const statuses: SlotStatus[] = slots.map((slot) => {
    const candidates = slot.fillableBy.flatMap((family) => assetsByFamily.get(family) ?? [])
    const boundCount = boundBySlot.get(slot.key) ?? 0
    const state = classify(boundCount, candidates.length, slot.minAssets)

    const nativeRatios = new Set(candidates.map((a) => a.aspect_ratio))
    const declared: readonly AspectRatio[] = [slot.desktopRatio, slot.mobileRatio]
    const missingRatios =
      candidates.length === 0 ? [] : [...new Set(declared.filter((r) => !nativeRatios.has(r)))]

    return { slot, state, candidateCount: candidates.length, boundCount, missingRatios }
  })

  // Registry order, not alphabetical: the registry is ordered by how a visitor meets the site,
  // and a Gaps tab sorted a-z would open on /about rather than on the home hero.
  const pageOrder = [...new Set(slots.map((s) => s.page))]
  const pages: PageStatus[] = pageOrder.map((page) => {
    const pageSlots = statuses.filter((s) => s.slot.page === page)
    return {
      page,
      slots: pageSlots,
      gapCount: pageSlots.filter((s) => s.state === 'GAP').length,
    }
  })

  const thinFamilies: ThinFamily[] = [...assetsByFamily.entries()]
    .map(([family, assets]) => ({
      family,
      assetCount: assets.length,
      slotKeys: statuses
        .filter((s) => s.state === 'THIN' && s.slot.fillableBy.includes(family))
        .map((s) => s.slot.key),
    }))
    .filter((f) => f.slotKeys.length > 0)
    .sort((a, b) => a.assetCount - b.assetCount || a.family.localeCompare(b.family))

  const claimed = new Set(slots.flatMap((s) => s.fillableBy))
  const orphanFamilies: OrphanFamily[] = [...assetsByFamily.entries()]
    .filter(([family]) => !claimed.has(family))
    .map(([family, assets]) => ({ family, assetCount: assets.length }))
    .sort((a, b) => b.assetCount - a.assetCount || a.family.localeCompare(b.family))

  const count = (state: SlotState): number => statuses.filter((s) => s.state === state).length

  return {
    pages,
    gaps: statuses.filter((s) => s.state === 'GAP'),
    thinFamilies,
    orphanFamilies,
    totals: {
      slots: statuses.length,
      filled: count('FILLED'),
      covered: count('COVERED'),
      thin: count('THIN'),
      gap: count('GAP'),
    },
  }
}

/**
 * Gaps that should earn a generation brief in `HIGGSFIELD_MASTER_ASSET_PLAN.md`.
 *
 * `EMPTY_STATE` gaps are excluded, and that exclusion is the point of the function rather than a
 * detail of it. `/portfolio` has no assets because Rivya's delivered work has not been confirmed;
 * generating a picture of a delivered project would fabricate the business fact the whole D10
 * verification workflow exists to prevent. The plan generator must not be able to reach that slot
 * by accident, so it asks here rather than filtering `report.gaps` itself.
 */
export function briefableGaps(report: GapReport): readonly SlotStatus[] {
  return report.gaps.filter((s) => s.slot.resolution === 'GENERATE')
}
