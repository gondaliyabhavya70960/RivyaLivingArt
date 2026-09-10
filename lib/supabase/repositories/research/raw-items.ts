import type { SupabaseClient } from '@supabase/supabase-js'

import { rawItemSchema, type RawItem } from '@/lib/scraper/core/raw'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research raw item'

export type ResearchRawItemRow = Database['public']['Tables']['research_raw_items']['Row']

/**
 * Store what a page said.
 *
 * THE SCHEMA IS PARSED HERE, AT THE WRITE, and not only at the reader that produced the value.
 * `lib/scraper/core/raw.ts` explains why the shape is deliberately tiny — it is a commitment
 * device against a "temporary" parser landing before Phase 27's adapter architecture — and a
 * commitment device that is only enforced at one call site is one a second call site walks past.
 * Parsing at the repository boundary means every path into this table goes through it.
 */
export async function recordRawItem(
  admin: Client,
  input: {
    readonly runId: string | null
    readonly sourceId: string
    readonly fetchId: string | null
    readonly sourceUrl: string
    readonly sourceExternalId: string | null
    readonly raw: RawItem
    readonly contentHash: string | null
    readonly adapterKey: string
    readonly adapterVersion: string | null
  },
): Promise<string> {
  // Throws a ZodError if a later phase's richer payload arrives here early. That is the point.
  const raw = rawItemSchema.parse(input.raw)

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
