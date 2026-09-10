/**
 * The register of merchandising slots — the eleven addresses migration 0200 creates.
 *
 * WHY A REGISTER IN CODE WHEN THE ROWS ARE IN THE DATABASE. Because a slot has two halves that live
 * in two places: the row (its minimum, its fallback, its entries) and the reader (the block or route
 * that calls `resolveSlot` with its key). A key typed in a route that no row carries resolves to
 * UNKNOWN_SLOT; a row no route reads is a list nobody renders. This file is the contract between
 * the two, `tests/unit/merchandising-register.test.ts` asserts the migration inserts exactly these
 * keys, and the Studio draws its editors from it.
 *
 * NO `server-only` HERE, deliberately: the register is data, the Studio's client components read it
 * to label a slot, and the migration test reads it from Node. Nothing in it touches a database.
 *
 * NO PRODUCT SLUG APPEARS IN THIS FILE OR ANY OTHER. The category slugs below are D3's fixed route
 * segments — addresses, not inventory — and `tests/unit/merchandising-register.test.ts` reads
 * `components/sections/**` to assert no `/product/<slug>` literal has crept in anywhere.
 */

export const MERCH_FALLBACK_MODES = ['EDITORIAL_BLOCK', 'HIDE_SECTION', 'SHOW_EMPTY_STATE'] as const
export type MerchFallbackMode = (typeof MERCH_FALLBACK_MODES)[number]

export type SlotEntityType =
  'PRODUCT' | 'COLLECTION' | 'CATEGORY' | 'JOURNAL_ARTICLE' | 'PORTFOLIO_PROJECT' | 'MATERIAL'

export type OwningStudioRoute =
  | '/studio/merchandising/homepage'
  | '/studio/merchandising/store'
  | '/studio/merchandising/featured'

export const OWNING_STUDIO_ROUTES: readonly OwningStudioRoute[] = [
  '/studio/merchandising/homepage',
  '/studio/merchandising/store',
  '/studio/merchandising/featured',
]

export type SlotSpec = {
  readonly key: string
  /** The D3 path the slot appears on. Exactly one. */
  readonly surface: string
  /** The one D4 screen that writes it. */
  readonly owningStudioRoute: OwningStudioRoute
  readonly entityTypes: readonly SlotEntityType[]
  readonly minItems: number
  readonly fallback: MerchFallbackMode
  /** Which SEED §10 band, or route region, reads it — for the Studio's own labelling. */
  readonly readBy: string
}

/**
 * The seven D3 categories in SEED §13's order, which is also SEED §56's content priority and the
 * store's default order: large-format furniture first, gifts last.
 */
export const D3_CATEGORY_SLUGS = [
  'furniture',
  'collectible-design',
  '3d-resin',
  'wall-statement-art',
  'preservation',
  'decor',
  'gifts',
] as const

/** `CATEGORY_PINNED_<SLUG>`: upper-cased, `-` → `_`. The same rule `merchandising_category_slot_key()` applies in SQL. */
export function categorySlotKey(categorySlug: string): string {
  return `CATEGORY_PINNED_${categorySlug.toUpperCase().replace(/-/g, '_')}`
}

const GLOBAL_SLOTS: readonly SlotSpec[] = [
  {
    key: 'HOMEPAGE_SELECTED_WORKS',
    surface: '/',
    owningStudioRoute: '/studio/merchandising/homepage',
    entityTypes: ['PRODUCT'],
    minItems: 3,
    fallback: 'EDITORIAL_BLOCK',
    readBy: 'selected-works (§10-04)',
  },
  {
    key: 'HOMEPAGE_FEATURED_COLLECTIONS',
    surface: '/',
    owningStudioRoute: '/studio/merchandising/featured',
    entityTypes: ['COLLECTION', 'CATEGORY'],
    minItems: 3,
    fallback: 'HIDE_SECTION',
    readBy: 'featured-collections (§10-03)',
  },
  {
    key: 'HOMEPAGE_JOURNAL_STRIP',
    surface: '/',
    owningStudioRoute: '/studio/merchandising/homepage',
    entityTypes: ['JOURNAL_ARTICLE'],
    minItems: 3,
    fallback: 'HIDE_SECTION',
    readBy: 'journal-strip (§10-12)',
  },
  {
    key: 'STORE_FEATURED_ROW',
    surface: '/collection',
    owningStudioRoute: '/studio/merchandising/featured',
    entityTypes: ['PRODUCT', 'COLLECTION'],
    minItems: 3,
    fallback: 'HIDE_SECTION',
    readBy: 'the featured row above the catalogue',
  },
]

const CATEGORY_SLOTS: readonly SlotSpec[] = D3_CATEGORY_SLUGS.map((slug) => ({
  key: categorySlotKey(slug),
  surface: `/collection/${slug}`,
  owningStudioRoute: '/studio/merchandising/store',
  entityTypes: ['PRODUCT'],
  minItems: 1,
  fallback: 'SHOW_EMPTY_STATE',
  readBy: 'the pinned region above the category grid',
}))

/** Four global slots, then one per D3 category. Eleven. */
export const MERCHANDISING_SLOTS: readonly SlotSpec[] = [...GLOBAL_SLOTS, ...CATEGORY_SLOTS]

export type SlotKey = (typeof GLOBAL_SLOTS)[number]['key'] | `CATEGORY_PINNED_${string}`

export function slotSpec(key: string): SlotSpec | null {
  return MERCHANDISING_SLOTS.find((spec) => spec.key === key) ?? null
}

export function fallbackModeOf(spec: SlotSpec): MerchFallbackMode {
  return spec.fallback
}

/**
 * The only destinations an editorial-fallback tile may link to (PHASE-16-22 §Phase 22): the
 * large-format page, the catalogue landing, and the commission brief. Never a product, because a
 * tile that opens a product page is a product card that forgot its price.
 */
export const EDITORIAL_CTA_PATHS = ['/large-format', '/collection', '/custom-commissions'] as const

export function isEditorialCtaPath(
  href: string | null,
): href is (typeof EDITORIAL_CTA_PATHS)[number] {
  return href !== null && (EDITORIAL_CTA_PATHS as readonly string[]).includes(href)
}

/**
 * The one rule step 4 can apply, as the words the Studio shows beside the `auto_fill` switch. The
 * slot's own `auto_fill_rule` is what the resolver reports; this is the default an owner starts
 * from, so nobody has to invent a sentence to turn the switch on.
 */
export const RECENCY_RULE = 'Most recently published first'
