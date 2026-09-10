import type { SupabaseClient } from '@supabase/supabase-js'

import { rawProductDraftSchema, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research product version'

/**
 * Reads and writes for `research_product_versions` — the append-only record of what one page said
 * about one product, once per distinct content hash.
 *
 * NOTHING IN THIS FILE UPDATES A VERSION, AND THE ABSENCE IS THE TABLE'S WHOLE POINT. `0250` says
 * it at length: Phase 29 diffs consecutive rows, and a subsystem that mutated a current row would
 * be comparing against something that had already moved. So there is an insert, and there are
 * reads, and there is deliberately no `updateProductVersion`. The two columns a later phase does
 * write — `normalized` and `normalizer_version` — are Phase 28's, and they belong to a function in
 * Phase 28's own file, where the argument for touching a stored row can be made and reviewed on its
 * own terms rather than inherited from this one.
 *
 * THE UNIQUE-CONTENT CONFLICT IS THE ORDINARY CASE, NOT AN ERROR, and `recordProductVersion` is
 * shaped around that fact. A nightly run over four hundred pages finds most of them unchanged; each
 * of those is a conflict on `research_product_versions_unique_content` and each of them means the
 * pipeline worked. A repository that let `toRepositoryError` turn that into a `ConflictError` would
 * make the healthy path throw four hundred times a night, and the caller would learn to swallow a
 * conflict — at which point the one conflict that IS a bug is swallowed with it.
 *
 * THE DRAFT IS PARSED AT THE WRITE, as `raw-items.ts` parses its own. D1 puts Zod at every trust
 * boundary and a third party's markup is the most hostile one in this system; the value arriving
 * here was assembled from it. `core/run-adapter.ts` already parses what an adapter returned, and
 * this is not that check repeated for its own sake — that boundary guards the CALL, this one guards
 * the COLUMN, and the second is the one that also holds for `scripts/research/reextract.ts` and for
 * anything a later phase writes here.
 */

export type ResearchProductVersionRow =
  Database['public']['Tables']['research_product_versions']['Row']

const VERSION_COLUMNS =
  'id, research_product_id, run_id, fetch_id, raw, normalized, normalizer_version, content_hash, ' +
  'storage_key, adapter_key, adapter_version, observed_at'

/** PostgreSQL's unique-violation SQLSTATE. Named because this file treats one as a normal outcome. */
const UNIQUE_VIOLATION = '23505'

/**
 * Store one observation, and say whether it was a new one.
 *
 * `created: false` IS THE ANSWER ON A GOOD NIGHT. It means this product's page produced a draft
 * identical to one already stored — the same fifteen fields, hashed by `core/content-hash.ts` over
 * the fields the source published and not over the bookkeeping — so there is nothing new to record
 * and the row already there is returned. The caller uses the flag for exactly one decision:
 * `lib/scraper/workflows/extract.ts` advances `research_products.current_version_id` only when a
 * version was CREATED, because re-pointing at a row that has not moved is a write that says
 * something changed when nothing did.
 *
 * THE CONFLICT IS CAUGHT RATHER THAN AVOIDED BY A PRE-READ, and that ordering is deliberate. A
 * "select then insert if absent" would be one round trip longer on every page in the catalogue and
 * would still have to handle the conflict, because two ticks can pass the same read at the same
 * moment. Letting the constraint decide means the RULE — an unchanged page produces no new version
 * — is enforced at the row, which is where `0250` put it precisely so it holds against a bug in
 * this function as well as against this function doing it right.
 *
 * A CONFLICT WITH NOTHING BEHIND IT IS STILL AN ERROR. If the read-back finds no row, something
 * other than the content-hash constraint refused the insert and the original PostgREST error is
 * raised — inventing an id, or returning `created: false` for a row that does not exist, would hand
 * the caller a version id it is about to write onto `research_products`.
 */
export async function recordProductVersion(
  admin: Client,
  input: {
    readonly researchProductId: string
    readonly runId: string | null
    readonly fetchId: string | null
    readonly draft: RawProductDraft
    readonly contentHash: string
    /** The gzipped snapshot this draft was read from. Null for a replay whose snapshot was pruned. */
    readonly storageKey: string | null
    readonly adapterKey: string
    readonly adapterVersion: string
  },
): Promise<{ id: string; created: boolean }> {
  // Throws a ZodError if an adapter, a script or a later phase produced something this column will
  // not hold — a parsed number, an invented field, an unbounded string. See the header.
  const raw = rawProductDraftSchema.parse(input.draft)

  const { data, error } = await admin
    .from('research_product_versions')
    .insert({
      research_product_id: input.researchProductId,
      run_id: input.runId,
      fetch_id: input.fetchId,
      raw: raw as never,
      content_hash: input.contentHash,
      storage_key: input.storageKey,
      adapter_key: input.adapterKey,
      adapter_version: input.adapterVersion,
    })
    .select('id')
    .single()

  if (error === null) return { id: data.id, created: true }

  if (error.code !== UNIQUE_VIOLATION) {
    throw toRepositoryError(ENTITY, 'record', input.contentHash, error)
  }

  const { data: existing, error: readError } = await admin
    .from('research_product_versions')
    .select('id')
    .eq('research_product_id', input.researchProductId)
    .eq('content_hash', input.contentHash)
    .maybeSingle()
  if (readError !== null) throw toRepositoryError(ENTITY, 'read', input.contentHash, readError)
  if (existing === null) throw toRepositoryError(ENTITY, 'record', input.contentHash, error)

  return { id: existing.id, created: false }
}

/**
 * The version `research_products.current_version_id` points at, or null.
 *
 * IT FOLLOWS THE POINTER RATHER THAN RECOMPUTING "THE NEWEST", and the difference matters exactly
 * when the two disagree. `current_version_id` is what `extract.ts` last set; the newest row by
 * `observed_at` is what the table happens to hold. A reader that quietly recomputed would paper
 * over the one state worth seeing — a version written and a pointer that was never advanced,
 * because the process died between the two writes — and would report a product as current at a
 * version nothing ever chose. `listVersionsForProduct(client, id, 1)` is how a caller asks the
 * other question, and it is a different question.
 *
 * TWO ROUND TRIPS RATHER THAN AN EMBEDDED SELECT. PostgREST could resolve the foreign key in one,
 * but the embedding has to be named after the constraint (`research_products_current_version_fk`),
 * which puts a migration's identifier inside a select string that nothing typechecks — the exact
 * failure `sources.ts` records about `owner_verification`, where a column that did not exist sat in
 * a select list for a whole phase. A null pointer costs one read and no second one.
 */
export async function getCurrentVersion(
  client: Client,
  productId: string,
): Promise<ResearchProductVersionRow | null> {
  const { data: product, error: productError } = await client
    .from('research_products')
    .select('current_version_id')
    .eq('id', productId)
    .maybeSingle()
  if (productError !== null) throw toRepositoryError(ENTITY, 'current', productId, productError)

  const versionId = product?.current_version_id ?? null
  if (versionId === null) return null

  const { data, error } = await client
    .from('research_product_versions')
    .select(VERSION_COLUMNS)
    .eq('id', versionId)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', versionId, error)
  return (data ?? null) as unknown as ResearchProductVersionRow | null
}

/**
 * One product's history, newest first — the query Phase 29 makes on every detection pass.
 *
 * `id` IS THE TIEBREAK, AND IT IS ARBITRARY ON PURPOSE. Two versions written in the same
 * millisecond share an `observed_at`, and PostgreSQL is free to return them in either order; a list
 * that reordered itself between two renders of the same screen is one nobody trusts to be complete.
 * A random uuid says nothing about which came first, but it is FIXED, and fixed is the property a
 * list needs. The ordering that carries meaning is `observed_at`, which is why it comes first.
 *
 * The index this reads is `research_product_versions_recent_idx`, declared for exactly this shape.
 */
export async function listVersionsForProduct(
  client: Client,
  productId: string,
  limit = 20,
): Promise<ResearchProductVersionRow[]> {
  const { data, error } = await client
    .from('research_product_versions')
    .select(VERSION_COLUMNS)
    .eq('research_product_id', productId)
    .order('observed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', productId, error)
  return (data ?? []) as unknown as ResearchProductVersionRow[]
}

/**
 * What one run actually read something new from.
 *
 * A SHORT LIST IS THE NORMAL CASE AND THE STUDIO SAYS SO. A version exists only where the content
 * hash differed from the last one, so a nightly run over four hundred unchanged pages produces
 * none — `components/studio/research/VersionList.tsx` carries that sentence in its empty state so
 * an operator does not read a quiet night as a broken pipeline.
 */
export async function listVersionsForRun(
  client: Client,
  runId: string,
  limit = 50,
): Promise<ResearchProductVersionRow[]> {
  const { data, error } = await client
    .from('research_product_versions')
    .select(VERSION_COLUMNS)
    .eq('run_id', runId)
    .order('observed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', runId, error)
  return (data ?? []) as unknown as ResearchProductVersionRow[]
}

/**
 * One version, by id, with the normalised snapshot beside the evidence.
 *
 * THE EXPLORER'S DRAWER READ. `getCurrentVersion` follows the pointer from a product and is a
 * different question with a different failure mode — this is "show me exactly this version",
 * which is what a screen already holding the id is asking.
 */
export async function getProductVersionById(client: Client, id: string) {
  const { data, error } = await client
    .from('research_product_versions')
    .select('id, raw, normalized, normalizer_version, adapter_key, adapter_version, observed_at')
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return data ?? null
}

/**
 * Many versions' evidence at once, for a re-normalisation pass.
 *
 * ONE ROUND TRIP FOR A WHOLE SOURCE rather than one per row. Five hundred sequential reads is five
 * hundred round trips to answer a question that is one `in` list, and the pass is over rows nobody
 * is watching — so the cost lands as a job that takes forty minutes instead of forty seconds and
 * nobody ever profiles it.
 */
export async function listVersionRawByIds(admin: Client, ids: readonly string[]) {
  if (ids.length === 0) return []
  const { data, error } = await admin
    .from('research_product_versions')
    .select('id, raw')
    .in('id', [...ids])
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'batch', error)
  return data ?? []
}
