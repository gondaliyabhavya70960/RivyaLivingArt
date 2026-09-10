import type { SupabaseClient } from '@supabase/supabase-js'

import { rawProductDraftSchema, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research raw item'

export type ResearchRawItemRow = Database['public']['Tables']['research_raw_items']['Row']

/**
 * Store what a page said.
 *
 * THE SCHEMA IS PARSED HERE, AT THE WRITE, and not only at the reader that produced the value. A
 * commitment device that is enforced at one call site is one a second call site walks past;
 * parsing at the repository boundary means every path into this table goes through it.
 *
 * WHAT THAT SCHEMA IS HAS CHANGED IN PHASE 27, AND THE OLD ONE DID ITS JOB. Until now this parsed
 * with `rawItemSchema` from `lib/scraper/core/raw.ts`, whose `.strict()` shape accepted
 * `{ title, canonicalUrl, links }` and NOTHING RICHER — deliberately, as a commitment device
 * against the ordinary failure that file describes: somebody adds "just a quick price regex" in
 * Phase 25 because the page is right there and the value is easy, and by the time the adapter
 * architecture arrives there is a half-working parser in production that something depends on and
 * nobody wants to be the one to delete. That never happened. The commitment was kept, the shortcut
 * was refused at this write for two phases, and the richer payload it was holding the door for has
 * now been built with the architecture around it: `RawProductDraft`, fifteen fields that are every
 * one of them the source's own string, produced by a registered adapter through the isolation
 * boundary in `core/run-adapter.ts` and validated by `adapters/draft-schema.ts`.
 *
 * SO THE GUARANTEE IS UNCHANGED AND ONLY THE SHAPE MOVED. The new schema refuses a parsed number
 * exactly as loudly — `priceText` is `z.string().nullable()`, so a draft carrying `1299` is
 * rejected outright — and it is `.strict()` for the same reason: without it a page contributes keys
 * nobody designed for into a jsonb column that later phases read. `core/raw.ts` keeps its schema
 * and its reader, which are still what `readRawItem` produces for link discovery; what it no longer
 * is, is the shape of this column.
 *
 * `content_hash` IS NOW THE DRAFT'S HASH, NOT THE PAGE BODY'S, and the column follows its
 * neighbour. `raw` holds the draft, so the hash beside it is over the draft — the same value
 * `research_product_versions.content_hash` carries for the version this item produced, which is
 * what lets the two rows be read against each other. The body hash has not been lost: it is on the
 * `research_fetches` row this item points at through `fetch_id`, where the snapshot key is derived
 * from it and where `research_fetches_by_hash_idx` indexes it.
 */
export async function recordRawItem(
  admin: Client,
  input: {
    readonly runId: string | null
    readonly sourceId: string
    readonly fetchId: string | null
    readonly sourceUrl: string
    readonly sourceExternalId: string | null
    readonly raw: RawProductDraft
    readonly contentHash: string | null
    readonly adapterKey: string
    readonly adapterVersion: string | null
  },
): Promise<string> {
  // Throws a ZodError if something reaches this table that the draft schema will not hold — a
  // parsed number, an invented field, an unbounded string off somebody else's page. That is the
  // point, and it is the same point it was under the old schema.
  const raw = rawProductDraftSchema.parse(input.raw)

  const { data, error } = await admin
    .from('research_raw_items')
    .insert({
      run_id: input.runId,
      source_id: input.sourceId,
      fetch_id: input.fetchId,
      source_url: input.sourceUrl,
      source_external_id: input.sourceExternalId,
      raw: raw as never,
      content_hash: input.contentHash,
      adapter_key: input.adapterKey,
      adapter_version: input.adapterVersion,
    })
    .select('id')
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'record', input.sourceUrl, error)
  return data.id
}

export async function listRawItemsForRun(
  client: Client,
  runId: string,
  limit = 100,
): Promise<ResearchRawItemRow[]> {
  const { data, error } = await client
    .from('research_raw_items')
    .select('*')
    .eq('run_id', runId)
    .order('extracted_at', { ascending: false })
    .limit(limit)
  if (error) throw toRepositoryError(ENTITY, 'list', runId, error)
  return (data ?? []) as unknown as ResearchRawItemRow[]
}
