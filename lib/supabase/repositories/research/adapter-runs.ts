import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research adapter run'

/**
 * `research_adapter_runs` — one row per (run, source, adapter), and the only record that makes
 * FEAT §27's defining constraint checkable.
 *
 * "A BROKEN SOURCE ADAPTER MUST NOT BREAK OTHER SOURCES" IS A CLAIM ABOUT FAILURE, AND A CLAIM
 * ABOUT FAILURE NEEDS A RECORD OR IT CANNOT BE CHECKED. That is `0250`'s argument for the table and
 * it is this file's argument for its shape: what one adapter saw, extracted and failed at, for one
 * source, in one run — never aggregated to the run, because a run-level error count shows a number
 * and hides the thing worth knowing, which is WHICH source stopped and that the others did not.
 *
 * THE COUNTERS ARE CUMULATIVE ACROSS TICKS, AND THAT IS THE WHOLE REASON `startAdapterRun` IS AN
 * UPSERT. A run is drained by `workflows/drain.ts` over as many cron invocations as its queue
 * needs; the second tick calls `startAdapterRun` again for the same (run, source, adapter) and must
 * find the row the first tick made, with its counts intact. A function that inserted, or that
 * upserted the default counters over the top, would reset the accounting every sixty seconds and
 * report a four-hundred-item run as having seen whatever the last tick managed.
 *
 * THE INCREMENTS ARE READ-MODIFY-WRITE, AND THE WINDOW IS STATED RATHER THAN HIDDEN. PostgREST
 * cannot express `items_seen = items_seen + 1`, and the alternative is a SECURITY DEFINER function
 * — a migration, in a phase whose migrations are already written and applied. What a lost update
 * costs is exact: a number on the run detail screen. It cannot cost a version row, because
 * `research_product_versions_unique_content` deduplicates at the row and consults none of these
 * counters, and it cannot cost an abort, because `SourceFailureTracker` in `core/run-adapter.ts`
 * counts consecutive failures in memory for the length of the run rather than reading them back.
 * Two ticks interleaving on one source is also the case the lease in `work-items.ts` exists to make
 * rare.
 *
 * `first_errors` IS BOUNDED AT FIVE AND EVERY ENTRY IS PARSED BEFORE IT IS APPENDED. A source whose
 * adapter is broken fails every item, and four hundred identical messages would make the run detail
 * screen unreadable while telling an operator nothing the first five did not — that is `0250`'s
 * reasoning for the cap, and the count beside it stays exact. The parse is D1: the URL came off a
 * third party's page and the message can carry whatever an adapter interpolated into an exception,
 * and both are on their way into a jsonb column that Studio renders.
 */

export type ResearchAdapterRunRow = Database['public']['Tables']['research_adapter_runs']['Row']

/**
 * The four statuses `research_adapter_runs_status_allowlist` admits, as a union.
 *
 * RESTATED HERE BECAUSE THE COLUMN IS A `text` WITH A CHECK RATHER THAN AN ENUM, so the generated
 * types call it `string` and would let any spelling through to a constraint violation at the write.
 * `0250` is the authority and its own comment defines the four: OK, nothing failed; PARTIAL, some
 * items failed and the source kept going; ABORTED, ten consecutive failures stopped this source for
 * the rest of the run; FAILED, the adapter could not be resolved or started at all.
 */
export type AdapterRunStatus = 'OK' | 'PARTIAL' | 'ABORTED' | 'FAILED'

/** `0250`'s number, named so the workflow and the Studio panel can agree without repeating it. */
export const MAX_FIRST_ERRORS = 5

/**
 * How far back `countConsecutiveAbortedRuns` looks.
 *
 * TEN, FOR A THRESHOLD OF THREE, so the answer is never truncated at the number being tested — a
 * lookback of three would return three for a source that has aborted three times and also for one
 * that has aborted thirty, and the second is worth being able to see. It is bounded at all because
 * this is a read on every abort and a source accumulates a row per run for the life of the project.
 */
const ABORT_LOOKBACK = 10

/** PostgreSQL's unique-violation SQLSTATE. Named because the upsert treats one as a lost race. */
const UNIQUE_VIOLATION = '23505'

const ADAPTER_RUN_COLUMNS =
  'id, run_id, source_id, adapter_key, adapter_version, status, items_seen, items_extracted, ' +
  'items_failed, first_errors, duration_ms, started_at, finished_at'

/**
 * One recorded error, as this boundary will admit it.
 *
 * THE SHAPE IS THE ONE `components/studio/research/AdapterRunPanel.tsx` READS, and the two are held
 * together by that component's tolerance rather than by an import: it renders `{ url, message }`
 * and falls back to the entry's own text for anything else, because what is already stored is
 * history and a reader that refused it would show an operator nothing at all.
 *
 * BOTH FIELDS ARE CAPPED. `core/run-adapter.ts` already truncates a thrown value at 300 characters
 * for the reason it gives — a page body reaches an exception message as easily as it reaches a
 * field — but this is the boundary that holds for every caller, including one that assembled a
 * message itself. The URL cap matches `core/raw.ts`'s and `run-adapter.ts`'s: both bound the same
 * thing, a URL that came off somebody else's markup.
 */
const MAX_ERROR_MESSAGE = 300
const MAX_ERROR_URL = 2048

const adapterErrorSchema = z
  .object({
    url: z.string().trim().max(MAX_ERROR_URL),
    message: z.string().trim().max(MAX_ERROR_MESSAGE),
  })
  .strict()

/**
 * Find or create this run's row for one (source, adapter), without touching what is already there.
 *
 * READ-THEN-INSERT RATHER THAN `.upsert()`, which is `recordProductSighting`'s pattern in
 * `products.ts` and is here for the same reason it is there: an upsert on the natural key would
 * write the DEFAULTS over an existing row — `items_seen` back to zero, `first_errors` back to `[]`,
 * `status` back to `OK` — every time a cron tick resumed a run it had already contributed to. The
 * counters exist to be cumulative; an upsert would make them describe the last sixty seconds.
 *
 * `adapter_version` IS NOT REWRITTEN ON A SECOND TICK, AND THAT IS DELIBERATE RATHER THAN AN
 * OVERSIGHT. If a deployment lands mid-run the second tick may hold a newer adapter, and updating
 * the column would attribute the FIRST tick's items to a version that did not read them — which is
 * precisely the traceability `0250` says the column exists for. The row records the version the
 * accounting started under; the individual rows in `research_product_versions` each carry the
 * version that actually produced them.
 *
 * A CONFLICT HERE IS A LOST RACE, NOT AN ERROR TO SURFACE, exactly as in `recordProductSighting`:
 * two ticks can pass the read at the same moment, the unique constraint makes one insert win, and
 * the loser reads the winner's row. Failing an entire source over a race the constraint already
 * resolved would be the bug.
 */
export async function startAdapterRun(
  admin: Client,
  input: {
    readonly runId: string
    readonly sourceId: string
    readonly adapterKey: string
    readonly adapterVersion: string
  },
): Promise<string> {
  const existing = await findAdapterRun(admin, input)
  if (existing !== null) return existing

  const { data, error } = await admin
    .from('research_adapter_runs')
    .insert({
      run_id: input.runId,
      source_id: input.sourceId,
      adapter_key: input.adapterKey,
      adapter_version: input.adapterVersion,
    })
    .select('id')
    .single()

  if (error === null) return data.id
  if (error.code !== UNIQUE_VIOLATION) {
    throw toRepositoryError(ENTITY, 'start', input.adapterKey, error)
  }

  const raced = await findAdapterRun(admin, input)
  if (raced === null) throw toRepositoryError(ENTITY, 'start', input.adapterKey, error)
  return raced
}

async function findAdapterRun(
  admin: Client,
  input: {
    readonly runId: string
    readonly sourceId: string
    readonly adapterKey: string
  },
): Promise<string | null> {
  const { data, error } = await admin
    .from('research_adapter_runs')
    .select('id')
    .eq('run_id', input.runId)
    .eq('source_id', input.sourceId)
    .eq('adapter_key', input.adapterKey)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'read', input.adapterKey, error)
  return data?.id ?? null
}

/**
 * Account for one item: always seen, sometimes extracted, sometimes failed, occasionally recorded.
 *
 * `extracted` AND `failed` ARE TWO FLAGS RATHER THAN ONE OUTCOME BECAUSE AN ITEM CAN BE NEITHER.
 * An adapter that declares no `EXTRACT` capability is asked for no draft, and an item it saw is one
 * the accounting must still count as seen — `items_seen` is the denominator every other number on
 * the panel is read against, and an item that vanished from it would make a source look like it had
 * been read completely when most of it was skipped. Both flags true is a shape this function does
 * not police; the caller is `workflows/extract.ts`, which derives them from one verdict.
 *
 * AN ERROR IS APPENDED EVEN WHEN THE ITEM DID NOT FAIL, and that is the case worth stating. A
 * `discover()` that throws while `extract()` succeeds is a real fault in an adapter that would
 * otherwise leave no trace anywhere: the item extracted, the counters look healthy, and the source
 * quietly stops finding new URLs. The count of failures stays honest — the item did not fail — and
 * the error still reaches the five an operator reads.
 *
 * `duration_ms` ACCUMULATES rather than being overwritten, so the column answers "how much time did
 * this adapter spend on this source in this run" across every tick that contributed. A column that
 * held the last item's duration would be a number nobody could use and would look like a total.
 */
export async function recordAdapterItem(
  admin: Client,
  input: {
    readonly id: string
    readonly extracted: boolean
    readonly failed: boolean
    readonly durationMs: number
    /** A reason worth showing, or null. Appended only while fewer than five are stored. */
    readonly error: string | null
    readonly url: string
  },
): Promise<void> {
  const { data, error } = await admin
    .from('research_adapter_runs')
    .select('items_seen, items_extracted, items_failed, duration_ms, first_errors')
    .eq('id', input.id)
    .single()
  if (error !== null) throw toRepositoryError(ENTITY, 'read', input.id, error)

  // WHAT IS ALREADY STORED IS HISTORY AND IS NOT RE-VALIDATED. Only the entry being APPENDED is
  // parsed; an existing entry written by an earlier version of this function — or by a phase that
  // has not been written yet — is carried across untouched. A boundary that refused to read back
  // its own history would lose the evidence rather than repair it, which is the argument
  // `adapters/draft-schema.ts` makes about refusing to refine its own invariant.
  const stored: unknown[] = Array.isArray(data.first_errors) ? [...data.first_errors] : []
  if (input.error !== null && stored.length < MAX_FIRST_ERRORS) {
    stored.push(adapterErrorSchema.parse({ url: input.url, message: input.error }))
  }

  const { error: writeError } = await admin
    .from('research_adapter_runs')
    .update({
      items_seen: data.items_seen + 1,
      items_extracted: data.items_extracted + (input.extracted ? 1 : 0),
      items_failed: data.items_failed + (input.failed ? 1 : 0),
      duration_ms: data.duration_ms + Math.max(0, Math.round(input.durationMs)),
      first_errors: stored as never,
    })
    .eq('id', input.id)
  if (writeError !== null) throw toRepositoryError(ENTITY, 'account', input.id, writeError)
}

/**
 * Close the row: a status, a finishing time and — when the caller measured one — a total duration.
 *
 * IT IS NOT CALLED ONCE PER TICK. `finished_at` is written every time this runs, so a caller that
 * closed the row at the end of every cron invocation would leave a timestamp that moves for as long
 * as the run does and means nothing at any point. The three moments that call it are the ones that
 * are actually final for this source: the queue is drained, the source aborted, or the adapter
 * could not be resolved at all.
 *
 * `durationMs` IS NULLABLE SO THE ACCUMULATED VALUE SURVIVES. `recordAdapterItem` adds each item's
 * adapter time as it goes, which is the number a run detail screen wants; passing null here keeps
 * it. A caller with a better total — a wall-clock span covering work this file never saw — may say
 * so, and then that number is the one stored.
 */
export async function finishAdapterRun(
  admin: Client,
  input: {
    readonly id: string
    readonly status: AdapterRunStatus
    readonly durationMs: number | null
  },
): Promise<void> {
  const { error } = await admin
    .from('research_adapter_runs')
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      ...(input.durationMs === null
        ? {}
        : { duration_ms: Math.max(0, Math.round(input.durationMs)) }),
    })
    .eq('id', input.id)
  if (error !== null) throw toRepositoryError(ENTITY, 'finish', input.id, error)
}

/**
 * One adapter row by id.
 *
 * IT EXISTS FOR THE STATUS THE DRAIN LOOP WRITES AT THE END OF A TICK. Whether a source's run is
 * `OK` or `PARTIAL` is a question about the WHOLE run, and a run is drained across many cron ticks
 * — so the in-memory failure tracker, which is per invocation, cannot answer it. `items_failed` on
 * this row is cumulative and can.
 */
export async function getAdapterRun(
  client: Client,
  id: string,
): Promise<ResearchAdapterRunRow | null> {
  const { data, error } = await client
    .from('research_adapter_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as ResearchAdapterRunRow | null
}

/**
 * Every adapter panel for one run, in the order the run started them.
 *
 * OLDEST FIRST, WHICH IS THE OPPOSITE OF EVERY OTHER LIST IN THIS SUBSYSTEM AND IS RIGHT HERE. The
 * fetch log and the version list are newest-first because they are feeds — a reader wants the last
 * thing that happened. This is not a feed: it is a fixed, small set of panels, one per source the
 * run touched, and the order somebody reads them in should be the order the run worked through
 * them. `adapter_key` breaks a tie so two panels never swap places between two renders.
 */
export async function listAdapterRunsForRun(
  client: Client,
  runId: string,
): Promise<ResearchAdapterRunRow[]> {
  const { data, error } = await client
    .from('research_adapter_runs')
    .select(ADAPTER_RUN_COLUMNS)
    .eq('run_id', runId)
    .order('started_at', { ascending: true })
    .order('adapter_key', { ascending: true })
  if (error !== null) throw toRepositoryError(ENTITY, 'list', runId, error)
  return (data ?? []) as unknown as ResearchAdapterRunRow[]
}

/**
 * How many of this source's most recent adapter runs aborted, counting back from the latest.
 *
 * THE LEADING RUN, NOT A TOTAL, AND THE DIFFERENCE IS THE WHOLE MEASUREMENT. Three consecutive
 * `ABORTED` runs open the source's circuit; a source that aborted three times last spring and has
 * run cleanly every night since has not tripped anything, and a `.eq('status', 'ABORTED')` count —
 * which is the obvious way to write this and the wrong one — would open its circuit for ever. It is
 * `SourceFailureTracker`'s rule one layer further out, with the same argument behind it:
 * consecutive means consecutive, and a cumulative counter eventually fires for every source that
 * has been running long enough.
 *
 * A RUN STILL IN FLIGHT COUNTS AS WHATEVER ITS STATUS SAYS, which is `OK` until something changes
 * it. That stops the count rather than being skipped, and the direction is deliberate: a source
 * that is currently running is a source whose circuit nobody should be opening on the strength of
 * older evidence.
 *
 * The index this reads is `research_adapter_runs_by_source_idx`, declared in `0250` for this query.
 */
export async function countConsecutiveAbortedRuns(
  client: Client,
  sourceId: string,
): Promise<number> {
  const { data, error } = await client
    .from('research_adapter_runs')
    .select('status')
    .eq('source_id', sourceId)
    .order('started_at', { ascending: false })
    .limit(ABORT_LOOKBACK)
  if (error !== null) throw toRepositoryError(ENTITY, 'count', sourceId, error)

  let aborted = 0
  for (const row of data ?? []) {
    if (row.status !== 'ABORTED') break
    aborted += 1
  }
  return aborted
}
