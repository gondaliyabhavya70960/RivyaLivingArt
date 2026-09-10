import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { searchDocumentSchema, type SearchDocument, type SearchEntityType } from '../schemas'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'search document'

/**
 * `search_documents`, `research_search_documents` and `search_queries` — the only module that
 * touches any of the three.
 *
 * NOTHING HERE READS `research_search_documents`, AND THAT IS THE POINT OF SAYING SO. The table is
 * named in this comment and nowhere else in this file: it is created empty by Phase 23 and read
 * from Phases 25, 26 and 28 through `lib/supabase/repositories/research/**`, which does not exist
 * yet. A function here that read it would put a research identifier on the import graph of every
 * page that searches, which is exactly what `check-search-scope.mjs` fails on.
 *
 * THE TWO QUERY PATHS ARE RPC CALLS, NOT `.from()` BUILDERS. `websearch_to_tsquery`, `ts_rank_cd`
 * and `similarity` are not PostgREST filter operators, so ranking in a builder would mean fetching
 * candidate rows and sorting them in Node. The functions are `security invoker` (0210), so RLS
 * decides what comes back exactly as it would for a direct read — `scope` narrows, it never widens.
 *
 * `search_vector` IS NEVER RETURNED. The two RPCs name their output columns and the tsvector is not
 * among them; the one `.from('search_documents')` read below asks for a single column. It is the
 * largest thing in the row, no caller has a use for it, and returning it would move a lexeme dump
 * across the wire on every search.
 */

export type MatchMode = 'EXACT' | 'SIMILAR'

export interface SearchHit extends SearchDocument {
  /** `ts_rank_cd` for an exact match, `similarity` for a fallback one. Not comparable across modes. */
  readonly rank: number
  readonly matchMode: MatchMode
}

export interface SearchOptions {
  readonly scope?: 'PUBLIC' | 'STAFF'
  readonly types?: readonly SearchEntityType[]
  readonly category?: string | null
  readonly limit?: number
  readonly offset?: number
  /**
   * Match the last word as a PREFIX. For the type-ahead only.
   *
   * A tsquery matches whole lexemes, so `re` does not match `resin` — right for a results page and
   * useless for a suggestion list, where matching what somebody has typed so far is the feature.
   * The results page leaves this off and relies on the trigram fallback for a partial word, which
   * is the behaviour the phase document specifies.
   */
  readonly prefix?: boolean
}

/**
 * Run one search.
 *
 * A ROW THAT FAILS TO PARSE FAILS THE WHOLE READ, which is the house rule and worth keeping here:
 * the index is machine-written, so a row whose `entity_type` is not one of the eight means the
 * allowlist constraint has been dropped, and returning the other rows would hide that.
 */
export async function searchDocuments(
  client: Client,
  query: string,
  options: SearchOptions = {},
): Promise<SearchHit[]> {
  const { data, error } = await client.rpc('search_documents_query', {
    p_query: query,
    p_scope: options.scope ?? 'PUBLIC',
    p_types: options.types === undefined ? undefined : [...options.types],
    p_category: options.category ?? undefined,
    p_limit: options.limit ?? 10,
    p_offset: options.offset ?? 0,
    p_prefix: options.prefix ?? false,
  })

  if (error) throw toRepositoryError(ENTITY, 'search', query, error)

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const documents = parseRows(
    ENTITY,
    searchDocumentSchema,
    rows.map((row) => {
      // `rank` and `match_mode` are the function's, not the table's, so they are lifted off before
      // the row is parsed against the table schema rather than loosening that schema to admit them.
      const { rank: _rank, match_mode: _mode, ...document } = row
      return document
    }),
  )

  return documents.map((document, index) => ({
    ...document,
    rank: Number(rows[index]?.['rank'] ?? 0),
    matchMode: rows[index]?.['match_mode'] === 'SIMILAR' ? 'SIMILAR' : 'EXACT',
  }))
}

/** How many rows the exact pass matches. See the function's own comment on why the fallback is not counted. */
export async function countSearchDocuments(
  client: Client,
  query: string,
  options: Pick<SearchOptions, 'scope' | 'types' | 'category'> = {},
): Promise<number> {
  const { data, error } = await client.rpc('search_documents_count', {
    p_query: query,
    p_scope: options.scope ?? 'PUBLIC',
    p_types: options.types === undefined ? undefined : [...options.types],
    p_category: options.category ?? undefined,
  })

  if (error) throw toRepositoryError(ENTITY, 'count', query, error)
  return typeof data === 'number' ? data : 0
}

/**
 * Record that a search happened.
 *
 * REQUIRES AN ADMIN CLIENT AND SAYS SO IN ITS NAME. `search_queries` has no write policy for any
 * session role (0212): a public search has no session at all, and an anon insert policy would be a
 * public endpoint a stranger could fill with arbitrary text attributed to searches nobody ran.
 *
 * IT NEVER THROWS. A failure to log a search must not fail the search — the visitor came here to
 * find a table, not to feed an analytics row — so the error is swallowed and the caller continues.
 * This is the one place in the repositories where that is right, and it is right because the write
 * is a side effect of a read that has already succeeded.
 */
export async function logSearchQuery(
  admin: Client,
  entry: {
    readonly queryText: string
    readonly normalizedQuery: string
    readonly scope: 'PUBLIC' | 'STUDIO'
    readonly resultCount: number
    readonly staffUserId?: string | null
  },
): Promise<void> {
  await admin.from('search_queries').insert({
    query_text: entry.queryText,
    normalized_query: entry.normalizedQuery,
    scope: entry.scope,
    result_count: entry.resultCount,
    // A public search has no actor, and the CHECK on the table refuses one. Passing the value
    // through unconditionally would turn a mis-wired caller into a constraint violation here
    // rather than a silent privacy leak, which is the trade this line is making.
    staff_user_id: entry.scope === 'STUDIO' ? (entry.staffUserId ?? null) : null,
  })
}

/** The zero-result list, most recent first. `/studio/operations/data-quality` reads this. */
export async function listZeroResultQueries(
  client: Client,
  limit = 50,
): Promise<Array<{ normalizedQuery: string; occurrences: number; lastSeen: string }>> {
  const { data, error } = await client
    .from('search_queries')
    .select('normalized_query, occurred_at')
    .eq('result_count', 0)
    .order('occurred_at', { ascending: false })
    .limit(1000)

  if (error) throw toRepositoryError(ENTITY, 'list-zero-result', 'all', error)

  const seen = new Map<string, { occurrences: number; lastSeen: string }>()
  for (const row of data ?? []) {
    const key = row.normalized_query
    const existing = seen.get(key)
    if (existing) existing.occurrences += 1
    else seen.set(key, { occurrences: 1, lastSeen: row.occurred_at })
  }

  return [...seen.entries()]
    .map(([normalizedQuery, value]) => ({ normalizedQuery, ...value }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limit)
}

/** Rebuild one document. The reindex script's unit of work; also the repair path for a single row. */
export async function refreshSearchDocument(
  admin: Client,
  entityType: SearchEntityType,
  entityId: string,
): Promise<void> {
  const { error } = await admin.rpc('refresh_search_document', {
    p_entity_type: entityType,
    p_entity_id: entityId,
  })
  if (error) throw toRepositoryError(ENTITY, 'refresh', `${entityType}:${entityId}`, error)
}

/** Per-type counts, for the reindex script's report and the drift check. */
export async function countByEntityType(client: Client): Promise<Record<string, number>> {
  const { data, error } = await client.from('search_documents').select('entity_type')
  if (error) throw toRepositoryError(ENTITY, 'count-by-type', 'all', error)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.entity_type] = (counts[row.entity_type] ?? 0) + 1
  return counts
}

/**
 * Delete `search_queries` rows past the retention window.
 *
 * NINETY DAYS, SWEPT BY THE CRON, and the reason is a privacy one rather than a storage one: this
 * table holds what visitors typed into a search box, and a table of search terms that grows
 * forever is a liability accumulating quietly. `scripts/search/prune-queries.ts` is the same sweep
 * as a manual command with a dry run; this is the path the Phase 25 tick calls, which is what
 * makes the retention automatic rather than something somebody has to remember.
 *
 * SERVICE ROLE, NECESSARILY. `search_queries` has no delete policy for any session role — the
 * record of what was searched is not editable by the people it describes or by the staff reading
 * it. The admin client bypasses RLS, which is why this function takes one and says so.
 */
export async function pruneSearchQueries(admin: Client, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('search_queries')
    .delete()
    .lt('occurred_at', cutoff)
    .select('id')
  if (error) throw toRepositoryError(ENTITY, 'prune', 'expired', error)
  return (data ?? []).length
}
