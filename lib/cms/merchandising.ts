import 'server-only'

import type { EntityCard, SelectorClient } from '@/lib/cms/selectors/types'
import { isLive } from '@/lib/cms/windowing'
import type { Database } from '@/lib/supabase/database.types'
import {
  getSlotByKey,
  listEntries,
  listPublishedTargets,
  listRecentlyPublished,
  type TargetRow,
} from '@/lib/supabase/repositories/merchandising'
import type { MerchandisingEntry, MerchandisingSlot } from '@/lib/supabase/schemas'

import {
  categorySlotKey,
  fallbackModeOf,
  MERCHANDISING_SLOTS,
  type MerchFallbackMode,
  type SlotSpec,
} from './merchandising-register'

export {
  categorySlotKey,
  D3_CATEGORY_SLUGS,
  EDITORIAL_CTA_PATHS,
  isEditorialCtaPath,
  MERCHANDISING_SLOTS,
  OWNING_STUDIO_ROUTES,
  RECENCY_RULE,
  slotSpec,
  type MerchFallbackMode,
  type SlotKey,
  type SlotSpec,
} from './merchandising-register'

type RelationEntity = Database['public']['Enums']['relation_entity']

/**
 * The resolution ladder — stated once, implemented once.
 *
 * FIVE STEPS, IN ORDER, AND NO SIXTH (PHASE-16-22 §Phase 22):
 *
 *   1. Load the slot's entries that are PUBLISHED and inside their half-open window at `now`.
 *   2. Drop every entry whose target is missing, archived or not PUBLISHED — re-checked on every
 *      read, so a stale entry renders nothing rather than a broken card.
 *   3. If what survives reaches `min_items`, that is the answer, in the curator's order, capped at
 *      `max_items`. Provenance CURATED.
 *   4. Else, if the slot has `auto_fill`, top up from the most recently PUBLISHED entities of the
 *      slot's first type — recency and nothing else, because recency is the only signal this site
 *      has that is not manufactured (FEAT §28). Provenance RULE_FILLED, with the rule named.
 *   5. Else the slot's fallback mode: EDITORIAL_BLOCK, HIDE_SECTION or SHOW_EMPTY_STATE.
 *      Provenance FALLBACK. A placeholder card is not a step.
 *
 * WHY THE WINDOW IS CHECKED HERE AS WELL AS IN RLS. A visitor's client is filtered by 0201 already;
 * a Studio preview reads the page with the editor's own client, which that clause does not bind.
 * `isLive` is the same rule `page_sections` uses, in the one file that states it, so the preview
 * shows what the visitor will get and not what the editor may see.
 *
 * WHY THE RESULT CARRIES PROVENANCE. A band that reads "three products" tells nobody whether a
 * person chose them or a rule did. `provenance` reaches the page as a data attribute and the
 * Studio as a word, so the difference is visible to whoever is deciding whether the site is
 * curated or merely populated. `rule` is the sentence the slot's owner wrote when switching
 * `auto_fill` on, never a name invented here.
 */

export type Provenance = 'CURATED' | 'RULE_FILLED' | 'FALLBACK'

export type ResolvedFallback = {
  readonly mode: MerchFallbackMode
  /** The section an EDITORIAL_BLOCK draws tiles from, when the slot names one. Null means "the page's material-story". */
  readonly sectionId: string | null
}

export type ResolvedSlot = {
  readonly key: string
  readonly cards: readonly EntityCard[]
  readonly provenance: Provenance
  /** The human-readable rule applied at step 4, or null. */
  readonly rule: string | null
  /** Present when provenance is FALLBACK. */
  readonly fallback: ResolvedFallback | null
  /**
   * `OK` — cards were returned. `EMPTY` — the slot exists and resolved to nothing. `UNKNOWN_SLOT`
   * — no row carries this key on this database, which is a migration that has not run and is
   * reported, never swallowed into `EMPTY`.
   */
  readonly reason: 'OK' | 'EMPTY' | 'UNKNOWN_SLOT'
  /** The slot row, for the Studio's preview. Null for UNKNOWN_SLOT. */
  readonly slot: MerchandisingSlot | null
}

export type ResolveOptions = {
  readonly now?: Date
  /** The block's own cap, applied beneath the slot's `max_items`. */
  readonly limit?: number
}

/** Where a card of each type points. `MATERIAL` has no page of its own and is admitted by no slot; the facet is its honest address. */
const HREF_BY_TYPE: Readonly<Record<RelationEntity, (slug: string) => string>> = {
  PRODUCT: (slug) => `/product/${slug}`,
  COLLECTION: (slug) => `/collections/${slug}`,
  CATEGORY: (slug) => `/collection/${slug}`,
  JOURNAL_ARTICLE: (slug) => `/journal/${slug}`,
  PORTFOLIO_PROJECT: (slug) => `/portfolio/${slug}`,
  MATERIAL: (slug) => `/collection?material=${encodeURIComponent(slug)}`,
}

function toCard(type: RelationEntity, row: TargetRow): EntityCard {
  return {
    id: row.id,
    key: row.slug,
    title: row.title,
    summary: row.summary,
    href: HREF_BY_TYPE[type](row.slug),
    mediaId: row.hero_media_id,
  }
}

function fallbackFor(
  spec: SlotSpec | null,
  slot: MerchandisingSlot | null,
): ResolvedFallback | null {
  if (slot !== null) return { mode: slot.fallback_mode, sectionId: slot.fallback_section_id }
  if (spec !== null) return { mode: fallbackModeOf(spec), sectionId: null }
  return null
}

/**
 * Resolve one slot.
 *
 * ONE READ PER ENTITY TYPE, NOT ONE PER ENTRY. A slot admitting products and collections issues at
 * most two target queries whatever its length; a slot with no live entries issues none beyond the
 * slot and the entry list.
 */
export async function resolveSlot(
  client: SelectorClient,
  key: string,
  options: ResolveOptions = {},
): Promise<ResolvedSlot> {
  const now = options.now ?? new Date()
  const spec = MERCHANDISING_SLOTS.find((candidate) => candidate.key === key) ?? null

  const slot = await getSlotByKey(client, key)
  if (slot === null) {
    return {
      key,
      cards: [],
      provenance: 'FALLBACK',
      rule: null,
      fallback: fallbackFor(spec, null),
      reason: 'UNKNOWN_SLOT',
      slot: null,
    }
  }

  const cap = Math.max(1, Math.min(slot.max_items, options.limit ?? slot.max_items))

  // Step 1 — live entries, in the repository's order (pinned, position, id). A slot that is not
  // itself PUBLISHED has nothing live, whatever its entries say.
  const live: MerchandisingEntry[] =
    slot.status === 'PUBLISHED'
      ? (await listEntries(client, slot.id)).filter((entry) => isLive(entry, now))
      : []

  // Step 2 — re-check every target, one query per type.
  const byType = new Map<RelationEntity, string[]>()
  for (const entry of live) {
    const ids = byType.get(entry.entity_type) ?? []
    ids.push(entry.entity_id)
    byType.set(entry.entity_type, ids)
  }
  const targets = new Map<RelationEntity, Map<string, TargetRow>>()
  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      targets.set(type, await listPublishedTargets(client, type, ids))
    }),
  )
  const survivors: EntityCard[] = []
  for (const entry of live) {
    const row = targets.get(entry.entity_type)?.get(entry.entity_id)
    if (row !== undefined) survivors.push(toCard(entry.entity_type, row))
  }

  // Step 3 — curated.
  if (survivors.length >= slot.min_items) {
    return {
      key,
      cards: survivors.slice(0, cap),
      provenance: 'CURATED',
      rule: null,
      fallback: null,
      reason: 'OK',
      slot,
    }
  }

  // Step 4 — the one rule, named by the slot's owner.
  if (slot.auto_fill && slot.auto_fill_rule !== null) {
    const type = slot.allowed_entity_types[0]
    if (type !== undefined) {
      const topUp = await listRecentlyPublished(
        client,
        type,
        Math.max(0, cap - survivors.length),
        survivors.map((card) => card.id),
      )
      const filled = [...survivors, ...topUp.map((row) => toCard(type, row))]
      if (filled.length >= slot.min_items) {
        return {
          key,
          cards: filled.slice(0, cap),
          provenance: 'RULE_FILLED',
          rule: slot.auto_fill_rule,
          fallback: null,
          reason: 'OK',
          slot,
        }
      }
    }
  }

  // Step 5 — the fallback. There is no sixth step.
  return {
    key,
    cards: [],
    provenance: 'FALLBACK',
    rule: null,
    fallback: fallbackFor(spec, slot),
    reason: 'EMPTY',
    slot,
  }
}

/** The slot key a category page reads, from its slug. Re-exported so a route needs one import. */
export function categoryPinnedSlotKey(categorySlug: string): string {
  return categorySlotKey(categorySlug)
}
