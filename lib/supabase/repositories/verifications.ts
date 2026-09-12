import {
  OWNER_VERIFICATION_REQUIRED,
  VERIFICATION_SURFACES,
  type VerificationTable,
} from '../../cms/verification-backlog'

import type { Database } from '../database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Client = SupabaseClient<Database>

/**
 * HOW MANY OWNER VERIFICATIONS ARE OUTSTANDING — the `/studio` overview card's number (Phase 46).
 *
 * IT MUST MATCH THE HANDOVER DOCUMENT, and that is the whole reason this file exists rather than a
 * count written into the card. `docs/content/INITIAL_CONTENT_INVENTORY.md` carries the generated
 * backlog — every row still `OWNER_VERIFICATION_REQUIRED`, with the Studio screen that resolves it —
 * and a card showing a different figure from the document it links to is worse than no card: the
 * owner cannot tell which one is wrong. Both read the SAME declaration,
 * `lib/cms/verification-backlog.ts`; the document's generator reads it with `pg`, and this reads it
 * through PostgREST as the signed-in user.
 *
 * WHY TWENTY-TWO QUERIES AND NOT ONE. PostgREST has no arbitrary-SQL door, deliberately, so the
 * `union all` the generator uses is not available here. A view or a SECURITY DEFINER function would
 * be one round trip — and a migration, which Phase 46 does not have: its database scope is **None**.
 * So the counts are asked for one table at a time, in parallel, `head: true`, which returns the
 * number in a header and no rows over the wire.
 *
 * EVERY QUERY IS WRITTEN OUT, for the reason `metrics.ts` gives at length: a
 * `count(table: string)` helper is an injection-shaped API even when today's callers pass constants,
 * and `from(someString)` is untyped, so a renamed table would compile and fail in front of the owner.
 * The map below is keyed by `VerificationTable`, so a surface added to the declaration WITHOUT a
 * counter here stops the build rather than quietly reducing the card's total.
 *
 * THESE RUN AS THE SIGNED-IN USER, so RLS applies: a role that cannot read a table counts none of
 * it. That is the correct answer for that person rather than a leak of the total — and it is why a
 * table whose count failed is reported in `unreadable` instead of being counted as zero. The card
 * must be able to say "at least this many".
 */

type HeadCount = PromiseLike<{ count: number | null; error: unknown }>

/**
 * One head-count per table carrying `owner_verification`. Keyed, not listed, so the compiler
 * enforces that the set here and the set declared in `lib/cms/verification-backlog.ts` are the same.
 */
const COUNTERS: Readonly<Record<VerificationTable, (client: Client) => HeadCount>> = {
  categories: (c) =>
    c
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  collections: (c) =>
    c
      .from('collections')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  customization_forms: (c) =>
    c
      .from('customization_forms')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  faqs: (c) =>
    c
      .from('faqs')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  global_content: (c) =>
    c
      .from('global_content')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  journal_articles: (c) =>
    c
      .from('journal_articles')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  journal_categories: (c) =>
    c
      .from('journal_categories')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  materials: (c) =>
    c
      .from('materials')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  media_assets: (c) =>
    c
      .from('media_assets')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  model_variant_labels: (c) =>
    c
      .from('model_variant_labels')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  navigation_items: (c) =>
    c
      .from('navigation_items')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  page_sections: (c) =>
    c
      .from('page_sections')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  pages: (c) =>
    c
      .from('pages')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  portfolio_projects: (c) =>
    c
      .from('portfolio_projects')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  product_attribute_terms: (c) =>
    c
      .from('product_attribute_terms')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  product_specs: (c) =>
    c
      .from('product_specs')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  products: (c) =>
    c
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  research_direction_briefs: (c) =>
    c
      .from('research_direction_briefs')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  seo_entries: (c) =>
    c
      .from('seo_entries')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  seo_keyword_themes: (c) =>
    c
      .from('seo_keyword_themes')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  seo_redirects: (c) =>
    c
      .from('seo_redirects')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
  testimonials: (c) =>
    c
      .from('testimonials')
      .select('*', { count: 'exact', head: true })
      .eq('owner_verification', OWNER_VERIFICATION_REQUIRED),
}

/** One surface's outstanding count, with where the owner clears it. */
export interface OutstandingSurface {
  readonly table: VerificationTable
  readonly surface: string
  /** `null` where no Studio screen edits this table — the backlog document says why. */
  readonly studio: string | null
  readonly count: number
}

export interface OutstandingVerifications {
  /** The sum over the tables that could be read. Never inflated by a failed read. */
  readonly total: number
  /** Surfaces with at least one outstanding row, most outstanding first. */
  readonly surfaces: readonly OutstandingSurface[]
  /** Tables whose count could not be read at all. Named, so the card can say "at least". */
  readonly unreadable: readonly VerificationTable[]
}

/**
 * The card's read. One head-count per table, in parallel, and a failure on one table is reported
 * rather than swallowed as a zero — the same rule `metrics.ts` states: a count that failed is not 0.
 */
export async function countOutstandingVerifications(
  client: Client,
): Promise<OutstandingVerifications> {
  const results = await Promise.all(
    VERIFICATION_SURFACES.map(async (surface) => {
      try {
        const { count, error } = await COUNTERS[surface.table](client)
        if (error !== null && error !== undefined) return { surface, count: null }
        return { surface, count }
      } catch {
        // Swallowed to a null, not to a zero: one unreadable table must not take the overview down,
        // and must not be reported as "nothing outstanding" either.
        return { surface, count: null }
      }
    }),
  )

  const surfaces: OutstandingSurface[] = []
  const unreadable: VerificationTable[] = []
  let total = 0
  for (const result of results) {
    if (result.count === null) {
      unreadable.push(result.surface.table)
      continue
    }
    total += result.count
    if (result.count > 0) {
      surfaces.push({
        table: result.surface.table,
        surface: result.surface.surface,
        studio: result.surface.studio,
        count: result.count,
      })
    }
  }
  surfaces.sort((a, b) => b.count - a.count || (a.surface < b.surface ? -1 : 1))

  return { total, surfaces, unreadable }
}
