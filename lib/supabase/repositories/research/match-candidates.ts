import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research match candidate'

export type MatchCandidateRow = Database['public']['Tables']['research_match_candidates']['Row']
export type MatchMethod = 'EXTERNAL_ID' | 'TITLE_PRICE' | 'TRIGRAM_DIMENSION'

const CANDIDATE_COLUMNS =
  'id, research_product_id, candidate_id, method, score, evidence, decided, decided_by, ' +
  'decided_at, created_at'

/**
 * Proposals that two rows are the same product — never verdicts.
 *
 * DECIDING ONE IS A `research.confirm` ACTION AND NOT A `research.write` ONE, and the split is not
 * bureaucratic. Accepting a candidate writes `disposition` and `duplicate_of_id`, which HIDES a row
 * from every later comparison, opportunity score and shortlist; if the two products were genuinely
 * different, one of them is now invisible and nothing on any screen says why. A researcher operates
 * the pipeline; a merchandiser decides what it found. `0261` enforces the same split at the row.
 *
 * THE TABLE HAS NO INSERT POLICY FOR ANY ROLE. Candidates are proposed by `workflows/match.ts`
 * under the service role from evidence it recorded; a hand-written one would be a duplicate claim
 * with no evidence behind it, arriving in a merchandiser's queue looking exactly like a real one.
 */

/**
 * Record proposals, ignoring the ones already on file.
 *
 * `research_match_candidates_unique` ON (product, candidate, method) MEANS A RE-RUN IS A NO-OP, and
 * that is the property this function is built around: the matcher runs on every promotion pass, and
 * a proposal a merchandiser already REJECTED must not come back as PENDING the next night. Ignoring
 * the conflict preserves their decision; an upsert would overwrite it.
 */
export async function proposeCandidates(
  admin: Client,
  candidates: ReadonlyArray<{
    readonly researchProductId: string
    readonly candidateId: string
    readonly method: MatchMethod
    readonly score: number
    readonly evidence: Record<string, unknown>
  }>,
): Promise<number> {
  if (candidates.length === 0) return 0

  const { data, error } = await admin
    .from('research_match_candidates')
    .upsert(
      candidates.map((candidate) => ({
        research_product_id: candidate.researchProductId,
        candidate_id: candidate.candidateId,
        method: candidate.method,
        score: candidate.score,
        evidence: candidate.evidence as never,
      })),
      { onConflict: 'research_product_id,candidate_id,method', ignoreDuplicates: true },
    )
    .select('id')
  if (error !== null) throw toRepositoryError(ENTITY, 'propose', 'batch', error)
  return (data ?? []).length
}

export async function listPendingCandidates(
  client: Client,
  limit = 100,
): Promise<readonly MatchCandidateRow[]> {
  const { data, error } = await client
    .from('research_match_candidates')
    .select(CANDIDATE_COLUMNS)
    .eq('decided', 'PENDING')
    .order('score', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'pending', error)
  return (data ?? []) as unknown as MatchCandidateRow[]
}

export async function listCandidatesForProduct(
  client: Client,
  productId: string,
): Promise<readonly MatchCandidateRow[]> {
  const { data, error } = await client
    .from('research_match_candidates')
    .select(CANDIDATE_COLUMNS)
    .eq('research_product_id', productId)
    .order('score', { ascending: false })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', productId, error)
  return (data ?? []) as unknown as MatchCandidateRow[]
}

/**
 * A merchandiser's answer.
 *
 * THIS FUNCTION DECIDES THE CANDIDATE AND NOTHING ELSE. Accepting one also has to set the losing
 * row's `disposition` and `duplicate_of_id` and write a pipeline event, and those belong to
 * `workflows/match.ts` where the whole act can be read in one place — including the fact that it is
 * REVERSIBLE, which is what makes an accepted duplicate a decision rather than a deletion.
 */
export async function decideCandidate(
  client: Client,
  input: {
    readonly candidateRowId: string
    readonly decided: 'ACCEPTED' | 'REJECTED'
    readonly userId: string
  },
): Promise<MatchCandidateRow> {
  const { data, error } = await client
    .from('research_match_candidates')
    .update({
      decided: input.decided,
      decided_by: input.userId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', input.candidateRowId)
    .select(CANDIDATE_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'decide', input.candidateRowId, error)
  return data as unknown as MatchCandidateRow
}
