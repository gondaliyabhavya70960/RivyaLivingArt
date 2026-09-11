import type { SupabaseClient } from '@supabase/supabase-js'

import {
  researchImageHashRowSchema,
  similarityPairRowSchema,
  similarityRunRowSchema,
  similaritySuppressionRowSchema,
  type NewSimilarityRun,
  type ResearchImageHashRow,
  type RunCounts,
  type SimilarityPairRow,
  type SimilarityRunRow,
  type SimilaritySuppressionRow,
} from '@/lib/supabase/schemas/similarity'

import type { Database } from '../../database.types'
import { parseRow, parseRows, toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research similarity'

const HASH_COLUMNS =
  'id, research_product_id, source_id, source_image_url, source_image_key, position, checksum, ' +
  'phash, dhash, fetch_id, computed_at'
const RUN_COLUMNS =
  'id, scope_type, scope_id, method, model_name, status, images_fetched, images_hashed, ' +
  'sources_skipped, pairs_considered, pairs_stored, pairs_exact, started_at, finished_at, ' +
  'error_code, created_by'
const PAIR_COLUMNS =
  'id, run_id, left_hash_id, right_hash_id, method, distance, cosine, band, created_at'
const SUPPRESSION_COLUMNS = 'id, left_hash_id, right_hash_id, reason, created_at, created_by'

/**
 * The research side of Phase 33: hashes (read only — under amendment A33 nothing writes them),
 * runs, pairs and suppressions.
 *
 * NOTHING HERE NAMES `media_assets` OR `media_asset_hashes`. The cross-corpus comparison the
 * upload guard performs is two reads and a TypeScript loop; this repository is one of the reads
 * and `lib/supabase/repositories/media-hashes.ts` is the other, and neither imports the other.
 */

// --- hashes: read only --------------------------------------------------------------------------

export async function listResearchImageHashes(client: Client): Promise<ResearchImageHashRow[]> {
  const { data, error } = await client
    .from('research_image_hashes')
    .select(HASH_COLUMNS)
    .order('computed_at', { ascending: true })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'hashes', error)
  return parseRows(ENTITY, researchImageHashRowSchema, data ?? [])
}

/** Source slugs by id, so a refusal can name the source a matched hash came from. */
export async function sourceSlugsById(client: Client): Promise<Map<string, string>> {
  const { data, error } = await client.from('research_sources').select('id, slug')
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'sources', error)
  return new Map((data ?? []).map((row) => [row.id, row.slug]))
}

// --- runs ---------------------------------------------------------------------------------------

export async function openSimilarityRun(
  client: Client,
  run: NewSimilarityRun,
): Promise<SimilarityRunRow> {
  const { data, error } = await client
    .from('research_similarity_runs')
    .insert({ ...run, status: 'RUNNING' })
    .select(RUN_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'insert', 'run', error)
  return parseRow(ENTITY, similarityRunRowSchema, data)
}

export async function closeSimilarityRun(
  client: Client,
  id: string,
  outcome:
    | { readonly status: 'SUCCEEDED'; readonly counts: RunCounts }
    | { readonly status: 'FAILED'; readonly errorCode: string; readonly counts?: RunCounts },
): Promise<SimilarityRunRow> {
  const patch =
    outcome.status === 'SUCCEEDED'
      ? { status: 'SUCCEEDED', finished_at: new Date().toISOString(), ...outcome.counts }
      : {
          status: 'FAILED',
          finished_at: new Date().toISOString(),
          error_code: outcome.errorCode,
          ...(outcome.counts ?? {}),
        }
  const { data, error } = await client
    .from('research_similarity_runs')
    .update(patch)
    .eq('id', id)
    .select(RUN_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'update', id, error)
  return parseRow(ENTITY, similarityRunRowSchema, data)
}

export async function listSimilarityRuns(client: Client, limit = 50): Promise<SimilarityRunRow[]> {
  const { data, error } = await client
    .from('research_similarity_runs')
    .select(RUN_COLUMNS)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'runs', error)
  return parseRows(ENTITY, similarityRunRowSchema, data ?? [])
}

// --- pairs and suppressions ---------------------------------------------------------------------

export async function listSimilarityPairs(
  client: Client,
  runId: string,
): Promise<SimilarityPairRow[]> {
  const { data, error } = await client
    .from('research_similarity_pairs')
    .select(PAIR_COLUMNS)
    .eq('run_id', runId)
    .order('distance', { ascending: true, nullsFirst: false })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', runId, error)
  return parseRows(ENTITY, similarityPairRowSchema, data ?? [])
}

export async function listSuppressions(client: Client): Promise<SimilaritySuppressionRow[]> {
  const { data, error } = await client
    .from('research_similarity_suppressions')
    .select(SUPPRESSION_COLUMNS)
    .order('created_at', { ascending: false })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'suppressions', error)
  return parseRows(ENTITY, similaritySuppressionRowSchema, data ?? [])
}

export async function insertSuppression(
  client: Client,
  input: {
    readonly leftHashId: string
    readonly rightHashId: string
    readonly reason: string
    readonly createdBy: string
  },
): Promise<SimilaritySuppressionRow> {
  const [left, right] =
    input.leftHashId < input.rightHashId
      ? [input.leftHashId, input.rightHashId]
      : [input.rightHashId, input.leftHashId]
  const { data, error } = await client
    .from('research_similarity_suppressions')
    .insert({
      left_hash_id: left,
      right_hash_id: right,
      reason: input.reason,
      created_by: input.createdBy,
    })
    .select(SUPPRESSION_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'insert', `${left} ${right}`, error)
  return parseRow(ENTITY, similaritySuppressionRowSchema, data)
}
