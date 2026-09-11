import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'

type Client = SupabaseClient<Database>

/**
 * Counts for the Studio dashboard.
 *
 * EVERY QUERY IS WRITTEN OUT. There is no `count(table: string)` here, and there must not be: a
 * function taking a relation name is an injection-shaped API even when today's only callers pass
 * constants, and it defeats the generated `Database` types — `from(someString)` is untyped, so a
 * renamed table would compile and fail at runtime in front of the owner.
 *
 * A count is `head: true`, so PostgREST returns the number in a header and no rows cross the wire.
 *
 * THESE RUN AS THE SIGNED-IN USER. RLS applies, so a role that cannot see draft products counts
 * none of them — which is the correct answer for that person rather than a leak of the total.
 */

/** A count that failed is `null`, never 0. The dashboard must be able to tell them apart. */
export type MetricCount = number | null

async function count(
  client: Client,
  build: (c: Client) => PromiseLike<{ count: number | null; error: unknown }>,
): Promise<MetricCount> {
  try {
    const { count: value, error } = await build(client)
    if (error) return null
    return value ?? null
  } catch {
    // Swallowed on purpose: one unreachable card must not take the dashboard down. The null is
    // what the renderer turns into "could not be read", which is different from a zero.
    return null
  }
}

export function countProducts(client: Client): Promise<MetricCount> {
  return count(client, (c) => c.from('products').select('*', { count: 'exact', head: true }))
}

export function countProductsByStatus(
  client: Client,
  status: Database['public']['Enums']['content_status'],
): Promise<MetricCount> {
  return count(client, (c) =>
    c.from('products').select('*', { count: 'exact', head: true }).eq('status', status),
  )
}

export function countCollections(client: Client): Promise<MetricCount> {
  return count(client, (c) => c.from('collections').select('*', { count: 'exact', head: true }))
}

export function countMediaAssets(client: Client): Promise<MetricCount> {
  return count(client, (c) => c.from('media_assets').select('*', { count: 'exact', head: true }))
}

/* --- Phase 37: the FEAT §17 cards whose tables now exist ---------------------------------------- */

const OPEN_STATUSES = ['NEW', 'READ', 'IN_CONVERSATION'] as const

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export function countLargeFormatPublished(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PUBLISHED')
      .eq('is_large_format', true),
  )
}

export function countPortfolioProjects(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c.from('portfolio_projects').select('*', { count: 'exact', head: true }),
  )
}

export function countJournalArticles(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c.from('journal_articles').select('*', { count: 'exact', head: true }),
  )
}

export function countOpenInquiries(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('inquiries')
      .select('*', { count: 'exact', head: true })
      .in('pipeline_status', [...OPEN_STATUSES]),
  )
}

export function countOpenCommissionInquiries(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('inquiries')
      .select('*', { count: 'exact', head: true })
      .in('pipeline_status', [...OPEN_STATUSES])
      .eq('kind', 'COMMISSION'),
  )
}

export function countResearchRunsLast7Days(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('research_runs')
      .select('*', { count: 'exact', head: true })
      .gte('queued_at', daysAgo(7)),
  )
}

export function countResearchProductsNewLast7Days(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('research_products')
      .select('*', { count: 'exact', head: true })
      .gte('first_seen_at', daysAgo(7)),
  )
}

/** Material changes nobody has decided on — the Phase 29 review queue. */
export function countUndecidedMaterialChanges(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('research_changes')
      .select('*', { count: 'exact', head: true })
      .eq('materiality', 'MATERIAL')
      .is('decided_action', null),
  )
}

export function countResearchProductsAwaitingReview(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('research_products')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'REVIEW')
      .eq('disposition', 'NONE'),
  )
}

export function countOpenShortlistEntries(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('research_shortlist_entries')
      .select('*', { count: 'exact', head: true })
      .is('closed_at', null),
  )
}

export function countUnarchivedConfirmations(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('research_confirmations')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null),
  )
}

/** Higgsfield assets not yet migrated, or still carrying draft alt text the owner has not reviewed. */
export function countHiggsfieldPending(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('media_assets')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'HIGGSFIELD')
      .or('migrated_at.is.null,owner_verification.eq.OWNER_VERIFICATION_REQUIRED'),
  )
}

/**
 * The research half of the Data Quality card: ERROR-severity validation issues nobody dismissed.
 * The catalogue half (`lib/catalog/validation.ts`) is computed per product on its editor and is
 * not summed here — a count of "products failing a rule" would need every product re-validated on
 * each dashboard load.
 */
export function countResearchValidationErrors(client: Client): Promise<MetricCount> {
  return count(client, (c) =>
    c
      .from('research_validation_issues')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'ERROR')
      .eq('is_dismissed', false),
  )
}
