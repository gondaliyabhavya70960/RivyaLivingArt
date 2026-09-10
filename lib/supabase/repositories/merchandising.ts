import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { PermissionError } from '../errors'
import {
  merchandisingEntrySchema,
  merchandisingSlotSchema,
  type MerchandisingEntry,
  type MerchandisingSlot,
} from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>
type RelationEntity = Database['public']['Enums']['relation_entity']
type ContentStatus = Database['public']['Enums']['content_status']

const SLOT = 'merchandising slot'
const ENTRY = 'merchandising entry'

/**
 * `merchandising_slots` and `merchandising_entries` — the only module that reads or writes them.
 *
 * NOTHING HERE FILTERS ON STATUS OR WINDOW IN APPLICATION CODE, on the same rule as every other
 * repository: the public site sees live rows because RLS says so (0201), not because a read
 * remembered a clause. The one exception is stated where it happens — `listPublishedTargets`
 * filters `status = 'PUBLISHED'` explicitly because the resolver may run with a STAFF client in a
 * Studio preview, and a preview that showed a draft product in a public band would be previewing
 * a page no visitor can get.
 *
 * WRITES ARE READ BACK. Every write policy on these tables FILTERS rather than refuses, so a role the
 * policy does not admit changes nothing and is told it worked. A remove that leaves the row behind
 * and a save that changes nothing both throw `PermissionError` here, so the Server Action can say
 * so rather than reporting a save that did not happen.
 */

// --- Slots ---------------------------------------------------------------------------------------

export async function listSlots(client: Client): Promise<MerchandisingSlot[]> {
  const { data, error } = await client
    .from('merchandising_slots')
    .select('*')
    .order('surface', { ascending: true })
    .order('key', { ascending: true })

  if (error) throw toRepositoryError(SLOT, 'list', 'all', error)
  return parseRows(SLOT, merchandisingSlotSchema, data ?? [])
}

/** One slot by key, or null. Null rather than a throw: a key the register names and the database lacks is a fallback, not a 500. */
export async function getSlotByKey(client: Client, key: string): Promise<MerchandisingSlot | null> {
  const { data, error } = await client
    .from('merchandising_slots')
    .select('*')
    .eq('key', key)
    .maybeSingle()

  if (error) throw toRepositoryError(SLOT, 'get', key, error)
  return data === null ? null : parseRow(SLOT, merchandisingSlotSchema, data)
}

export async function getSlotById(client: Client, id: string): Promise<MerchandisingSlot | null> {
  const { data, error } = await client
    .from('merchandising_slots')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw toRepositoryError(SLOT, 'get', id, error)
  return data === null ? null : parseRow(SLOT, merchandisingSlotSchema, data)
}

/** The slots one Studio screen owns, which is the only set that screen may draw editors for. */
export async function listSlotsOwnedBy(
  client: Client,
  studioRoute: string,
): Promise<MerchandisingSlot[]> {
  const { data, error } = await client
    .from('merchandising_slots')
    .select('*')
    .eq('owning_studio_route', studioRoute)
    .order('surface', { ascending: true })
    .order('key', { ascending: true })

  if (error) throw toRepositoryError(SLOT, 'list', studioRoute, error)
  return parseRows(SLOT, merchandisingSlotSchema, data ?? [])
}

export type SlotSettings = {
  readonly min_items?: number
  readonly max_items?: number
  readonly auto_fill?: boolean
  readonly auto_fill_rule?: string | null
  readonly fallback_mode?: MerchandisingSlot['fallback_mode']
  readonly fallback_section_id?: string | null
}

/**
 * The editable half of a slot: its minimum, maximum, rule and fallback.
 *
 * NOT ITS KEY, SURFACE, OWNER OR TYPES. Those are what make a slot a slot, and a screen that could
 * repoint one at a different surface would be editing the route map. The read-back is the
 * permission check made visible (see the header).
 */
export async function updateSlotSettings(
  client: Client,
  slotId: string,
  settings: SlotSettings,
  actorId: string,
): Promise<MerchandisingSlot> {
  const { data, error } = await client
    .from('merchandising_slots')
    .update({ ...settings, updated_by: actorId })
    .eq('id', slotId)
    .select('*')
    .maybeSingle()

  if (error) throw toRepositoryError(SLOT, 'update', slotId, error)
  if (data === null) throw new PermissionError('update', SLOT)
  return parseRow(SLOT, merchandisingSlotSchema, data)
}

// --- Entries -------------------------------------------------------------------------------------

/**
 * A slot's entries, in the order the resolver and the Studio both use.
 *
 * PINNED FIRST, THEN POSITION, THEN ID. `is_pinned` is editorial emphasis inside the slot and the
 * order is where it shows; `id` breaks the tie so two entries at one position do not reshuffle
 * between requests. Whatever client calls this sees whatever RLS admits — every entry for staff,
 * live ones for a visitor — and the resolver re-applies liveness in code for the preview case.
 */
export async function listEntries(client: Client, slotId: string): Promise<MerchandisingEntry[]> {
  const { data, error } = await client
    .from('merchandising_entries')
    .select('*')
    .eq('slot_id', slotId)
    .order('is_pinned', { ascending: false })
    .order('position', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw toRepositoryError(ENTRY, 'list', slotId, error)
  return parseRows(ENTRY, merchandisingEntrySchema, data ?? [])
}

/** Every entry across every slot — the scheduling calendar's read. Staff only in practice: anon sees live rows, which is a smaller calendar and not a leak. */
export async function listAllEntries(client: Client): Promise<MerchandisingEntry[]> {
  const { data, error } = await client
    .from('merchandising_entries')
    .select('*')
    .order('slot_id', { ascending: true })
    .order('position', { ascending: true })

  if (error) throw toRepositoryError(ENTRY, 'list', 'all', error)
  return parseRows(ENTRY, merchandisingEntrySchema, data ?? [])
}

export async function getEntry(
  client: Client,
  entryId: string,
): Promise<MerchandisingEntry | null> {
  const { data, error } = await client
    .from('merchandising_entries')
    .select('*')
    .eq('id', entryId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTRY, 'get', entryId, error)
  return data === null ? null : parseRow(ENTRY, merchandisingEntrySchema, data)
}

/**
 * Add an entity to the end of a slot.
 *
 * THE POSITION IS COMPUTED HERE, NOT PASSED, for the reason `insertSection` gives: two people
 * adding to one slot in the same second should not both claim the same index from a stale screen.
 * There is no unique constraint on position — `merch_move_entry` swaps pairs and a duplicate
 * index is harmless to the read order — so the race resolves to two entries at the end, in id
 * order, which is the arrangement either person would have made.
 *
 * WHAT THE DATABASE REFUSES AND THIS DOES NOT RE-CHECK: an entity type the slot does not admit,
 * an entity that does not exist, and a collection still in concept. `guard_merchandising_entry()`
 * names each with its own error code; the Server Action translates them for the editor.
 */
export async function addEntry(
  client: Client,
  values: {
    readonly slotId: string
    readonly entityType: RelationEntity
    readonly entityId: string
    readonly note?: string | null
  },
  actorId: string,
): Promise<MerchandisingEntry> {
  const existing = await listEntries(client, values.slotId)
  const position = existing.reduce((max, entry) => Math.max(max, entry.position), -1) + 1

  const { data, error } = await client
    .from('merchandising_entries')
    .insert({
      slot_id: values.slotId,
      entity_type: values.entityType,
      entity_id: values.entityId,
      position,
      note: values.note ?? null,
      updated_by: actorId,
    })
    .select('*')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTRY, 'add', values.entityId, error)
  if (data === null) throw new PermissionError('add', ENTRY)
  return parseRow(ENTRY, merchandisingEntrySchema, data)
}

export type EntryEdit = {
  readonly is_pinned?: boolean
  readonly publish_at?: string | null
  readonly unpublish_at?: string | null
  readonly note?: string | null
  readonly status?: ContentStatus
}

/**
 * Edit an entry's window, note, pin or status.
 *
 * A STATUS CHANGE HERE IS THE WHOLE RELEASE WORKFLOW, and that is smaller than a section's on
 * purpose. A section carries copy that a reviewer reads; an entry carries a reference to something
 * that has ALREADY been through its own workflow. `merchandising.write` therefore publishes an entry
 * directly, and the database stamps `published_at` the first time it does.
 *
 * A window change also puts the sweep's bookkeeping back to PENDING, so the next tick re-derives
 * which side of the new window the entry is on and records the transition once.
 */
export async function updateEntry(
  client: Client,
  entryId: string,
  edit: EntryEdit,
  actorId: string,
): Promise<MerchandisingEntry> {
  const windowChanged = 'publish_at' in edit || 'unpublish_at' in edit
  const { data, error } = await client
    .from('merchandising_entries')
    .update({ ...edit, ...(windowChanged ? { window_state: 'PENDING' } : {}), updated_by: actorId })
    .eq('id', entryId)
    .select('*')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTRY, 'update', entryId, error)
  if (data === null) throw new PermissionError('update', ENTRY)
  return parseRow(ENTRY, merchandisingEntrySchema, data)
}

/**
 * Remove an entry, and confirm it went.
 *
 * The delete policy admits `merchandising.write`; a role outside it deletes nothing and is told
 * SUCCESS, so the row is read back and a survivor is a refusal.
 */
export async function removeEntry(client: Client, entryId: string): Promise<void> {
  const { error } = await client.from('merchandising_entries').delete().eq('id', entryId)
  if (error) throw toRepositoryError(ENTRY, 'remove', entryId, error)

  const survivor = await getEntry(client, entryId)
  if (survivor !== null) throw new PermissionError('remove', ENTRY)
}

/**
 * Move an entry one place within its slot, atomically, through `merch_move_entry()`.
 *
 * SECURITY INVOKER, so RLS still decides: a role without `merchandising.write` sees the two UPDATEs
 * filter to nothing, and the read-back below turns that silence into a refusal.
 */
export async function moveEntry(
  client: Client,
  entryId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const before = await getEntry(client, entryId)
  if (before === null) throw new PermissionError('move', ENTRY)

  const { error } = await client.rpc('merch_move_entry', {
    p_entry_id: entryId,
    p_direction: direction,
  })
  if (error) throw toRepositoryError(ENTRY, 'move', entryId, error)
}

// --- Targets -------------------------------------------------------------------------------------

/**
 * What a card needs about one entity, and nothing more. The same restraint `reference.ts` keeps:
 * a name, a line and a picture — never a price, a dimension or an availability state.
 */
export type TargetRow = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly summary: string | null
  readonly hero_media_id: string | null
  readonly published_at: string | null
}

/** The table and columns behind each entity type a slot may admit. `MATERIAL` and `PORTFOLIO_PROJECT` are admitted by the enum and by no slot. */
const TARGET_TABLES = {
  PRODUCT: { table: 'products', title: 'title', summary: 'summary' },
  COLLECTION: { table: 'collections', title: 'name', summary: 'statement' },
  CATEGORY: { table: 'categories', title: 'name', summary: 'subtitle' },
  JOURNAL_ARTICLE: { table: 'journal_articles', title: 'title', summary: 'summary' },
  PORTFOLIO_PROJECT: { table: 'portfolio_projects', title: 'title', summary: 'summary' },
  MATERIAL: { table: 'materials', title: 'name', summary: 'description' },
} as const satisfies Record<RelationEntity, { table: string; title: string; summary: string }>

type LooseRow = Record<string, unknown>

/**
 * The columns, aliased to the card shape, so six tables answer in one shape and the resolver never
 * learns that a collection's title is called `name`.
 */
function targetColumns(type: RelationEntity): string {
  const spec = TARGET_TABLES[type]
  return `id, slug, title:${spec.title}, summary:${spec.summary}, hero_media_id, published_at`
}

function toTargetRow(row: LooseRow): TargetRow | null {
  const id = row.id
  const slug = row.slug
  const title = row.title
  if (typeof id !== 'string' || typeof slug !== 'string' || typeof title !== 'string') return null
  if (title.trim() === '') return null
  return {
    id,
    slug,
    title,
    summary: typeof row.summary === 'string' ? row.summary : null,
    hero_media_id: typeof row.hero_media_id === 'string' ? row.hero_media_id : null,
    published_at: typeof row.published_at === 'string' ? row.published_at : null,
  }
}

/**
 * The published rows behind a set of entries, by id.
 *
 * `status = 'PUBLISHED'` IS FILTERED HERE, IN CODE, and that is the one deliberate exception to the
 * repository rule stated in the header. The resolver may be handed a staff client — a Studio
 * preview reads the page as its editor — and a draft product surfacing in a curated band under
 * preview would be a page no visitor can reach. RLS still applies underneath for a visitor; this
 * clause makes the two clients agree.
 *
 * THE SELECT LIST IS NARROW ON PURPOSE. Six tables, one card shape, no price. `journal_articles`
 * and `portfolio_projects` are typed since Phases 17 and 18, so unlike `reference.ts` nothing here
 * needs the missing-table escape hatch; the cast below widens the column alias string only.
 */
export async function listPublishedTargets(
  client: Client,
  type: RelationEntity,
  ids: readonly string[],
): Promise<Map<string, TargetRow>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()

  const loose = client as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (
          column: string,
          values: readonly string[],
        ) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{ data: LooseRow[] | null; error: PostgrestError | null }>
        }
      }
    }
  }

  const { data, error } = await loose
    .from(TARGET_TABLES[type].table)
    .select(targetColumns(type))
    .in('id', unique)
    .eq('status', 'PUBLISHED')

  if (error !== null) throw toRepositoryError(ENTRY, 'targets', type, error)

  const rows = new Map<string, TargetRow>()
  for (const raw of data ?? []) {
    const row = toTargetRow(raw)
    if (row !== null) rows.set(row.id, row)
  }
  return rows
}

/**
 * The most recently published rows of one type, for the resolver's ONE rule.
 *
 * RECENCY AND NOTHING ELSE. No view count, no enquiry count, no "popular": the only signal this
 * reads is `published_at`, because it is the only signal the site has that is not manufactured
 * (FEAT §28). `exclude` keeps entries already present from being counted twice.
 */
export async function listRecentlyPublished(
  client: Client,
  type: RelationEntity,
  limit: number,
  exclude: readonly string[],
): Promise<TargetRow[]> {
  const loose = client as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean; nullsFirst: boolean },
          ) => {
            limit: (n: number) => Promise<{ data: LooseRow[] | null; error: PostgrestError | null }>
          }
        }
      }
    }
  }

  // Over-fetch by the exclusion count so the top-up still reaches `limit` after filtering.
  const { data, error } = await loose
    .from(TARGET_TABLES[type].table)
    .select(targetColumns(type))
    .eq('status', 'PUBLISHED')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit + exclude.length)

  if (error !== null) throw toRepositoryError(ENTRY, 'recent', type, error)

  const skip = new Set(exclude)
  const rows: TargetRow[] = []
  for (const raw of data ?? []) {
    const row = toTargetRow(raw)
    if (row === null || skip.has(row.id)) continue
    rows.push(row)
    if (rows.length >= limit) break
  }
  return rows
}

// --- The sweep -----------------------------------------------------------------------------------

export type MerchandisingSweepResult = {
  readonly ran_at: string
  readonly opened: readonly { entry_id: string; slot_key: string }[]
  readonly closed: readonly { entry_id: string; slot_key: string }[]
  readonly paths: readonly string[]
}

/** The merchandising pass of the content-schedule cron. Service role only; see 0200 §7. */
export async function runMerchandisingSchedule(
  client: Client,
  options: { now?: Date } = {},
): Promise<MerchandisingSweepResult> {
  const { data, error } = await client.rpc('merch_run_schedule', {
    p_now: (options.now ?? new Date()).toISOString(),
  })
  if (error) throw toRepositoryError(ENTRY, 'sweep', 'schedule', error)

  const result = data as unknown as MerchandisingSweepResult | null
  if (result === null || typeof result !== 'object') {
    throw new Error('merch_run_schedule returned no summary')
  }
  return {
    ran_at: String(result.ran_at),
    opened: Array.isArray(result.opened) ? result.opened : [],
    closed: Array.isArray(result.closed) ? result.closed : [],
    paths: Array.isArray(result.paths) ? result.paths.map(String) : [],
  }
}
