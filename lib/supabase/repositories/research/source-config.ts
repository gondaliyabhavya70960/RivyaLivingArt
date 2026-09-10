import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  CategoryMappingInput,
  ScheduleInput,
  UrlPatternInput,
} from '@/lib/scraper/core/source-schema'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

/**
 * The three child tables that make a source configurable without a deploy:
 * `research_source_url_patterns`, `research_source_category_map` and `research_source_schedules`.
 *
 * ONE CLIENT REACHES THIS FILE, WHICH IS THE DIFFERENCE FROM `sources.ts`. That file's header
 * explains why a source row is written by two clients — the Studio session and the service-role
 * drain loop, because the politeness counters have no session write policy at all. Nothing here is
 * a counter. Every row in these three tables is a sentence a member of staff typed, so every
 * function takes the SESSION client and RLS decides, exactly as `0241` wrote it: `research.read` to
 * see a row, `research.write` to add or change one, and `destructive.execute` to remove one.
 *
 * THE DELETE PERMISSION IS THE STRICTEST AND THE REASON IS WORTH REPEATING WHERE THE CODE IS.
 * Removing an EXCLUDE pattern does not delete information; it WIDENS what Rivya will fetch. That is
 * the same class of act as unpublishing live content and it takes the same permission — checked in
 * the server action, above this layer, because that is where `requirePermission` lives.
 *
 * THE TWO CONSTRAINTS A CALLER WILL ACTUALLY HIT, both mapped to a typed `ValidationError` by
 * `toRepositoryError` so the Studio can name what was refused rather than saying "something went
 * wrong":
 *
 *   `research_source_schedules_min_interval` — the six-hour politeness floor, computed in SQL by
 *   `public.research_cron_min_interval_minutes`. `scheduleInputSchema` refuses the same expression
 *   before the write, so a caller normally never sees this; it fires when something skipped the
 *   form, which is precisely why the rule is in the table as well.
 *
 *   `research_source_category_map_not_both` — a mapping row cannot say both "this is our furniture"
 *   and "this is not something Rivya sells". NAMED HERE AS THE MIGRATION WROTE IT, and it is not
 *   the name the brief and `lib/scraper/core/source-schema.ts` use: both call it
 *   `research_source_category_map_decides_something` and describe it as
 *   `category_id is not null or is_ignored`. `0240` deliberately does NOT carry that constraint,
 *   and the long note above the table says why — `category_id` is `on delete set null`, so under
 *   that CHECK deleting a Rivya category would be refused, turning `on delete set null` back into
 *   `on delete restrict` and stopping a merchandiser removing a category a researcher once mapped
 *   to. The third state (UNRESOLVED) is real, stored and counted by
 *   `countUnresolvedCategoryMappings` below. A caller matching on the other name would match
 *   nothing for ever, which is why this is stated rather than left to be discovered.
 */

export type UrlPatternRow = Database['public']['Tables']['research_source_url_patterns']['Row']
export type CategoryMappingRow = Database['public']['Tables']['research_source_category_map']['Row']
export type SourceScheduleRow = Database['public']['Tables']['research_source_schedules']['Row']

const PATTERN = 'research source URL pattern'
const MAPPING = 'research source category mapping'
const SCHEDULE = 'research source schedule'

const URL_PATTERN_COLUMNS =
  'id, source_id, kind, pattern, is_regex, priority, notes, status, created_at, updated_at, ' +
  'updated_by'

const CATEGORY_MAP_COLUMNS =
  'id, source_id, source_label, source_path, category_id, is_ignored, mapping_state, status, ' +
  'created_at, updated_at, updated_by'

const SCHEDULE_COLUMNS =
  'id, source_id, job_type, cron_expression, timezone, is_enabled, next_run_at, status, ' +
  'created_at, updated_at, updated_by'

/*
 * WHY EVERY WRITE BELOW BRANCHES ON `id` RATHER THAN CALLING `.upsert()`.
 *
 * All three tables carry a UNIQUE on their natural key — `(source_id, kind, pattern)`,
 * `(source_id, source_label)`, `(source_id, job_type, cron_expression)`. An `upsert` on that key
 * would turn "add a pattern that already exists" into a silent overwrite of the existing row's
 * priority and notes, by somebody who believed they were adding a new one. Branching means the
 * unique constraint speaks, `toRepositoryError` turns it into a `ConflictError` naming the
 * constraint, and the operator is told the row is already there — which is the answer they need.
 *
 * `updated_at` IS SET EXPLICITLY ON EVERY WRITE rather than left to a trigger, matching
 * `setPolicyReview` and `setSourceEnabled` in `sources.ts`: no research table carries a
 * touch-`updated_at` trigger, so a write that omitted it would leave the column reading as the
 * moment the row was created for the rest of its life.
 */
function nowIso(): string {
  return new Date().toISOString()
}

/* --- FEAT §26 field 10: URL patterns ------------------------------------------------------------ */

/**
 * Highest priority first, then `kind`, then `pattern`.
 *
 * THIS ORDER IS FOR THE PERSON, NOT FOR THE MATCHER, and the distinction is worth stating because
 * the two look like they should be the same rule. `matchUrl` in `lib/scraper/core/url-patterns.ts`
 * sorts the array it is handed — priority descending, then PRODUCT before CATEGORY before
 * PAGINATION, then pattern text, then id — so nothing it decides depends on what arrives in what
 * order. What this ordering buys is that the editor's table leads with the rule that wins, and that
 * two rows of equal priority never swap places between two renders of the same page. Sorting `kind`
 * alphabetically here rather than by the matcher's precedence is deliberate: a column a reader can
 * scan beats a column that encodes an ordering they cannot see.
 *
 * EXCLUDE WINS WHATEVER EITHER ORDER SAYS. The matcher evaluates every EXCLUDE in a pass of its own
 * before it looks at a single claim, precisely so that the priority column cannot become a way to
 * CONFIGURE A REFUSAL AWAY by raising a PRODUCT rule above it.
 */
export async function listUrlPatterns(client: Client, sourceId: string): Promise<UrlPatternRow[]> {
  const { data, error } = await client
    .from('research_source_url_patterns')
    .select(URL_PATTERN_COLUMNS)
    .eq('source_id', sourceId)
    .order('priority', { ascending: false })
    .order('kind', { ascending: true })
    .order('pattern', { ascending: true })
  if (error) throw toRepositoryError(PATTERN, 'list', sourceId, error)
  return (data ?? []) as unknown as UrlPatternRow[]
}

export async function upsertUrlPattern(
  client: Client,
  input: UrlPatternInput & {
    /** `null` creates. A string updates that row and nothing else. */
    readonly id: string | null
    readonly sourceId: string
    readonly actorId: string
  },
): Promise<string> {
  const fields = {
    kind: input.kind,
    pattern: input.pattern,
    is_regex: input.isRegex,
    priority: input.priority,
    notes: input.notes,
    updated_by: input.actorId,
    updated_at: nowIso(),
  }

  if (input.id === null) {
    const { data, error } = await client
      .from('research_source_url_patterns')
      .insert({ source_id: input.sourceId, ...fields })
      .select('id')
      .single()
    if (error) throw toRepositoryError(PATTERN, 'create', input.pattern, error)
    return data.id
  }

  // `source_id` IS NOT IN THE UPDATE. A pattern belongs to the source it was written for, and
  // moving one between sources is not an edit — it is a new pattern at the new source and a
  // deletion at the old, each of which is somebody's decision and each of which is audited.
  const { error } = await client
    .from('research_source_url_patterns')
    .update(fields)
    .eq('id', input.id)
  if (error) throw toRepositoryError(PATTERN, 'update', input.id, error)
  return input.id
}

export async function deleteUrlPattern(client: Client, id: string): Promise<void> {
  const { error } = await client.from('research_source_url_patterns').delete().eq('id', id)
  if (error) throw toRepositoryError(PATTERN, 'delete', id, error)
}

/* --- FEAT §26 field 9: category mapping --------------------------------------------------------- */

/**
 * `mapping_state` IS A STORED GENERATED COLUMN AND MUST NEVER BE SENT.
 *
 * PostgreSQL refuses any value for one — including the value it would itself compute — so a write
 * carrying it fails outright. The generated `Insert` type nevertheless demands it, because
 * `scripts/db/gen-types.mjs` marks a column optional when it has a DEFAULT and a generated column
 * has none; it reads `column_default`, never `is_generated`. So the type asks for exactly the
 * column the database will reject.
 *
 * The narrowing is here rather than as a cast at the call site so that the untruth is stated once,
 * with its reason, and so that whoever fixes the generator can delete this and see every use of it
 * disappear with a compiler error rather than by grepping.
 */
type CategoryMappingInsert = Database['public']['Tables']['research_source_category_map']['Insert']
type CategoryMappingWrite = Omit<CategoryMappingInsert, 'mapping_state'>

/**
 * Oldest first, and that is a CONTRACT rather than a preference.
 *
 * `lib/scraper/core/category-map.ts` resolves a label by indexing these rows and letting the FIRST
 * of any two that normalise to the same key win, "because repositories read these in creation order
 * and the oldest decision is the one that has been in effect". The unique constraint only stops two
 * rows with the identical label, so two spellings that differ by case or spacing are both storable
 * and both reach that index. Ordering by `source_label` here would make which of them wins depend
 * on the alphabet, and a mapping saved today would silently rewrite how items resolved yesterday.
 */
export async function listCategoryMappings(
  client: Client,
  sourceId: string,
): Promise<CategoryMappingRow[]> {
  const { data, error } = await client
    .from('research_source_category_map')
    .select(CATEGORY_MAP_COLUMNS)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw toRepositoryError(MAPPING, 'list', sourceId, error)
  return (data ?? []) as unknown as CategoryMappingRow[]
}

export async function upsertCategoryMapping(
  client: Client,
  input: CategoryMappingInput & {
    readonly id: string | null
    readonly sourceId: string
    readonly actorId: string
  },
): Promise<string> {
  const fields = {
    source_label: input.sourceLabel,
    source_path: input.sourcePath,
    category_id: input.categoryId,
    is_ignored: input.isIgnored,
    updated_by: input.actorId,
    updated_at: nowIso(),
  }

  if (input.id === null) {
    const payload: CategoryMappingWrite = { source_id: input.sourceId, ...fields }
    const { data, error } = await client
      .from('research_source_category_map')
      .insert(payload as CategoryMappingInsert)
      .select('id')
      .single()
    if (error) throw toRepositoryError(MAPPING, 'create', input.sourceLabel, error)
    return data.id
  }

  const { error } = await client
    .from('research_source_category_map')
    .update(fields)
    .eq('id', input.id)
  if (error) throw toRepositoryError(MAPPING, 'update', input.id, error)
  return input.id
}

export async function deleteCategoryMapping(client: Client, id: string): Promise<void> {
  const { error } = await client.from('research_source_category_map').delete().eq('id', id)
  if (error) throw toRepositoryError(MAPPING, 'delete', id, error)
}

/**
 * The dashboard's "categories nobody has decided about" figure, across every source.
 *
 * IT COUNTS `UNRESOLVED`, WHICH IS TWO DIFFERENT HISTORIES WEARING ONE NAME, and `0240` says they
 * are deliberately counted together: a label observed and never mapped, and a label mapped to a
 * Rivya category somebody has since deleted. Both are a decision waiting to be made, both are
 * closed by typing one mapping, and separating them on the dashboard would offer a distinction
 * nobody acts on differently. `research_source_category_map_unresolved_idx` is the partial index
 * this reads.
 *
 * `head: true` so PostgREST returns the count and no rows — the dashboard renders a number, and
 * fetching every mapping in the project to call `.length` on it is how a tile becomes the slowest
 * thing on a page.
 */
export async function countUnresolvedCategoryMappings(client: Client): Promise<number> {
  const { count, error } = await client
    .from('research_source_category_map')
    .select('id', { count: 'exact', head: true })
    .eq('mapping_state', 'UNRESOLVED')
  if (error) throw toRepositoryError(MAPPING, 'count', 'unresolved', error)
  return count ?? 0
}

/* --- FEAT §26 field 19: schedules --------------------------------------------------------------- */

export async function listSourceSchedules(
  client: Client,
  sourceId: string,
): Promise<SourceScheduleRow[]> {
  const { data, error } = await client
    .from('research_source_schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('source_id', sourceId)
    .order('job_type', { ascending: true })
    .order('cron_expression', { ascending: true })
  if (error) throw toRepositoryError(SCHEDULE, 'list', sourceId, error)
  return (data ?? []) as unknown as SourceScheduleRow[]
}

/**
 * Save a schedule.
 *
 * `next_run_at` IS NOT WRITTEN HERE AND THE OMISSION IS DELIBERATE. Nothing drains this table yet —
 * Phase 25's cron reads `research_jobs`, and `promoteDueJobs` in `lib/scraper/workflows/schedule.ts`
 * is what advances a `next_run_at`. Computing one here would put a wall-clock time in a column no
 * tick consults, which then goes stale the moment the deployment's clock moves on and reads, to
 * anyone opening the row, as a promise about when this source will next be visited. The column
 * exists because FEAT §26 field 19 names it and because `research_source_schedules_due_idx` is
 * already shaped for the promoter that will own it; until that promoter exists, null is the honest
 * value — nobody has scheduled a next run, because nothing yet runs these.
 *
 * The six-hour floor is not checked here either. `research_source_schedules_min_interval` computes
 * it in SQL, `scheduleInputSchema` computes the same number in TypeScript for the form, and
 * `tests/unit/source-schedules.test.ts` holds the two to identical answers on twenty-one
 * expressions. A third copy in this layer would be a third thing to drift.
 */
export async function upsertSourceSchedule(
  client: Client,
  input: ScheduleInput & {
    readonly id: string | null
    readonly sourceId: string
    readonly actorId: string
  },
): Promise<string> {
  const fields = {
    job_type: input.jobType,
    cron_expression: input.cronExpression,
    timezone: input.timezone,
    is_enabled: input.isEnabled,
    updated_by: input.actorId,
    updated_at: nowIso(),
  }

  if (input.id === null) {
    const { data, error } = await client
      .from('research_source_schedules')
      .insert({ source_id: input.sourceId, ...fields })
      .select('id')
      .single()
    if (error) throw toRepositoryError(SCHEDULE, 'create', input.cronExpression, error)
    return data.id
  }

  const { error } = await client.from('research_source_schedules').update(fields).eq('id', input.id)
  if (error) throw toRepositoryError(SCHEDULE, 'update', input.id, error)
  return input.id
}

export async function deleteSourceSchedule(client: Client, id: string): Promise<void> {
  const { error } = await client.from('research_source_schedules').delete().eq('id', id)
  if (error) throw toRepositoryError(SCHEDULE, 'delete', id, error)
}
