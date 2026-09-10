import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '../../database.types'
import { parseRow, parseRows, toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research source health'

/**
 * FEAT §26 fields 20 and 21, read from `research_source_health_v`.
 *
 * HEALTH IS DERIVED ON READ AND CANNOT GO STALE. There is no `health` column anywhere and there
 * must not be one. A cached column is wrong for the whole interval between the event and the job
 * that would have updated it, and the moments it is most likely to be wrong are exactly the
 * moments somebody looks at it — during an incident, when a reassuring stale value is believed.
 * The rule is legible in SQL in `0240` rather than buried in a worker nobody opens, and this file
 * only renames its columns.
 *
 * THE VIEW IS `security_invoker = true`, SO THE PHASE 25 POLICIES STILL DECIDE WHO MAY READ IT.
 * That word is load-bearing and it is the reason this reader takes the SESSION client like every
 * other Studio read. Without it the view would run with its owner's privileges, RLS on the nine
 * research tables underneath would be bypassed, and a staff-only subsystem would be readable by
 * anyone PostgREST will speak to. Handing either function a service-role client would defeat that
 * protection from the other side — the view would then read every source in the project regardless
 * of the caller. The type cannot tell the two clients apart, so this is a convention and not a
 * guarantee, and it is written here because it is the only place a reader will look for it: both
 * callers, `/studio/research/sources` and `/studio/research/dashboard`, pass `createClient()`.
 *
 * THE VIEW IS NOT IN `database.types.ts`, AND THAT IS NOT STALENESS — see `viewClient` below.
 */

/**
 * DISABLED · FAILING · DEGRADED · STALE · HEALTHY, in the precedence the view's CASE applies.
 *
 * The order matters and the view's own comment says why: each branch answers a question the ones
 * below it cannot. A disabled source is not failing, it is off. A source whose circuit is open is
 * failing whatever its success rate says. A stale source may have a perfect record and simply not
 * have run. This constant is the TypeScript half of that list; `tests/unit/source-health.test.ts`
 * drives the database into each of the five and reads the view back, so the two cannot drift into
 * a state where Studio renders a value it has no name for.
 */
export const SOURCE_HEALTH_STATES = ['DISABLED', 'FAILING', 'DEGRADED', 'STALE', 'HEALTHY'] as const

export type SourceHealthState = (typeof SOURCE_HEALTH_STATES)[number]

export interface SourceHealth {
  readonly sourceId: string
  /** The newest run of any outcome, by finish, else start, else queue time. Null when none exist. */
  readonly lastRunAt: string | null
  /** The newest run's status, as `research_run_status` spells it. Null when none exist. */
  readonly lastRunStatus: string | null
  /** Successes over runs queued in the last seven days, to three decimals. Null when there were none. */
  readonly successRate7d: number | null
  /** `PENDING` plus `LEASED` work items. Zero, never null — an empty queue is a fact, not a gap. */
  readonly queueDepth: number
  /** The most frequent ENABLED schedule, in minutes. Null when nothing is scheduled. */
  readonly intervalMinutes: number | null
  readonly lastSuccessAt: string | null
  readonly health: SourceHealthState
}

/**
 * The view's columns, named rather than `select('*')`.
 *
 * EXPORTED SO A TEST CAN READ IT BACK AGAINST THE VIEW ITSELF. This is the one failure this
 * module can have that nothing else would catch: a column renamed in a later migration leaves
 * this string naming a column that no longer exists, PostgREST answers `42703`, and the first
 * person to find out is whoever opened `/studio/research/sources` in production.
 * `tests/unit/source-health.test.ts` compares this list with `information_schema.columns` in both
 * directions, so a rename fails a test and an added column is noticed rather than silently unread.
 */
export const SOURCE_HEALTH_COLUMNS =
  'source_id, last_run_at, last_run_status, success_rate_7d, queue_depth, interval_minutes, ' +
  'last_success_at, health'

/**
 * The row as PostgREST returns it, validated rather than asserted.
 *
 * `health` IS THE REASON THIS IS ZOD AND NOT A CAST. The view computes it with a CASE expression,
 * so PostgreSQL types it `text` and the database will happily hand back any string a future edit
 * to that CASE produces. Declaring the union with `as` would mean a sixth state renders as a badge
 * nobody styled and reaches Phase 31's grouping as a category nobody defined; parsing it means the
 * read fails loudly, naming the field, at the boundary where the unexpected value arrived.
 *
 * `success_rate_7d` is `numeric` in the view. PostgREST serialises numeric as a JSON number, which
 * is why this reads it as one — a driver that returned the string '0.800' would fail here rather
 * than reach the Studio as a value that renders but will not compare.
 */
const healthRowSchema = z.object({
  source_id: z.uuid(),
  last_run_at: z.string().nullable(),
  last_run_status: z.string().nullable(),
  success_rate_7d: z.number().nullable(),
  queue_depth: z.number().int(),
  interval_minutes: z.number().int().nullable(),
  last_success_at: z.string().nullable(),
  health: z.enum(SOURCE_HEALTH_STATES),
})

type SourceHealthRow = z.infer<typeof healthRowSchema>

/**
 * The client, retyped so it can see a relation `Database` does not describe.
 *
 * `Database['public']['Views']` IS `{ [_ in never]: never }` AND ALWAYS WILL BE. That is not a
 * stale generated file waiting for `npm run db:types`: `scripts/db/gen-types.mjs` reads
 * `information_schema.columns` joined to `information_schema.tables` filtered to
 * `table_type = 'BASE TABLE'`, and emits the `Views` key as an empty literal. Regenerating produces
 * the same empty block, so waiting for it would be waiting for nothing.
 *
 * The alternatives were both worse. Passing the relation name through `as never` would silence the
 * error and lose the column typing with it, which is the half of the type that has any value here.
 * Widening the generator to emit views is a change to a file this phase does not own and would
 * retype every repository at once — a large, unrelated diff to read one view.
 *
 * So the shape is declared HERE, next to the Zod schema that proves it, and the cast is confined to
 * one function. `healthRowSchema` is the row's single definition: this type is inferred from it, so
 * the two cannot disagree. If the generator ever learns views, delete this and the schema stays.
 */
type HealthDatabase = {
  readonly public: {
    readonly Tables: Database['public']['Tables']
    readonly Views: {
      readonly research_source_health_v: {
        readonly Row: SourceHealthRow
        readonly Relationships: []
      }
    }
    readonly Functions: Database['public']['Functions']
    readonly Enums: Database['public']['Enums']
    readonly CompositeTypes: Database['public']['CompositeTypes']
  }
}

function viewClient(client: Client): SupabaseClient<HealthDatabase> {
  return client as unknown as SupabaseClient<HealthDatabase>
}

function toSourceHealth(row: SourceHealthRow): SourceHealth {
  return {
    sourceId: row.source_id,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    successRate7d: row.success_rate_7d,
    queueDepth: row.queue_depth,
    intervalMinutes: row.interval_minutes,
    lastSuccessAt: row.last_success_at,
    health: row.health,
  }
}

/**
 * Every source's health, in one round trip.
 *
 * ONE QUERY FOR THE WHOLE LIST, NOT ONE PER ROW. `/studio/research/sources` and
 * `/studio/research/dashboard` both read this once and index it by `sourceId`; the view already
 * carries a row per source, including sources that have never run, so a caller never has to decide
 * what a missing row means.
 */
export async function listSourceHealth(client: Client): Promise<SourceHealth[]> {
  const { data, error } = await viewClient(client)
    .from('research_source_health_v')
    .select(SOURCE_HEALTH_COLUMNS)
    .order('source_id', { ascending: true })
  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, healthRowSchema, data ?? []).map(toSourceHealth)
}

/**
 * One source's health, or null.
 *
 * NULL MEANS "THE VIEW HAD NO ROW", WHICH IS NOT THE SAME AS HEALTHY and callers must not conflate
 * them. It happens when the source id does not exist, or when the reader's policies hide the source
 * itself. `HealthPill` renders null as an em dash for exactly that reason: defaulting an unknown to
 * the reassuring value is how a dashboard comes to say everything is fine because it could not find
 * out.
 */
export async function getSourceHealth(
  client: Client,
  sourceId: string,
): Promise<SourceHealth | null> {
  const { data, error } = await viewClient(client)
    .from('research_source_health_v')
    .select(SOURCE_HEALTH_COLUMNS)
    .eq('source_id', sourceId)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get', sourceId, error)
  if (data === null) return null
  return toSourceHealth(parseRow(ENTITY, healthRowSchema, data))
}
