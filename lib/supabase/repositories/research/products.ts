import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research product'

export type ResearchProductRow = Database['public']['Tables']['research_products']['Row']
export type ResearchStage = Database['public']['Enums']['research_stage']
export type ResearchDisposition = Database['public']['Enums']['research_disposition']

const PRODUCT_COLUMNS =
  'id, source_id, source_url, source_external_id, stage, disposition, first_seen_at, ' +
  'last_seen_at, first_seen_run_id, last_seen_run_id, current_version_id, status, created_at, ' +
  'updated_at, updated_by'

/**
 * Record that a URL was seen, creating the row the first time.
 *
 * `onConflict` UPDATES ONLY THE "LAST SEEN" PAIR, and never `stage` or `disposition`. That is the
 * whole reason this is an upsert with a narrow update rather than a plain one: a nightly refresh
 * re-discovers every product, and an upsert that wrote the defaults would reset a row somebody had
 * moved to SHORTLISTED back to RAW — silently undoing a merchandiser's judgement every night at
 * three. `first_seen_at` is likewise left alone, because it is the one field that answers "when
 * did this appear", and a value that is rewritten on every sighting answers nothing.
 */
export async function recordProductSighting(
  admin: Client,
  input: {
    readonly sourceId: string
    readonly sourceUrl: string
    readonly sourceExternalId: string | null
    readonly runId: string
  },
): Promise<{ id: string; created: boolean }> {
  const nowIso = new Date().toISOString()

  const { data: existing, error: readError } = await admin
    .from('research_products')
    .select('id')
    .eq('source_id', input.sourceId)
    .eq('source_url', input.sourceUrl)
    .maybeSingle()
  if (readError !== null) throw toRepositoryError(ENTITY, 'read', input.sourceUrl, readError)

  if (existing !== null) {
    const { error } = await admin
      .from('research_products')
      .update({ last_seen_at: nowIso, last_seen_run_id: input.runId })
      .eq('id', existing.id)
    if (error !== null) throw toRepositoryError(ENTITY, 'sight', existing.id, error)
    return { id: existing.id, created: false }
  }

  const { data, error } = await admin
    .from('research_products')
    .insert({
      source_id: input.sourceId,
      source_url: input.sourceUrl,
      source_external_id: input.sourceExternalId,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      first_seen_run_id: input.runId,
      last_seen_run_id: input.runId,
    })
    .select('id')
    .single()
  // A CONFLICT HERE IS NOT AN ERROR TO SURFACE. Two invocations can pass the read above at the
  // same moment; the unique index is what makes only one insert win, and the loser simply reads
  // the row the winner made. Failing the whole item over a race the constraint already resolved
  // would be the bug, not the race.
  if (error !== null) {
    if (error.code === '23505') {
      const { data: raced } = await admin
        .from('research_products')
        .select('id')
        .eq('source_id', input.sourceId)
        .eq('source_url', input.sourceUrl)
        .single()
      return { id: raced?.id ?? '', created: false }
    }
    throw toRepositoryError(ENTITY, 'create', input.sourceUrl, error)
  }
  return { id: data.id, created: true }
}

export async function getResearchProduct(
  client: Client,
  id: string,
): Promise<ResearchProductRow | null> {
  const { data, error } = await client
    .from('research_products')
    .select(PRODUCT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as ResearchProductRow | null
}

/**
 * Move one row's stage.
 *
 * CALLED ONLY BY `lib/scraper/core/stage.ts`, and the guard script proves it: no other module may
 * import this function. A stage that can be written from anywhere is a stage whose history is
 * incomplete, and the history is what the review screens read.
 */
export async function writeProductStage(
  admin: Client,
  input: {
    readonly id: string
    readonly stage: ResearchStage
    readonly actorId: string | null
  },
): Promise<void> {
  // Phase 35. The stage-writer guard trigger refuses a change to `stage` or `disposition` unless
  // the transaction-local flag is set, and PostgREST gives this call no transaction of its own —
  // so the write goes through research_write_stage(), which sets the flag and updates in one
  // transaction. Service role only: a session cannot reach the function, and cannot pass the
  // trigger without it.
  const { error } = await admin.rpc('research_write_stage', {
    p_id: input.id,
    p_stage: input.stage,
    p_disposition: undefined,
    p_actor: input.actorId ?? undefined,
  })
  if (error) throw toRepositoryError(ENTITY, 'stage', input.id, error)
}

/** Set a disposition. Orthogonal to the stage — the row keeps whatever stage it reached. */
export async function writeProductDisposition(
  admin: Client,
  input: {
    readonly id: string
    readonly disposition: ResearchDisposition
    readonly actorId: string | null
  },
): Promise<void> {
  const { error } = await admin.rpc('research_write_stage', {
    p_id: input.id,
    p_stage: undefined,
    p_disposition: input.disposition,
    p_actor: input.actorId ?? undefined,
  })
  if (error) throw toRepositoryError(ENTITY, 'disposition', input.id, error)
}

/** Stage counts for the dashboard. Every one of them is zero until a source is approved. */
export async function countProductsByStage(client: Client): Promise<Record<string, number>> {
  const { data, error } = await client.from('research_products').select('stage')
  if (error) throw toRepositoryError(ENTITY, 'count', 'stage', error)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = String(row.stage)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

export async function listResearchProducts(
  client: Client,
  limit = 50,
): Promise<ResearchProductRow[]> {
  const { data, error } = await client
    .from('research_products')
    .select(PRODUCT_COLUMNS)
    .order('last_seen_at', { ascending: false })
    .limit(limit)
  if (error) throw toRepositoryError(ENTITY, 'list', 'recent', error)
  return (data ?? []) as unknown as ResearchProductRow[]
}

/* --- Phase 27: the version pointer, and the lookup the extraction workflow reads it by ---------- */

/**
 * Point a product at the version just written for it.
 *
 * CALLED ONLY WHEN A VERSION WAS CREATED, and `recordProductVersion` returns the flag that decides
 * it. An unchanged page produces no new row — that is what
 * `research_product_versions_unique_content` is for — so re-pointing at the version already stored
 * would be a write that says something moved on a night when nothing did.
 *
 * IT WRITES ONE COLUMN AND DELIBERATELY NOT `updated_at` OR `updated_by`. On this table those two
 * are the record of a PERSON's edit: `writeProductStage` and `writeProductDisposition` both write
 * them together with an actor id, and the review screens read them as "who last touched this row".
 * A cron tick advancing a pointer is not an edit, and writing `updated_by: null` alongside it would
 * erase the merchandiser who shortlisted the product. `recordProductSighting` above takes the same
 * line for the same reason, and neither is an oversight — no research table carries a
 * touch-`updated_at` trigger, so what is written here is exactly what is written.
 */
export async function setCurrentVersionId(
  admin: Client,
  productId: string,
  versionId: string,
): Promise<void> {
  const { error } = await admin
    .from('research_products')
    .update({ current_version_id: versionId })
    .eq('id', productId)
  if (error !== null) throw toRepositoryError(ENTITY, 'version', productId, error)
}

/**
 * One product by the pair that identifies it within a source.
 *
 * `(source_id, source_url)` IS THE IDENTITY THIS PHASE HAS, and it is the same pair
 * `recordProductSighting` upserts on. It is not the identity the subsystem will end up with —
 * Phase 28 owns deduplication, and a page reachable at two URLs is one product it will have to
 * reconcile — but a lookup written against a rule that does not exist yet is a lookup that answers
 * differently the day it does. What this supports today is a caller that has a URL and wants to
 * know whether anything has been recorded against it: the re-extraction script, and the run detail
 * drawer resolving a fetch back to the row it produced.
 *
 * `maybeSingle` RATHER THAN `single`, because "nothing has been seen at this URL" is an ordinary
 * answer here and not a `NotFoundError` — the caller is asking whether a row exists, not asserting
 * that it does.
 */
export async function getResearchProductBySourceUrl(
  client: Client,
  sourceId: string,
  sourceUrl: string,
): Promise<ResearchProductRow | null> {
  const { data, error } = await client
    .from('research_products')
    .select(PRODUCT_COLUMNS)
    .eq('source_id', sourceId)
    .eq('source_url', sourceUrl)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', sourceUrl, error)
  return (data ?? null) as unknown as ResearchProductRow | null
}

/* --- Phase 28: normalisation, matching and promotion ---------------------------------------- */

/**
 * The wide read `workflows/promote.ts` makes once per row.
 *
 * ONE READ RATHER THAN FOUR, and the column list is a literal for the reason every select in this
 * file is: PostgREST's generated types read the string at COMPILE time, so hoisting it into a
 * constant erases the shape and a column renamed by a migration would typecheck here and fail at
 * runtime.
 */
export async function getProductForPromotion(admin: Client, id: string) {
  const { data, error } = await admin
    .from('research_products')
    .select(
      'id, source_id, source_url, source_external_id, stage, disposition, current_version_id, first_seen_at, title_normalized, currency, price_min_minor, dimensions_mm, matched_category_id, normalized_overrides',
    )
    .eq('id', id)
    .single()
  if (error) throw toRepositoryError(ENTITY, 'promotion', id, error)
  return data
}

/**
 * The duplicate pointer.
 *
 * ITS OWN FUNCTION RATHER THAN A FIELD ON `writeProductDisposition`, because the two move together
 * and are refused separately: `research_products_duplicate_is_another` forbids a self-pointer and
 * `research_products_duplicate_fk` forbids a pointer at nothing. A caller that set a disposition
 * and failed to set a pointer would leave a row hidden from every comparison with nothing on any
 * screen saying what it was hidden behind.
 */
export async function setDuplicateOf(
  client: Client,
  input: {
    readonly id: string
    readonly duplicateOfId: string | null
    readonly actorId: string | null
  },
): Promise<void> {
  const { error } = await client
    .from('research_products')
    .update({
      duplicate_of_id: input.duplicateOfId,
      updated_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) throw toRepositoryError(ENTITY, 'duplicate', input.id, error)
}

/** Rows a duplicate check should consider. Within one source, never across — see `workflows/match.ts`. */
export async function listSiblingsInSource(
  admin: Client,
  input: { readonly sourceId: string; readonly excludeId: string; readonly limit?: number },
) {
  const { data, error } = await admin
    .from('research_products')
    .select(
      'id, source_external_id, title_normalized, currency, price_min_minor, dimensions_mm, first_seen_at',
    )
    .eq('source_id', input.sourceId)
    .neq('id', input.excludeId)
    .neq('disposition', 'DUPLICATE')
    .not('title_normalized', 'is', null)
    .limit(input.limit ?? 1_000)
  if (error) throw toRepositoryError(ENTITY, 'siblings', input.sourceId, error)
  return data ?? []
}

/**
 * Rows in the same source discovered no later than this one, with their addresses.
 *
 * READ RATHER THAN FILTERED IN SQL because the comparison is on a CANONICALISED url — tracking
 * parameters stripped, query sorted — and that canonicalisation lives in TypeScript beside the list
 * of parameters it removes. Pushing it into PostgREST would mean either a database function nobody
 * can read the parameter list of, or an `ilike` that matches the wrong rows.
 */
export async function listUrlPeersInSource(
  admin: Client,
  input: {
    readonly sourceId: string
    readonly excludeId: string
    readonly noLaterThan: string
    readonly limit?: number
  },
) {
  const { data, error } = await admin
    .from('research_products')
    .select('id, source_url, first_seen_at')
    .eq('source_id', input.sourceId)
    .neq('id', input.excludeId)
    .lte('first_seen_at', input.noLaterThan)
    .limit(input.limit ?? 500)
  if (error) throw toRepositoryError(ENTITY, 'peers', input.sourceId, error)
  return data ?? []
}

/** The rows one promotion pass will consider, oldest first so a backlog drains in discovery order. */
export async function listPromotableIds(
  admin: Client,
  input: { readonly sourceId: string; readonly limit?: number },
): Promise<readonly string[]> {
  const { data, error } = await admin
    .from('research_products')
    .select('id')
    .eq('source_id', input.sourceId)
    .in('stage', ['RAW', 'NORMALIZED', 'VALIDATED'])
    .neq('disposition', 'IGNORED')
    .order('first_seen_at', { ascending: true })
    .limit(input.limit ?? 200)
  if (error) throw toRepositoryError(ENTITY, 'promotable', input.sourceId, error)
  return (data ?? []).map((row) => row.id)
}

/** What `scripts/research/renormalize.ts` re-reads: every row that has a stored page to re-read. */
export async function listProductsWithVersionForSource(
  admin: Client,
  input: { readonly sourceId: string; readonly limit: number },
) {
  const { data, error } = await admin
    .from('research_products')
    .select(
      'id, current_version_id, normalized_overrides, title_normalized, price_min_minor, material_tokens, dimension_parse_state',
    )
    .eq('source_id', input.sourceId)
    .not('current_version_id', 'is', null)
    .order('first_seen_at', { ascending: true })
    .limit(input.limit)
  if (error) throw toRepositoryError(ENTITY, 'renormalize', input.sourceId, error)
  return data ?? []
}
