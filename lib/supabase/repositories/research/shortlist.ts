import type { SupabaseClient } from '@supabase/supabase-js'

import {
  confirmationForBridgeSchema,
  confirmationRowSchema,
  shortlistEntryRowSchema,
  type ConfirmationForBridge,
  type ConfirmationRow,
  type ShortlistCapture,
  type ShortlistEntryRow,
} from '@/lib/supabase/schemas/research-shortlist'

import type { Database, Json } from '../../database.types'
import { parseRow, toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research shortlist'

const ENTRY_COLUMNS =
  'id, research_product_id, reason, captured, brief_id, opened_at, opened_by, closed_at, ' +
  'closed_reason, closed_by'
const CONFIRMATION_COLUMNS =
  'id, research_product_id, decision_note, brief_id, confirmed_at, confirmed_by, ' +
  'created_product_id, product_started_at, product_started_by, archived_at, archived_reason'

/**
 * The two Phase 35 decision records. Entries and confirmations are written as the PERSON (the
 * tables' policies require `research.confirm`), so a researcher's session is refused at the row
 * as well as in the action.
 *
 * `getConfirmationForBridge` IS THE ONLY READER THE BRIDGE MAY IMPORT, and it returns three
 * fields — id, stage, archived_at — none of them competitor text. `check-research-isolation.mjs`
 * fails the build if the bridge's file imports any other research reader.
 *
 * `created_product_id` is resolved by `resolveStartedProducts`, here and nowhere else: an opaque
 * id, a second query, a link and never a join.
 */

// --- shortlist entries --------------------------------------------------------------------------

export interface ShortlistRow extends ShortlistEntryRow {
  readonly title_normalized: string | null
  readonly source_id: string
  readonly stage: string
  readonly disposition: string
  readonly scale_band: string | null
}

const ENTRY_WITH_PRODUCT = `${ENTRY_COLUMNS}, research_products ( title_normalized, source_id, stage, disposition, scale_band )`

export async function listOpenShortlistEntries(client: Client): Promise<ShortlistRow[]> {
  const { data, error } = await client
    .from('research_shortlist_entries')
    .select(ENTRY_WITH_PRODUCT)
    .is('closed_at', null)
    .order('opened_at', { ascending: true })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'entries', error)
  return (data ?? []).map((row) => {
    const { research_products, ...entry } = row as ShortlistEntryRow & {
      research_products: {
        title_normalized: string | null
        source_id: string
        stage: string
        disposition: string
        scale_band: string | null
      } | null
    }
    return {
      ...parseRow(ENTITY, shortlistEntryRowSchema, entry),
      title_normalized: research_products?.title_normalized ?? null,
      source_id: research_products?.source_id ?? '',
      stage: research_products?.stage ?? '',
      disposition: research_products?.disposition ?? '',
      scale_band: research_products?.scale_band ?? null,
    }
  })
}

export async function getOpenEntry(
  client: Client,
  researchProductId: string,
): Promise<ShortlistEntryRow | null> {
  const { data, error } = await client
    .from('research_shortlist_entries')
    .select(ENTRY_COLUMNS)
    .eq('research_product_id', researchProductId)
    .is('closed_at', null)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get entry', researchProductId, error)
  return data === null ? null : parseRow(ENTITY, shortlistEntryRowSchema, data)
}

export async function openShortlistEntry(
  client: Client,
  input: {
    readonly researchProductId: string
    readonly reason: string
    readonly captured: ShortlistCapture
    readonly briefId: string | null
    readonly actorUserId: string
  },
): Promise<ShortlistEntryRow> {
  const { data, error } = await client
    .from('research_shortlist_entries')
    .insert({
      research_product_id: input.researchProductId,
      reason: input.reason,
      captured: input.captured as unknown as Json,
      brief_id: input.briefId,
      opened_by: input.actorUserId,
    })
    .select(ENTRY_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'open', input.researchProductId, error)
  return parseRow(ENTITY, shortlistEntryRowSchema, data)
}

/** Close the open entry for a row, if one exists. Returns whether one was closed. */
export async function closeShortlistEntry(
  client: Client,
  input: {
    readonly researchProductId: string
    readonly reason: string
    readonly actorUserId: string
  },
): Promise<boolean> {
  const { data, error } = await client
    .from('research_shortlist_entries')
    .update({
      closed_at: new Date().toISOString(),
      closed_reason: input.reason,
      closed_by: input.actorUserId,
    })
    .eq('research_product_id', input.researchProductId)
    .is('closed_at', null)
    .select('id')
  if (error !== null) throw toRepositoryError(ENTITY, 'close', input.researchProductId, error)
  return (data ?? []).length > 0
}

/** Entries open longer than `days` — the dashboard's "graveyard" count. */
export async function countStaleEntries(client: Client, days = 60): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const { count, error } = await client
    .from('research_shortlist_entries')
    .select('id', { count: 'exact', head: true })
    .is('closed_at', null)
    .lt('opened_at', cutoff)
  if (error !== null) throw toRepositoryError(ENTITY, 'count stale', String(days), error)
  return count ?? 0
}

// --- confirmations ------------------------------------------------------------------------------

export interface ConfirmedRow extends ConfirmationRow {
  readonly title_normalized: string | null
  readonly source_id: string
  readonly stage: string
  readonly disposition: string
}

const CONFIRMATION_WITH_PRODUCT = `${CONFIRMATION_COLUMNS}, research_products ( title_normalized, source_id, stage, disposition )`

export async function listConfirmations(
  client: Client,
  filter: { readonly includeArchived: boolean },
): Promise<ConfirmedRow[]> {
  let query = client
    .from('research_confirmations')
    .select(CONFIRMATION_WITH_PRODUCT)
    .order('confirmed_at', { ascending: false })
  if (!filter.includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query
  if (error !== null) throw toRepositoryError(ENTITY, 'list', 'confirmations', error)
  return (data ?? []).map((row) => {
    const { research_products, ...confirmation } = row as ConfirmationRow & {
      research_products: {
        title_normalized: string | null
        source_id: string
        stage: string
        disposition: string
      } | null
    }
    return {
      ...parseRow(ENTITY, confirmationRowSchema, confirmation),
      title_normalized: research_products?.title_normalized ?? null,
      source_id: research_products?.source_id ?? '',
      stage: research_products?.stage ?? '',
      disposition: research_products?.disposition ?? '',
    }
  })
}

export async function getLiveConfirmation(
  client: Client,
  researchProductId: string,
): Promise<ConfirmationRow | null> {
  const { data, error } = await client
    .from('research_confirmations')
    .select(CONFIRMATION_COLUMNS)
    .eq('research_product_id', researchProductId)
    .is('archived_at', null)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get confirmation', researchProductId, error)
  return data === null ? null : parseRow(ENTITY, confirmationRowSchema, data)
}

export async function recordConfirmation(
  client: Client,
  input: {
    readonly researchProductId: string
    readonly decisionNote: string
    readonly briefId: string | null
    readonly actorUserId: string
  },
): Promise<ConfirmationRow> {
  const { data, error } = await client
    .from('research_confirmations')
    .insert({
      research_product_id: input.researchProductId,
      decision_note: input.decisionNote,
      brief_id: input.briefId,
      confirmed_by: input.actorUserId,
    })
    .select(CONFIRMATION_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'confirm', input.researchProductId, error)
  return parseRow(ENTITY, confirmationRowSchema, data)
}

/** Retire a decision. The stage is untouched — a column, not a stage. Returns whether one was archived. */
export async function archiveConfirmation(
  client: Client,
  input: { readonly researchProductId: string; readonly reason: string },
): Promise<boolean> {
  const { data, error } = await client
    .from('research_confirmations')
    .update({ archived_at: new Date().toISOString(), archived_reason: input.reason })
    .eq('research_product_id', input.researchProductId)
    .is('archived_at', null)
    .select('id')
  if (error !== null) throw toRepositoryError(ENTITY, 'archive', input.researchProductId, error)
  return (data ?? []).length > 0
}

// --- the bridge's projection, and the resolution of what it wrote ------------------------------

/** id, stage, archived_at — and nothing else. The bridge may import this and only this. */
export async function getConfirmationForBridge(
  client: Client,
  confirmationId: string,
): Promise<ConfirmationForBridge | null> {
  const { data, error } = await client
    .from('research_confirmations')
    .select('id, archived_at, research_products ( stage )')
    .eq('id', confirmationId)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'bridge', confirmationId, error)
  if (data === null) return null
  const row = data as {
    id: string
    archived_at: string | null
    research_products: { stage: string } | null
  }
  return parseRow(ENTITY, confirmationForBridgeSchema, {
    id: row.id,
    stage: row.research_products?.stage ?? '',
    archived_at: row.archived_at,
  })
}

/**
 * Claim the bridge for one decision. Writes only where nothing was started before — the partial
 * condition is what makes a double click, or two people on the same row, start ONE product rather
 * than two. Returns false when the claim was already taken.
 */
export async function markProductStarted(
  admin: Client,
  input: {
    readonly confirmationId: string
    readonly productId: string
    readonly actorUserId: string
  },
): Promise<boolean> {
  const { data, error } = await admin
    .from('research_confirmations')
    .update({
      created_product_id: input.productId,
      product_started_at: new Date().toISOString(),
      product_started_by: input.actorUserId,
    })
    .eq('id', input.confirmationId)
    .is('created_product_id', null)
    .select('id')
  if (error !== null) throw toRepositoryError(ENTITY, 'mark started', input.confirmationId, error)
  return (data ?? []).length > 0
}

/** Give a claim back when the product insert that followed it failed. */
export async function releaseProductStart(
  admin: Client,
  input: { readonly confirmationId: string; readonly productId: string },
): Promise<void> {
  const { error } = await admin
    .from('research_confirmations')
    .update({ created_product_id: null, product_started_at: null, product_started_by: null })
    .eq('id', input.confirmationId)
    .eq('created_product_id', input.productId)
  if (error !== null) throw toRepositoryError(ENTITY, 'release start', input.confirmationId, error)
}

/** The bulk engine's undo for `research.archive_confirmation`: the decision stands again. */
export async function unarchiveConfirmation(admin: Client, confirmationId: string): Promise<void> {
  const { error } = await admin
    .from('research_confirmations')
    .update({ archived_at: null, archived_reason: null })
    .eq('id', confirmationId)
  if (error !== null) throw toRepositoryError(ENTITY, 'unarchive', confirmationId, error)
}

/**
 * The score as it stands at the moment of shortlisting — numbers copied from the newest
 * opportunity score, or nulls when the row was never scored. Read here, in the research
 * repository, so the workflow that opens an entry imports nothing from the direction module.
 */
export async function readScoreCapture(
  client: Client,
  researchProductId: string,
): Promise<ShortlistCapture> {
  const { data, error } = await client
    .from('research_opportunity_scores')
    .select('score, confidence, model_version, computed_at')
    .eq('research_product_id', researchProductId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'score capture', researchProductId, error)
  return {
    score: data?.score ?? null,
    confidence: data?.confidence ?? null,
    modelVersion: data?.model_version ?? null,
    scoredAt: data?.computed_at ?? null,
  }
}

export interface StartedProduct {
  readonly id: string
  readonly slug: string
  readonly title: string | null
  readonly status: string
}

/**
 * Resolve `created_product_id` to a link — a SECOND QUERY on `products`, by id, reading four
 * columns, and the only place outside `lib/supabase/repositories/research-*` that may. A deleted
 * product resolves to nothing and the screen says "product no longer exists".
 */
export async function resolveStartedProducts(
  client: Client,
  ids: readonly string[],
): Promise<Map<string, StartedProduct>> {
  const wanted = ids.filter((id) => id !== '')
  if (wanted.length === 0) return new Map()
  const { data, error } = await client
    .from('products')
    .select('id, slug, title, status')
    .in('id', wanted)
  if (error !== null)
    throw toRepositoryError(ENTITY, 'resolve products', String(wanted.length), error)
  return new Map((data ?? []).map((row) => [row.id, row]))
}
