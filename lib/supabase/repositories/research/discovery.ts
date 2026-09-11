import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research discovery'

/**
 * The two counts the digest asks that are about PRODUCTS rather than about changes: what appeared,
 * and what stopped appearing.
 *
 * "DISAPPEARED" IS THE HARDER OF THE TWO AND IS NOT A DELETION. Nothing removes a research product
 * — the evidence stays — so a product that has gone from a competitor's catalogue is one whose
 * `last_seen_at` has stopped moving while the source kept being crawled successfully. That
 * distinction is the whole point: a product not seen because the source has been down for a week
 * has not disappeared, and reporting it as discontinued would be a claim about somebody else's
 * business drawn from our own outage.
 *
 * SO THE TEST IS AGAINST THE SOURCE'S OWN SUCCESSFUL RUNS, not against the clock. The phase
 * document says "older than two successful runs", and two rather than one is what absorbs a single
 * partial crawl that happened to miss a page.
 */

export async function countProductsFirstSeenBetween(
  client: Client,
  from: Date,
  to: Date,
): Promise<number> {
  const { count, error } = await client
    .from('research_products')
    .select('id', { count: 'exact', head: true })
    .gte('first_seen_at', from.toISOString())
    .lt('first_seen_at', to.toISOString())
  if (error !== null) throw toRepositoryError(ENTITY, 'discovered', 'window', error)
  return count ?? 0
}

/**
 * When the second-most-recent successful run for each source finished.
 *
 * NULL FOR A SOURCE WITH FEWER THAN TWO SUCCESSFUL RUNS, and the caller must treat that as "cannot
 * tell yet" rather than as "everything has disappeared". A source crawled once has no baseline, and
 * the digest says nothing about it instead of reporting its entire catalogue as gone.
 */
export async function penultimateSuccessBySource(
  client: Client,
  limit = 500,
): Promise<ReadonlyMap<string, string>> {
  const { data, error } = await client
    .from('research_runs')
    .select('source_id, finished_at')
    .eq('status', 'SUCCEEDED')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'runs', 'succeeded', error)

  const seen = new Map<string, string[]>()
  for (const row of data ?? []) {
    if (row.source_id === null || row.finished_at === null) continue
    const list = seen.get(row.source_id) ?? []
    if (list.length < 2) list.push(row.finished_at)
    seen.set(row.source_id, list)
  }

  const penultimate = new Map<string, string>()
  for (const [sourceId, finishes] of seen) {
    const second = finishes[1]
    if (second !== undefined) penultimate.set(sourceId, second)
  }
  return penultimate
}

/** How many of a source's products have not been seen since the given moment. */
export async function countProductsNotSeenSince(
  client: Client,
  sourceId: string,
  since: string,
): Promise<number> {
  const { count, error } = await client
    .from('research_products')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', sourceId)
    .lt('last_seen_at', since)
    .neq('disposition', 'REJECTED')
  if (error !== null) throw toRepositoryError(ENTITY, 'disappeared', sourceId, error)
  return count ?? 0
}

/**
 * Products whose newest stored version arrived recently, for the detection pass.
 *
 * WHY NOT "WHICH PRODUCTS DID THE RUN TOUCH": because the drain loop returns counts rather than a
 * list, and threading a list of ids back through it would make every slice carry a payload that
 * grows with the slice. A version only exists where the content hash DIFFERED, so "a version was
 * written in the last few minutes" is already exactly "this page said something new" — the
 * expensive part of the question was answered when the version was or was not written.
 *
 * THE WINDOW OVERLAPS THE TICK ON PURPOSE. Detection is idempotent by
 * `(product, field, version_after)`, so re-examining a product the previous tick already diffed
 * costs one upsert that changes nothing — and missing one because a version landed on a tick
 * boundary would leave a change undetected until the page moved again, which could be months.
 */
export async function listProductsWithRecentVersions(
  admin: Client,
  since: Date,
  limit = 200,
): Promise<readonly { readonly id: string; readonly sourceId: string }[]> {
  const { data, error } = await admin
    .from('research_product_versions')
    .select('research_product_id, observed_at')
    .gte('observed_at', since.toISOString())
    .order('observed_at', { ascending: false })
    .limit(limit * 4)
  if (error !== null) throw toRepositoryError(ENTITY, 'recent versions', 'window', error)

  const productIds = [...new Set((data ?? []).map((row) => row.research_product_id))].slice(
    0,
    limit,
  )
  if (productIds.length === 0) return []

  const { data: products, error: productError } = await admin
    .from('research_products')
    .select('id, source_id')
    .in('id', productIds)
  if (productError !== null) {
    throw toRepositoryError(ENTITY, 'recent products', 'window', productError)
  }
  return (products ?? []).map((row) => ({ id: row.id, sourceId: row.source_id }))
}
