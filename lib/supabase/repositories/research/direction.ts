import type { SupabaseClient } from '@supabase/supabase-js'

import type { EvidenceType } from '@/lib/scraper/analytics/direction/capture'
import {
  briefEvidenceRowSchema,
  briefRevisionRowSchema,
  directionBriefRowSchema,
  type BriefBodyInput,
  type BriefEvidenceRow,
  type BriefRevisionRow,
  type BriefStatus,
  type DirectionBriefRow,
} from '@/lib/supabase/schemas/research-direction'

import type { Database, Json } from '../../database.types'
import { parseRow, parseRows, toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research direction brief'

const BRIEF_COLUMNS =
  'id, slug, title, intent, scale_intent, form_language, material_direction, finish_direction, ' +
  'constraints, open_questions, not_doing, target_category_slug, status, owner_verification, ' +
  'fact_classification, approved_at, approved_by, created_at, created_by, updated_at, updated_by'
const EVIDENCE_COLUMNS =
  'id, brief_id, evidence_type, evidence_id, captured, rationale, position, created_at, created_by'
const REVISION_COLUMNS = 'id, brief_id, revision, action, body, note, created_at, created_by'

/**
 * Briefs, their evidence and their revisions — and NOTHING that names `products`.
 *
 * `tests/unit/direction-isolation.test.ts` fails the build if this module and the products
 * repository are ever imported into the same file, and `check-research-isolation.mjs` fails it
 * if a foreign key from any of the three tables reaches a public table. A brief cannot become a
 * product; that is Phase 35's hand-typed act, from the confirmed list, and never from here.
 */

// --- briefs -------------------------------------------------------------------------------------

export async function listDirectionBriefs(client: Client): Promise<DirectionBriefRow[]> {
  const { data, error } = await client
    .from('research_direction_briefs')
    .select(BRIEF_COLUMNS)
    .order('updated_at', { ascending: false })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'briefs', error)
  return parseRows(ENTITY, directionBriefRowSchema, data ?? [])
}

export async function getDirectionBrief(
  client: Client,
  id: string,
): Promise<DirectionBriefRow | null> {
  const { data, error } = await client
    .from('research_direction_briefs')
    .select(BRIEF_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return data === null ? null : parseRow(ENTITY, directionBriefRowSchema, data)
}

/** A new brief is empty except for its title and slug. The sections are never pre-filled. */
export async function createDirectionBrief(
  client: Client,
  input: { readonly slug: string; readonly title: string; readonly actorUserId: string },
): Promise<DirectionBriefRow> {
  const { data, error } = await client
    .from('research_direction_briefs')
    .insert({
      slug: input.slug,
      title: input.title,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select(BRIEF_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'insert', input.slug, error)
  return parseRow(ENTITY, directionBriefRowSchema, data)
}

export async function updateDirectionBriefBody(
  client: Client,
  id: string,
  body: BriefBodyInput,
  actorUserId: string,
): Promise<DirectionBriefRow> {
  const { data, error } = await client
    .from('research_direction_briefs')
    .update({ ...body, updated_by: actorUserId })
    .eq('id', id)
    .select(BRIEF_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'update', id, error)
  return parseRow(ENTITY, directionBriefRowSchema, data)
}

/**
 * Move the lifecycle. APPROVED stamps the approver and the time (the CHECK requires both);
 * leaving APPROVED clears them. The action re-checks `research.direction.approve` before calling
 * this with APPROVED, and the policy checks it again at the row.
 */
export async function setDirectionBriefStatus(
  client: Client,
  id: string,
  status: BriefStatus,
  actorUserId: string,
): Promise<DirectionBriefRow> {
  const approval =
    status === 'APPROVED'
      ? { approved_at: new Date().toISOString(), approved_by: actorUserId }
      : { approved_at: null, approved_by: null }
  const { data, error } = await client
    .from('research_direction_briefs')
    .update({ status, ...approval, updated_by: actorUserId })
    .eq('id', id)
    .select(BRIEF_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'status', id, error)
  return parseRow(ENTITY, directionBriefRowSchema, data)
}

// --- evidence -----------------------------------------------------------------------------------

export async function listBriefEvidence(
  client: Client,
  briefId: string,
): Promise<BriefEvidenceRow[]> {
  const { data, error } = await client
    .from('research_direction_brief_evidence')
    .select(EVIDENCE_COLUMNS)
    .eq('brief_id', briefId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error !== null) throw toRepositoryError(ENTITY, 'list evidence', briefId, error)
  return parseRows(ENTITY, briefEvidenceRowSchema, data ?? [])
}

export async function attachBriefEvidence(
  client: Client,
  input: {
    readonly briefId: string
    readonly evidenceType: EvidenceType
    readonly evidenceId: string
    readonly captured: Record<string, unknown>
    readonly rationale: string
    readonly actorUserId: string
  },
): Promise<BriefEvidenceRow> {
  const { count } = await client
    .from('research_direction_brief_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', input.briefId)
  const { data, error } = await client
    .from('research_direction_brief_evidence')
    .insert({
      brief_id: input.briefId,
      evidence_type: input.evidenceType,
      evidence_id: input.evidenceId,
      captured: input.captured as Json,
      rationale: input.rationale,
      position: count ?? 0,
      created_by: input.actorUserId,
    })
    .select(EVIDENCE_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'attach', input.evidenceId, error)
  return parseRow(ENTITY, briefEvidenceRowSchema, data)
}

export async function detachBriefEvidence(
  client: Client,
  briefId: string,
  evidenceRowId: string,
): Promise<void> {
  const { error } = await client
    .from('research_direction_brief_evidence')
    .delete()
    .eq('brief_id', briefId)
    .eq('id', evidenceRowId)
  if (error !== null) throw toRepositoryError(ENTITY, 'detach', evidenceRowId, error)
}

// --- revisions ----------------------------------------------------------------------------------

export async function listBriefRevisions(
  client: Client,
  briefId: string,
  limit = 50,
): Promise<BriefRevisionRow[]> {
  const capped = Math.min(Math.max(Math.trunc(limit), 1), 200)
  const { data, error } = await client
    .from('research_direction_brief_revisions')
    .select(REVISION_COLUMNS)
    .eq('brief_id', briefId)
    .order('revision', { ascending: false })
    .limit(capped)
  if (error !== null) throw toRepositoryError(ENTITY, 'list revisions', briefId, error)
  return parseRows(ENTITY, briefRevisionRowSchema, data ?? [])
}

/** The SECURITY DEFINER restore, which re-checks `research.direction.write` inside. */
export async function restoreBriefRevision(
  client: Client,
  briefId: string,
  revision: number,
  actorUserId: string,
): Promise<void> {
  const { error } = await client.rpc('research_restore_brief_revision', {
    p_brief_id: briefId,
    p_revision: revision,
    p_actor: actorUserId,
  })
  if (error !== null) throw toRepositoryError(ENTITY, 'restore', briefId, error)
}

/** Direction coverage per category — the figure Phase 37 reports. A checked slug, counted. */
export async function countBriefsByCategory(client: Client): Promise<Record<string, number>> {
  const { data, error } = await client
    .from('research_direction_briefs')
    .select('target_category_slug, status')
    .neq('status', 'ARCHIVED')
  if (error !== null) throw toRepositoryError(ENTITY, 'count', 'categories', error)
  const out: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = row.target_category_slug ?? 'unfiled'
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

// --- reads of the evidence targets, for capture and for drift -----------------------------------
//
// Every one is a SELECT. `media_assets` is read here for concept mood imagery — is_concept = true,
// is_ai_generated = true, from the families the phase document names — and nothing in this module
// writes it (the no-auto-import gate proves that). No join, no key, and no import of the media
// repository: the brief keeps the asset's identity by value.

export const MOOD_FAMILIES = [
  'material-macro',
  'process-cure',
  'process-finish',
  'process-mould',
  'process-pigment',
  'process-pour',
  'process-studio',
  'process-timber',
  'three-d-resin',
  'wall-art',
  'interior-lifestyle',
  'largeformat-coffee',
  'largeformat-console',
  'largeformat-dining',
  'largeformat-monumental',
  'largeformat-seating',
  'largeformat-side',
] as const

export interface ConceptAssetRef {
  readonly id: string
  readonly rivya_asset_id: string | null
  readonly public_id: string
  readonly is_concept: boolean
  readonly is_ai_generated: boolean
  readonly tags: readonly string[]
}

const CONCEPT_COLUMNS = 'id, rivya_asset_id, public_id, is_concept, is_ai_generated, tags'

export function isMoodAsset(asset: ConceptAssetRef): boolean {
  return (
    asset.is_concept &&
    asset.is_ai_generated &&
    asset.tags.some((tag) => (MOOD_FAMILIES as readonly string[]).includes(tag))
  )
}

export async function listMoodAssets(client: Client): Promise<ConceptAssetRef[]> {
  const { data, error } = await client
    .from('media_assets')
    .select(CONCEPT_COLUMNS)
    .eq('is_concept', true)
    .eq('is_ai_generated', true)
    .order('rivya_asset_id', { ascending: true })
  if (error !== null) throw toRepositoryError(ENTITY, 'mood assets', 'list', error)
  return (data ?? []).filter(isMoodAsset)
}

export async function readMoodAsset(client: Client, id: string): Promise<ConceptAssetRef | null> {
  const { data, error } = await client
    .from('media_assets')
    .select(CONCEPT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'mood asset', id, error)
  return data === null || !isMoodAsset(data) ? null : data
}

export interface ComparisonSetRef {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly last_computed_at: string | null
  readonly memberCount: number
}

export async function readComparisonSetRef(
  client: Client,
  id: string,
): Promise<ComparisonSetRef | null> {
  const set = await client
    .from('research_comparison_sets')
    .select('id, name, slug, last_computed_at')
    .eq('id', id)
    .maybeSingle()
  if (set.error !== null) throw toRepositoryError(ENTITY, 'set', id, set.error)
  if (set.data === null) return null
  const members = await client
    .from('research_comparison_members')
    .select('id', { count: 'exact', head: true })
    .eq('set_id', id)
  if (members.error !== null) throw toRepositoryError(ENTITY, 'set members', id, members.error)
  return { ...set.data, memberCount: members.count ?? 0 }
}

export async function listComparisonSetRefs(client: Client): Promise<ComparisonSetRef[]> {
  const { data, error } = await client
    .from('research_comparison_sets')
    .select('id, name, slug, last_computed_at')
    .order('name', { ascending: true })
  if (error !== null) throw toRepositoryError(ENTITY, 'sets', 'list', error)
  return (data ?? []).map((row) => ({ ...row, memberCount: 0 }))
}

export interface SnapshotRef {
  readonly id: string
  readonly scope_type: string
  readonly scope_id: string | null
  readonly metric_family: 'ASSORTMENT' | 'PRICE_ARCHITECTURE' | 'DIMENSIONS'
  readonly currency: string | null
  readonly row_count: number
  readonly computed_at: string
  readonly payload: unknown
}

const SNAPSHOT_REF_COLUMNS =
  'id, scope_type, scope_id, metric_family, currency, row_count, computed_at, payload'

export async function readSnapshotRef(client: Client, id: string): Promise<SnapshotRef | null> {
  const { data, error } = await client
    .from('research_analytics_snapshots')
    .select(SNAPSHOT_REF_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'snapshot', id, error)
  return (data as SnapshotRef | null) ?? null
}

/** The newest snapshot of the same scope, family and currency — what drift compares against. */
export async function newestSnapshotLike(
  client: Client,
  like: Pick<SnapshotRef, 'scope_type' | 'scope_id' | 'metric_family' | 'currency'>,
): Promise<SnapshotRef | null> {
  let query = client
    .from('research_analytics_snapshots')
    .select(SNAPSHOT_REF_COLUMNS)
    .eq('scope_type', like.scope_type)
    .eq('metric_family', like.metric_family)
    .order('computed_at', { ascending: false })
    .limit(1)
  query = like.scope_id === null ? query.is('scope_id', null) : query.eq('scope_id', like.scope_id)
  query = like.currency === null ? query.is('currency', null) : query.eq('currency', like.currency)
  const { data, error } = await query.maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'newest snapshot', like.metric_family, error)
  return (data as SnapshotRef | null) ?? null
}

export async function listRecentSnapshotRefs(client: Client, limit = 30): Promise<SnapshotRef[]> {
  const { data, error } = await client
    .from('research_analytics_snapshots')
    .select(SNAPSHOT_REF_COLUMNS)
    .order('computed_at', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'snapshots', 'list', error)
  return (data ?? []) as SnapshotRef[]
}

export interface ScoreRef {
  readonly id: string
  readonly research_product_id: string
  readonly model_version: string
  readonly score: number | null
  readonly confidence: number
  readonly completeness: number
  readonly state: 'SCORED' | 'INSUFFICIENT_DATA'
  readonly computed_at: string
}

const SCORE_REF_COLUMNS =
  'id, research_product_id, model_version, score, confidence, completeness, state, computed_at'

export async function readScoreRef(client: Client, id: string): Promise<ScoreRef | null> {
  const { data, error } = await client
    .from('research_opportunity_scores')
    .select(SCORE_REF_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'score', id, error)
  return (data as ScoreRef | null) ?? null
}

/** The newest score for the same research product, whatever model produced it — drift's "current". */
export async function newestScoreForProduct(
  client: Client,
  researchProductId: string,
): Promise<ScoreRef | null> {
  const { data, error } = await client
    .from('research_opportunity_scores')
    .select(SCORE_REF_COLUMNS)
    .eq('research_product_id', researchProductId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'newest score', researchProductId, error)
  return (data as ScoreRef | null) ?? null
}

export async function listRecentScoreRefs(
  client: Client,
  limit = 50,
): Promise<(ScoreRef & { readonly title: string | null })[]> {
  const { data, error } = await client
    .from('research_opportunity_scores')
    .select(`${SCORE_REF_COLUMNS}, research_products ( title_normalized )`)
    .eq('state', 'SCORED')
    .order('computed_at', { ascending: false })
    .order('score', { ascending: false })
    .limit(limit)
  if (error !== null) throw toRepositoryError(ENTITY, 'scores', 'list', error)
  return (data ?? []).map((row) => {
    const { research_products, ...rest } = row as ScoreRef & {
      research_products: { title_normalized: string | null } | null
    }
    return { ...rest, title: research_products?.title_normalized ?? null }
  })
}

export interface ResearchProductRef {
  readonly id: string
  readonly title_normalized: string | null
  readonly stage: string
  readonly price_state: string | null
  readonly scale_band: string | null
  readonly source_slug: string
}

export async function readResearchProductRef(
  client: Client,
  id: string,
): Promise<ResearchProductRef | null> {
  const { data, error } = await client
    .from('research_products')
    .select('id, title_normalized, stage, price_state, scale_band, research_sources ( slug )')
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'product', id, error)
  if (data === null) return null
  const { research_sources, ...rest } = data as Omit<ResearchProductRef, 'source_slug'> & {
    research_sources: { slug: string } | null
  }
  return { ...rest, source_slug: research_sources?.slug ?? 'unknown' }
}

export interface NoteRef {
  readonly id: string
  readonly research_product_id: string
  readonly body: string
  readonly created_at: string
}

export async function readNoteRef(client: Client, id: string): Promise<NoteRef | null> {
  const { data, error } = await client
    .from('research_notes')
    .select('id, research_product_id, body, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'note', id, error)
  return (data as NoteRef | null) ?? null
}

export interface PairRef {
  readonly id: string
  readonly band: string
  readonly distance: number | null
  readonly method: string
}

export async function readPairRef(client: Client, id: string): Promise<PairRef | null> {
  const { data, error } = await client
    .from('research_similarity_pairs')
    .select('id, band, distance, method')
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'pair', id, error)
  return (data as PairRef | null) ?? null
}
