import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research review'

export type ReviewActionRow = Database['public']['Tables']['research_review_actions']['Row']
export type NoteRow = Database['public']['Tables']['research_notes']['Row']
export type TagRow = Database['public']['Tables']['research_tags']['Row']
export type ProductTagRow = Database['public']['Tables']['research_product_tags']['Row']

const ACTION_COLUMNS =
  'id, research_product_id, change_id, action, reason, actor_user_id, actor_role, ' +
  'occurred_at, undone_by_action_id'

const NOTE_COLUMNS = 'id, research_product_id, body, author_user_id, created_at, superseded_by'

const TAG_COLUMNS =
  'id, slug, label, colour, is_enabled, status, created_at, updated_at, updated_by'

/**
 * The three append-only tables a person's judgement lives in.
 *
 * WRITES GO THROUGH THE SESSION, REVERSALS THROUGH THE SERVICE ROLE, and the split is not
 * arbitrary. Inserting an action or a note is something the person is permitted to do and RLS
 * should judge it — `research.confirm`, checked by the server action first and by the database
 * second. But the two tables have UPDATE triggers that refuse everything except one column, and
 * no update policy at all, precisely so that nobody can rewrite a decision through PostgREST. The
 * reversal therefore has to be written by the system, in the same call that inserts the reversing
 * action, which is exactly the two-client model `explorer/actions.ts` documents: the domain write
 * runs as the person, the bookkeeping that closes it runs as the system.
 */

export async function recordAction(
  client: Client,
  input: {
    readonly productId: string
    readonly changeId: string | null
    readonly action: string
    readonly reason: string | null
    readonly actorUserId: string
    readonly actorRole: string
  },
): Promise<ReviewActionRow> {
  const { data, error } = await client
    .from('research_review_actions')
    .insert({
      research_product_id: input.productId,
      change_id: input.changeId,
      action: input.action,
      reason: input.reason,
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole,
    })
    .select(ACTION_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'record', input.action, error)
  return data as unknown as ReviewActionRow
}

/**
 * Point an earlier action at the one that undid it.
 *
 * THE TRIGGER PERMITS THIS EXACTLY ONCE, FROM NULL, and refuses a second reversal with a message
 * naming the action that already reversed it. That is deliberate: two people undoing the same
 * decision from two screens is a race, and the loser should be told rather than silently
 * overwriting the winner's link.
 */
export async function markUndone(
  admin: Client,
  input: { readonly actionId: string; readonly undoneByActionId: string },
): Promise<void> {
  const { error } = await admin
    .from('research_review_actions')
    .update({ undone_by_action_id: input.undoneByActionId })
    .eq('id', input.actionId)
    .is('undone_by_action_id', null)
  if (error !== null) throw toRepositoryError(ENTITY, 'undo', input.actionId, error)
}

export async function listActionsForProduct(
  client: Client,
  productId: string,
): Promise<readonly ReviewActionRow[]> {
  const { data, error } = await client
    .from('research_review_actions')
    .select(ACTION_COLUMNS)
    .eq('research_product_id', productId)
    .order('occurred_at', { ascending: false })
    .limit(200)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', productId, error)
  return (data ?? []) as unknown as ReviewActionRow[]
}

/**
 * The latest un-reversed action on a change, which is what its `decided_action` should say.
 *
 * READ RATHER THAN ASSUMED WHEN A REVERSAL LANDS. Undoing a shortlist does not always return the
 * change to undecided: somebody may have reviewed it before shortlisting it, and that earlier
 * decision still stands. Recomputing from the log is the only way to get that right, and it is
 * cheap because a change has a handful of actions, not a page of them.
 */
export async function latestStandingAction(
  client: Client,
  changeId: string,
): Promise<ReviewActionRow | null> {
  const { data, error } = await client
    .from('research_review_actions')
    .select(ACTION_COLUMNS)
    .eq('change_id', changeId)
    .is('undone_by_action_id', null)
    .order('occurred_at', { ascending: false })
    .limit(20)
  if (error !== null) throw toRepositoryError(ENTITY, 'standing', changeId, error)
  const rows = (data ?? []) as unknown as ReviewActionRow[]

  // COMPARE, NOTE, TAG and the reversals themselves are not decisions about the change. A person
  // who added a note after ignoring one has not un-ignored it.
  const decisions = new Set([
    'REVIEW',
    'IGNORE',
    'SHORTLIST',
    'REJECT',
    'MARK_DUPLICATE',
    'CONFIRM',
  ])
  return rows.find((row) => decisions.has(row.action)) ?? null
}

export async function addNote(
  client: Client,
  input: { readonly productId: string; readonly body: string; readonly authorUserId: string },
): Promise<NoteRow> {
  const { data, error } = await client
    .from('research_notes')
    .insert({
      research_product_id: input.productId,
      body: input.body,
      author_user_id: input.authorUserId,
    })
    .select(NOTE_COLUMNS)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'note', input.productId, error)
  return data as unknown as NoteRow
}

export async function supersedeNote(
  admin: Client,
  input: { readonly noteId: string; readonly supersededBy: string },
): Promise<void> {
  const { error } = await admin
    .from('research_notes')
    .update({ superseded_by: input.supersededBy })
    .eq('id', input.noteId)
    .is('superseded_by', null)
  if (error !== null) throw toRepositoryError(ENTITY, 'supersede', input.noteId, error)
}

export async function listNotes(client: Client, productId: string): Promise<readonly NoteRow[]> {
  const { data, error } = await client
    .from('research_notes')
    .select(NOTE_COLUMNS)
    .eq('research_product_id', productId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error !== null) throw toRepositoryError(ENTITY, 'notes', productId, error)
  return (data ?? []) as unknown as NoteRow[]
}

/** The controlled vocabulary. Only enabled, published tags may be applied. */
export async function listTags(
  client: Client,
  includeDisabled = false,
): Promise<readonly TagRow[]> {
  let query = client.from('research_tags').select(TAG_COLUMNS).order('label', { ascending: true })
  if (!includeDisabled) query = query.eq('is_enabled', true).eq('status', 'PUBLISHED')

  const { data, error } = await query.limit(500)
  if (error !== null) throw toRepositoryError(ENTITY, 'tags', 'all', error)
  return (data ?? []) as unknown as TagRow[]
}

export async function listProductTags(
  client: Client,
  productId: string,
): Promise<readonly ProductTagRow[]> {
  const { data, error } = await client
    .from('research_product_tags')
    .select('research_product_id, tag_id, assigned_by, assigned_at')
    .eq('research_product_id', productId)
  if (error !== null) throw toRepositoryError(ENTITY, 'product tags', productId, error)
  return data ?? []
}

/**
 * Apply a tag.
 *
 * `ignoreDuplicates` IS WHAT MAKES A DOUBLE-CLICK HARMLESS. The composite primary key already makes
 * the second insert an error; treating that error as success would mean swallowing every error on
 * this path, so the upsert says so explicitly instead.
 */
export async function assignTag(
  client: Client,
  input: { readonly productId: string; readonly tagId: string; readonly actorUserId: string },
): Promise<void> {
  const { error } = await client.from('research_product_tags').upsert(
    {
      research_product_id: input.productId,
      tag_id: input.tagId,
      assigned_by: input.actorUserId,
    },
    { onConflict: 'research_product_id,tag_id', ignoreDuplicates: true },
  )
  if (error !== null) throw toRepositoryError(ENTITY, 'assign tag', input.tagId, error)
}

export async function removeTag(
  client: Client,
  input: { readonly productId: string; readonly tagId: string },
): Promise<void> {
  const { error } = await client
    .from('research_product_tags')
    .delete()
    .eq('research_product_id', input.productId)
    .eq('tag_id', input.tagId)
  if (error !== null) throw toRepositoryError(ENTITY, 'remove tag', input.tagId, error)
}
