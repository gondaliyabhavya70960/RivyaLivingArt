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
 * THE JOIN IS ON `slot_key`, AND THAT IS A CONTRACT PHASE 08 MUST HONOUR. `media_usages.slot_key`
 * is free text as far as the database is concerned — the check constraint only requires it to be
 * non-blank, and neither the schema nor CANONICAL-DECISIONS fixes a vocabulary for it. This
 * registry supplies one: **a `PAGE_SECTION` binding writes the registry key verbatim into
 * `slot_key`**. Phase 08 could instead have written a section-scoped short key (`media`, `card.3`)
 * and left this engine to join through `page_sections`, but that table does not exist yet, and a
 * gap report that needed it could not run until Phase 08 shipped — which is the wrong way round,
 * since the gap list is what Phase 08 is supposed to work from.
 *
 * REPEATING SLOTS TAKE THE INDEX FORM the `media_usages` comment describes: a slot needing four
 * cards mints `collection.decor.hero[0]` … `[3]`, because `(context_type, context_id, slot_key,
 * role)` is unique and four cards in one role would otherwise collide on one key. `slotKeyOf`
 * below strips that index, so the four bindings count against the one declared slot.
 *
 * A binding whose key matches no declared slot is invisible here by design: it is a CMS row for a
 * surface the design never claimed, which Phase 08 review should catch, not something this engine
 * should invent a slot for.
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

/**
 * The declared slot a `media_usages.slot_key` belongs to.
 *
 * Strips the repeating-slot index: `collection.decor.hero[2]` is the third card of one declared
 * slot, not a slot of its own. Without this, a category page bound with four cards would report
 * its slot as still unbound while four rows pointed at it.
 */
export function slotKeyOf(bindingKey: string): string {
  const index = bindingKey.indexOf('[')
  return index === -1 ? bindingKey : bindingKey.slice(0, index)
}

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
    const key = slotKeyOf(binding.slot_key)
    boundBySlot.set(key, (boundBySlot.get(key) ?? 0) + 1)
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

/**
 * The asset ID a brief for this slot should mint, and the brief skeleton to paste into
 * `HIGGSFIELD_MASTER_ASSET_PLAN.md`.
 *
 * THE ID SHAPE IS D6 AS AMENDED BY A1: `<PAGE>-<SECTION>[-<KIND>]-<NNN>`, and explicitly NOT a
 * manifest family prefix. `check-asset-ids.py` fails the build on the second form, because a
 * planned `WALL-ART-021` is the id the family allocator will mint for itself the moment
 * `wall-art` grows to 21 — and then two different pictures answer to one name. Deriving from the
 * slot key rather than from the family is what makes that impossible: a slot key is a position on
 * a page, and no family is named after one.
 *
 * The skeleton deliberately leaves the prompt, the gate answers and the alt text empty. Those are
 * the judgements a person is supposed to make — prefilling them with something plausible is how a
 * brief gets approved without anyone having answered "does something existing already fit?", which
 * is the only question the gate exists to ask.
 */
export function suggestedAssetId(slot: MediaSlot, ordinal = 1): string {
  return `${slot.key.toUpperCase().replaceAll('.', '-')}-${String(ordinal).padStart(3, '0')}`
}

/**
 * Dashes are not a distinction anybody will make.
 *
 * `LARGE-FORMAT-COFFEE-001` and `LARGEFORMAT-COFFEE-001` are different strings and the same name.
 * The first is what the slot key `large-format.coffee` mints; the second is what the family
 * allocator mints for `largeformat-coffee` once that family has a second asset. A guard that
 * compared them literally would pass, and two different pictures would end up answering to what
 * every human reading the document takes to be one identifier.
 */
function normalise(value: string): string {
  return value.toUpperCase().replaceAll('-', '').replaceAll('.', '')
}

/**
 * The manifest family a candidate ID would be confused with, or `null`.
 *
 * D6 as amended by A1: a planned ID may never take the form `<FAMILY>-<NNN>`, because that is
 * precisely the ID the family allocator will mint for itself later.
 */
export function collidingFamily(candidateId: string, families: Iterable<string>): string | null {
  const prefix = normalise(candidateId.slice(0, candidateId.lastIndexOf('-')))
  for (const family of families) {
    if (normalise(family) === prefix) return family
  }
  return null
}

/**
 * The brief skeleton to paste into `HIGGSFIELD_MASTER_ASSET_PLAN.md` §6.1.
 *
 * THE SKELETON LEAVES ITS JUDGEMENTS BLANK. The prompt, the four gate answers and the alt text
 * are what a person is supposed to decide — prefilling them with something plausible is how a
 * brief gets approved without anyone having answered "does something existing already fit?",
 * which is the only question the gate exists to ask.
 *
 * AND IT REFUSES TO MINT A COLLIDING ID rather than minting one and hoping CI catches it. Where
 * the slot key would produce a name the family allocator will later claim, the ID field says so
 * and names the family, because choosing the replacement is a naming judgement — the plan's own
 * briefs solve exactly this case by hand, calling the `large-format.coffee` asset
 * `LARGE-COFFEE-CARD-001` rather than anything derived from `large-format`.
 */
export function briefSkeleton(status: SlotStatus, families: Iterable<string>): string {
  const { slot } = status
  const candidate = suggestedAssetId(slot)
  const collision = collidingFamily(candidate, families)
  const family = slot.key.replaceAll('.', '-')

  const idField =
    collision === null
      ? `\`${candidate}\``
      : `**TODO** — \`${candidate}\` collides with the manifest family \`${collision}\` ` +
        '(D6 / A1). Choose a distinct prefix; see §3.1'

  return [
    `#### G?? · ${idField}`,
    '',
    '| Field | Value |',
    '|---|---|',
    '| Status | `NEW_GENERATION_REQUIRED` |',
    `| Type | ${slot.kind.toLowerCase()} |`,
    `| Planned family (see §3.1) | \`${family}\` |`,
    `| Page · section | \`${slot.page}\` · \`${slot.key.split('.').slice(1).join('-')}\` |`,
    `| Aspect ratio | ${slot.desktopRatio} desktop · ${slot.mobileRatio} mobile |`,
    `| Slot | \`${slot.key}\` — ${slot.label} |`,
    `| Candidates in the library | ${String(status.candidateCount)} |`,
    '| Cloudinary folder | TODO — add to `lib/media/folders.ts` first |',
    '| Suggested model | TODO |',
    '| Gate | Q1 ? · Q2 ? · Q3 ? · Q4 ? — answer all four before generating |',
    '',
    '**Prompt**',
    '',
    '```',
    'TODO — house grammar, HIGGSFIELD_GUIDE.md §2. Recipe A or B only.',
    '```',
    '',
    '**Negative prompt** — `RIVYA-NEG-V2`.',
    '',
    '**Alt text (draft, §43-compliant)**',
    '> TODO',
  ].join('\n')
}
