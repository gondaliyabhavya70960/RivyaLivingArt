import type { Permission } from '../auth/permissions'
import { MANAGED_TABLES, type ManagedTable } from '../auth/table-permissions'

/**
 * The FEAT §17 dashboard cards, and the phase that makes each one answerable.
 *
 * THE POINT OF THIS FILE IS THAT A CARD CANNOT SHOW A NUMBER IT CANNOT SOURCE. Every card names the
 * table it counts and the phase that creates it. A card whose table does not exist yet renders as
 * unavailable, naming that phase — it does not render `0`, and it is not quietly omitted.
 *
 * Both alternatives are worse in the same specific way. A `0` is indistinguishable from a real zero,
 * so an owner reads "Open Enquiries: 0" as "nobody has enquired" when the truth is that enquiries do
 * not exist yet — a fabricated business fact, which D10 forbids. Omitting the card hides that the
 * measure is even intended, so nobody asks for it.
 *
 * `cardsForRole` also honours FEAT §17's other instruction — "do not overload every role with
 * irrelevant metrics" — by filtering on the permission that governs the underlying data. A
 * researcher has no use for Draft Products, and a merchandiser none for Data Quality Errors.
 */

/**
 * The last phase whose tables exist. Raised by the phase that adds them, with its migration.
 *
 * PHASE 37 RAISED IT FROM 5 TO 36 and gave every card a query (`readCounts` on the overview page,
 * `lib/supabase/repositories/metrics.ts`). Two cards stay unavailable and say which phase: System
 * Health (38, `system_logs`) and Missing Media (43, the slot coverage report).
 */
export const BUILT_THROUGH_PHASE = 36

export type DashboardCard = {
  readonly id: string
  /** Key into components/studio/strings.ts. Never a literal label. */
  readonly labelKey: string
  /** Who this metric is for. A card is hidden from roles that cannot read its data anyway. */
  readonly permission: Permission
  /** The phase that creates the table this counts. */
  readonly availableFromPhase: number
  /**
   * The relation it counts, once available.
   *
   * Typed as `ManagedTable` only for cards that are available NOW — that is what lets
   * `dashboard-cards.test.ts` assert that no available card names a relation that does not exist.
   * Future cards carry the intended name as a plain string, which is documentation rather than a
   * query, because the table genuinely is not there to be typed against.
   */
  readonly table: ManagedTable | string
}

export const DASHBOARD_CARDS: readonly DashboardCard[] = [
  // Available now — Phase 03 created these tables.
  {
    id: 'products',
    labelKey: 'studio.card.products',
    permission: 'catalog.read',
    availableFromPhase: 3,
    table: 'products',
  },
  {
    id: 'products-published',
    labelKey: 'studio.card.productsPublished',
    permission: 'catalog.read',
    availableFromPhase: 3,
    table: 'products',
  },
  {
    id: 'products-draft',
    labelKey: 'studio.card.productsDraft',
    permission: 'catalog.read',
    availableFromPhase: 3,
    table: 'products',
  },
  {
    id: 'collections',
    labelKey: 'studio.card.collections',
    permission: 'catalog.read',
    availableFromPhase: 3,
    table: 'collections',
  },
  {
    id: 'media-assets',
    labelKey: 'studio.card.mediaAssets',
    permission: 'media.read',
    availableFromPhase: 3,
    table: 'media_assets',
  },

  // Not yet. Each names the phase that will make it answerable.
  {
    id: 'products-large-format',
    labelKey: 'studio.card.productsLargeFormat',
    permission: 'catalog.read',
    availableFromPhase: 30,
    table: 'products',
  },
  {
    id: 'portfolio-projects',
    labelKey: 'studio.card.portfolioProjects',
    permission: 'content.read',
    availableFromPhase: 17,
    table: 'portfolio_projects',
  },
  {
    id: 'journal-articles',
    labelKey: 'studio.card.journalArticles',
    permission: 'content.read',
    availableFromPhase: 18,
    table: 'journal_articles',
  },
  {
    id: 'inquiries-open',
    labelKey: 'studio.card.inquiriesOpen',
    permission: 'inquiries.read',
    availableFromPhase: 20,
    table: 'inquiries',
  },
  {
    id: 'inquiries-commission',
    labelKey: 'studio.card.inquiriesCommission',
    permission: 'inquiries.read',
    availableFromPhase: 20,
    table: 'inquiries',
  },
  {
    id: 'scraper-runs',
    labelKey: 'studio.card.scraperRuns',
    permission: 'research.read',
    availableFromPhase: 25,
    table: 'research_runs',
  },
  {
    id: 'competitor-products-new',
    labelKey: 'studio.card.competitorProductsNew',
    permission: 'research.read',
    availableFromPhase: 29,
    table: 'research_changes',
  },
  {
    id: 'competitor-products-changed',
    labelKey: 'studio.card.competitorProductsChanged',
    permission: 'research.read',
    availableFromPhase: 29,
    table: 'research_changes',
  },
  {
    id: 'products-awaiting-review',
    labelKey: 'studio.card.productsAwaitingReview',
    permission: 'research.read',
    availableFromPhase: 29,
    table: 'research_changes',
  },
  {
    id: 'products-shortlisted',
    labelKey: 'studio.card.productsShortlisted',
    permission: 'research.read',
    availableFromPhase: 35,
    table: 'research_products',
  },
  {
    id: 'products-confirmed',
    labelKey: 'studio.card.productsConfirmed',
    permission: 'research.read',
    availableFromPhase: 35,
    table: 'research_products',
  },
  {
    id: 'media-missing',
    labelKey: 'studio.card.mediaMissing',
    permission: 'media.read',
    availableFromPhase: 43,
    table: 'media_assets',
  },
  {
    id: 'higgsfield-pending',
    labelKey: 'studio.card.higgsfieldPending',
    permission: 'media.read',
    availableFromPhase: 7,
    table: 'media_assets',
  },
  {
    id: 'data-quality-errors',
    labelKey: 'studio.card.dataQualityErrors',
    permission: 'catalog.read',
    availableFromPhase: 28,
    table: 'research_validation_issues',
  },
  {
    id: 'system-health',
    labelKey: 'studio.card.systemHealth',
    permission: 'operations.logs.read',
    availableFromPhase: 38,
    table: 'system_logs',
  },
] as const

/** Can this card show a real number today? */
export function isCardAvailable(card: DashboardCard): boolean {
  return card.availableFromPhase <= BUILT_THROUGH_PHASE
}

/** Does this card's relation actually exist? Only meaningful for available cards. */
export function cardTableExists(card: DashboardCard): boolean {
  return (MANAGED_TABLES as readonly string[]).includes(card.table)
}

/** The cards a role should see: the ones governed by a permission they hold. */
export function cardsForRole(held: readonly Permission[]): DashboardCard[] {
  return DASHBOARD_CARDS.filter((card) => held.includes(card.permission))
}
