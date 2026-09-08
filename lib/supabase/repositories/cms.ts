import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '../database.types'
import { NotFoundError, ValidationError } from '../errors'
import {
  contentRevisionSchema,
  faqSchema,
  globalContentSchema,
  navigationItemSchema,
  pageSchema,
  pageSectionSchema,
  publishResultSchema,
  reorderResultSchema,
  scheduleRunResultSchema,
  seoEntrySchema,
  type ContentRevision,
  type Faq,
  type GlobalContent,
  type NavigationItem,
  type Page,
  type PageSection,
  type PublishResult,
  type ScheduleRunResult,
  type SeoEntry,
} from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'page'
const SECTION = 'page section'

/**
 * The CMS data layer — the only module holding `.from()` on the seven Phase 08 tables and the only
 * one calling the four `cms_*` functions. `npm run db:check-data-layer` enforces both, and it was
 * widened to see `.rpc(` before the first one here was written.
 *
 * READS ARE SEPARATE QUERIES, NEVER POSTGREST EMBEDDING. `select *, page_sections(*)` looks
 * tidier and is a trap under RLS: when a child row is filtered out by policy, PostgREST returns
 * the parent with an empty array — indistinguishable from a page that genuinely has no sections.
 * A page silently missing a section is the hardest class of CMS bug to notice, because the page
 * still renders. Two queries and a join in memory cost one round trip and cannot lie.
 */

// --------------------------------------------------------------------------------------------
// Refusals the database raises that a caller must be able to tell apart
// --------------------------------------------------------------------------------------------

/**
 * The `RV0` SQLSTATE class, raised by the `cms_*` functions.
 *
 * `RV` is a legal implementation-defined class: the SQL standard reserves classes beginning `0`–`4`
 * and `A`–`H`, and `R` is neither. Each code names a refusal a person can act on, which is the
 * point — a bare 23514 tells an editor a constraint fired, not which asset to go and approve.
 */
export const CMS_REFUSAL = {
  /** The row does not exist, or the edge is not in the twelve. */
  ILLEGAL: 'RV001',
  /** The section itself carries OWNER_VERIFICATION_REQUIRED. */
  UNVERIFIED_SECTION: 'RV002',
  /** Bound media is DRAFT, REVIEW or ARCHIVED. The message names every `rivya_asset_id`. */
  MEDIA_NOT_APPROVED: 'RV003',
  /** An asset cannot be unpublished: a PUBLISHED section still shows it. */
  MEDIA_IN_USE: 'RV004',
  /** A reorder did not name every section on the page exactly once. */
  REORDER_INCOMPLETE: 'RV005',
  /** Bound media is APPROVED but still OWNER_VERIFICATION_REQUIRED. See migration 0050. */
  MEDIA_UNVERIFIED: 'RV006',
} as const

export type CmsRefusalCode = (typeof CMS_REFUSAL)[keyof typeof CMS_REFUSAL]

/** A refusal that carries its code, so a Studio action can render the right message. */
export class CmsRefusalError extends ValidationError {
  readonly code: CmsRefusalCode

  constructor(code: CmsRefusalCode, message: string, cause?: unknown) {
    super('cms', [{ path: code, message }], cause)
    this.code = code
    this.name = 'CmsRefusalError'
  }
}

function isRefusalCode(code: string | undefined): code is CmsRefusalCode {
  return typeof code === 'string' && Object.values(CMS_REFUSAL).includes(code as CmsRefusalCode)
}

/**
 * Map a PostgrestError, recognising the `RV0` class before falling through.
 *
 * Everything that is NOT one of ours goes to `toRepositoryError` unchanged — a unique violation is
 * still a ConflictError, a 42501 is still a PermissionError. This only intercepts the refusals the
 * `cms_*` functions raise deliberately, because those carry a message an editor should read.
 */
export function toCmsError(
  entity: string,
  operation: string,
  identifier: string,
  error: PostgrestError,
): Error {
  if (isRefusalCode(error.code)) {
    return new CmsRefusalError(error.code, error.message, error)
  }
  return toRepositoryError(entity, operation, identifier, error)
}

export function isCmsRefusal(error: unknown, code?: CmsRefusalCode): error is CmsRefusalError {
  if (!(error instanceof CmsRefusalError)) return false
  return code === undefined || error.code === code
}

// --------------------------------------------------------------------------------------------
// Reads
// --------------------------------------------------------------------------------------------

/** By public path. Only ever finds a page with a path, so a SYSTEM row can never be returned. */
export async function getPageByPath(client: Client, path: string): Promise<Page | null> {
  const { data, error } = await client.from('pages').select('*').eq('path', path).maybeSingle()

  if (error) throw toCmsError(ENTITY, 'get', path, error)
  return data === null ? null : parseRow(ENTITY, pageSchema, data)
}

/**
 * By uuid OR slug — what `[pageId]` resolves.
 *
 * The parameter is looked up as an id when it parses as a uuid and as a slug otherwise. A
 * uuid-shaped slug would therefore be unreachable, which is why `pages_slug_not_uuid_shaped`
 * refuses one at the database.
 */
export async function getPageByIdOrSlug(client: Client, param: string): Promise<Page | null> {
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
    ? 'id'
    : 'slug'
  const { data, error } = await client.from('pages').select('*').eq(column, param).maybeSingle()

  if (error) throw toCmsError(ENTITY, 'get', param, error)
  return data === null ? null : parseRow(ENTITY, pageSchema, data)
}

export async function listPages(client: Client): Promise<Page[]> {
  const { data, error } = await client.from('pages').select('*').order('slug')

  if (error) throw toCmsError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, pageSchema, data ?? [])
}

/**
 * A page's sections, in render order.
 *
 * `position, created_at, id` — three keys, because two sections CAN share a position: the unique
 * constraint is deferrable, and a half-applied reorder that failed at commit leaves nothing, but a
 * seed writing two rows at 0 leaves an order that would otherwise vary between queries. A list
 * that renders in a different order on refresh is a bug nobody can reproduce.
 */
export async function listSectionsForPage(client: Client, pageId: string): Promise<PageSection[]> {
  const { data, error } = await client
    .from('page_sections')
    .select('*')
    .eq('page_id', pageId)
    .order('position')
    .order('created_at')
    .order('id')

  if (error) throw toCmsError(SECTION, 'list', pageId, error)
  return parseRows(SECTION, pageSectionSchema, data ?? [])
}

export async function listRevisions(
  client: Client,
  entityType: string,
  entityId: string,
  limit = 50,
): Promise<ContentRevision[]> {
  // Clamped like listActivityEvents: an unbounded limit from a query string is a way to make the
  // server assemble an arbitrarily large response.
  const capped = Math.min(Math.max(Math.trunc(limit), 1), 200)
  const { data, error } = await client
    .from('content_revisions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('revision_no', { ascending: false })
    .limit(capped)

  if (error) throw toCmsError('content revision', 'list', entityId, error)
  return parseRows('content revision', contentRevisionSchema, data ?? [])
}

export async function listGlobalContent(client: Client, group?: string): Promise<GlobalContent[]> {
  let query = client.from('global_content').select('*')
  if (group !== undefined) query = query.eq('group_key', group)

  const { data, error } = await query.order('group_key').order('key')
  if (error) throw toCmsError('global content', 'list', group ?? 'all', error)
  return parseRows('global content', globalContentSchema, data ?? [])
}

export async function listNavigationItems(
  client: Client,
  menu?: string,
): Promise<NavigationItem[]> {
  let query = client.from('navigation_items').select('*')
  if (menu !== undefined) query = query.eq('menu', menu)

  const { data, error } = await query.order('menu').order('position')
  if (error) throw toCmsError('navigation item', 'list', menu ?? 'all', error)
  return parseRows('navigation item', navigationItemSchema, data ?? [])
}

export async function listFaqs(client: Client, category?: string): Promise<Faq[]> {
  let query = client.from('faqs').select('*')
  if (category !== undefined) query = query.eq('category', category)

  const { data, error } = await query.order('position')
  if (error) throw toCmsError('faq', 'list', category ?? 'all', error)
  return parseRows('faq', faqSchema, data ?? [])
}

export async function getSeoEntry(client: Client, id: string): Promise<SeoEntry> {
  const { data, error } = await client.from('seo_entries').select('*').eq('id', id).maybeSingle()

  if (error) throw toCmsError('seo entry', 'get', id, error)
  if (!data) throw new NotFoundError('seo entry', id)
  return parseRow('seo entry', seoEntrySchema, data)
}

// --------------------------------------------------------------------------------------------
// The privileged calls
// --------------------------------------------------------------------------------------------

/**
 * Publish, unpublish or otherwise move a section, promoting its bound media atomically.
 *
 * THE CLIENT PASSED IN MUST BE THE SERVICE-ROLE CLIENT. `cms_publish_section` has EXECUTE granted
 * to `service_role` alone, so a session client gets a 42501 — which is the design, not an
 * inconvenience: it is what makes `actorId` safe as a parameter rather than a forgery vector.
 * Authorisation happens in `lib/cms/publishing.ts` before this is reached.
 */
/**
 * The columns Studio may write on a section.
 *
 * NARROWER THAN THE ROW, AND THE OMISSIONS ARE THE POINT. `status` is absent: a status change goes
 * through `cms_publish_section`, which is the only path that also runs the media cascade and the
 * verification gates. `owner_edited`, `published_at`, `published_by`, `seed_*` and every schedule
 * column are absent because they are written by triggers and by the cron — a form that could set
 * them would let an editor claim a publish that never happened, or reset an attempt counter the
 * scheduler is using.
 *
 * `updated_by` IS REQUIRED, not optional. It is what `set_owner_edited` reads to mark a row as
 * owner-touched, and what `reset_schedule_state` reads to tell a human edit from the cron's own
 * write. An update that forgets it is silently a different kind of update.
 */
export type SectionWrite = {
  readonly block_type?: string
  readonly is_visible?: boolean
  readonly theme?: string | null
  readonly layout_variant?: string | null
  readonly eyebrow?: string | null
  readonly heading?: string | null
  readonly heading_highlight?: string | null
  readonly body?: string | null
  readonly supporting?: string | null
  readonly cta_label?: string | null
  readonly cta_url?: string | null
  readonly cta_secondary_label?: string | null
  readonly cta_secondary_url?: string | null
  readonly media_desktop_id?: string | null
  readonly media_mobile_id?: string | null
  readonly media_alt_override?: string | null
  readonly media_slot_key?: string | null
  readonly payload?: Json
  readonly field_classifications?: Json
  readonly publish_at?: string | null
  readonly unpublish_at?: string | null
  readonly fact_classification?: Database['public']['Enums']['fact_classification']
  readonly owner_verification?: Database['public']['Enums']['owner_verification']
  readonly updated_by: string | null
}

/**
 * Add a block to a page.
 *
 * IT ALWAYS INSERTS AS DRAFT and does not accept a status. `enforce_status_transition` refuses
 * anything else from a session actor anyway (0052), so accepting the argument would only let a
 * caller discover that by being refused.
 *
 * THE POSITION IS COMPUTED HERE, NOT PASSED. `page_sections_unique_position` is deferrable but
 * still unique, so two editors adding a block to one page in the same second would collide on a
 * client-chosen index. `coalesce(max(position)) + 1` inside the insert would be a race too; this
 * reads then writes, and loses that race by failing the unique constraint rather than by
 * overwriting — which is the right way round.
 */
export async function insertSection(
  client: Client,
  pageId: string,
  blockType: string,
  values: SectionWrite,
): Promise<PageSection> {
  const existing = await listSectionsForPage(client, pageId)
  const position = existing.reduce((max, section) => Math.max(max, section.position), -1) + 1

  const { data, error } = await client
    .from('page_sections')
    .insert({ ...values, page_id: pageId, block_type: blockType, position })
    .select('*')
    .single()

  if (error) throw toCmsError(SECTION, 'create', blockType, error)
  return parseRow(SECTION, pageSectionSchema, data)
}

export async function updateSection(
  client: Client,
  sectionId: string,
  values: SectionWrite,
): Promise<PageSection> {
  const { data, error } = await client
    .from('page_sections')
    .update(values)
    .eq('id', sectionId)
    .select('*')
    .single()

  if (error) throw toCmsError(SECTION, 'update', sectionId, error)
  return parseRow(SECTION, pageSectionSchema, data)
}

/**
 * Remove a section.
 *
 * THE GAP IN `position` IS LEFT BEHIND deliberately. Closing it here would mean rewriting every
 * later row inside a delete, and `cms_reorder_sections` already exists to renumber a page in one
 * statement under the deferrable constraint. Ordering reads by `position`, not by contiguity, so a
 * gap changes nothing a visitor or an editor can see.
 */
export async function deleteSection(client: Client, sectionId: string): Promise<void> {
  const { error } = await client.from('page_sections').delete().eq('id', sectionId)
  if (error) throw toCmsError(SECTION, 'delete', sectionId, error)
}

export async function getSection(client: Client, sectionId: string): Promise<PageSection | null> {
  const { data, error } = await client
    .from('page_sections')
    .select('*')
    .eq('id', sectionId)
    .maybeSingle()

  if (error) throw toCmsError(SECTION, 'read', sectionId, error)
  return data === null ? null : parseRow(SECTION, pageSectionSchema, data)
}

export async function publishSection(
  client: Client,
  input: {
    sectionId: string
    to: Database['public']['Enums']['content_status']
    actorId: string | null
    changeSummary?: string | null
  },
): Promise<PublishResult> {
  const { data, error } = await client.rpc('cms_publish_section', {
    p_section_id: input.sectionId,
    p_to: input.to,
    p_actor: input.actorId,
    p_change_summary: input.changeSummary ?? null,
  })

  if (error) throw toCmsError(SECTION, 'publish', input.sectionId, error)
  // Validated like any other boundary. The generated Functions map types every return as `Json`,
  // so without this the caller reads `.promoted` off an unknown and finds out at render time.
  return parseRow(SECTION, publishResultSchema, data)
}

export async function unpublishMediaAsset(
  client: Client,
  mediaId: string,
  actorId: string | null,
): Promise<void> {
  const { error } = await client.rpc('cms_unpublish_media_asset', {
    p_media_id: mediaId,
    p_actor: actorId,
  })

  if (error) throw toCmsError('media asset', 'unpublish', mediaId, error)
}

export async function reorderSections(
  client: Client,
  pageId: string,
  sectionIds: readonly string[],
  actorId: string | null,
): Promise<number> {
  const { data, error } = await client.rpc('cms_reorder_sections', {
    p_page_id: pageId,
    p_ids: sectionIds,
    p_actor: actorId,
  })

  if (error) throw toCmsError(SECTION, 'reorder', pageId, error)
  return parseRow(SECTION, reorderResultSchema, data).count
}

/**
 * Run the scheduled publish/unpublish sweep.
 *
 * THE WHOLE SWEEP IS ONE CALL, not a due-query followed by N publishes. `cms_run_content_schedule`
 * holds a row lock with SKIP LOCKED for the length of the run, so a second invocation — a Vercel
 * retry, a manual trigger, a slow tick overlapping the next one — sees an empty set rather than
 * publishing the same sections again. Doing the loop here would put every one of those races back.
 *
 * `now` IS A PARAMETER so a test can ask what the sweep would do at a given instant without
 * waiting for it, and so the whole run evaluates against ONE clock rather than a slightly later
 * one for each row.
 */
export async function runContentSchedule(
  client: Client,
  options: { now?: Date; maxAttempts?: number } = {},
): Promise<ScheduleRunResult> {
  const { data, error } = await client.rpc('cms_run_content_schedule', {
    p_now: (options.now ?? new Date()).toISOString(),
    p_max_attempts: options.maxAttempts ?? 3,
  })

  if (error) throw toCmsError(SECTION, 'schedule', 'sweep', error)
  return parseRow(SECTION, scheduleRunResultSchema, data)
}

export async function restoreRevisionRow(
  client: Client,
  entityType: string,
  entityId: string,
  revisionNo: number,
  actorId: string | null,
): Promise<void> {
  const { error } = await client.rpc('cms_restore_revision', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_revision_no: revisionNo,
    p_actor: actorId,
  })

  if (error) throw toCmsError('content revision', 'restore', entityId, error)
}
