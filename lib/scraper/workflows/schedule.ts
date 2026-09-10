import 'server-only'

import { z } from 'zod'

import type { Database } from '@/lib/supabase/database.types'
import {
  listDueJobs,
  setJobNextRunAt,
  type ResearchJobRow,
} from '@/lib/supabase/repositories/research/jobs'
import { createResearchRun, hasActiveRunForJob } from '@/lib/supabase/repositories/research/runs'
import { enqueueWorkItems } from '@/lib/supabase/repositories/research/work-items'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Turning due jobs into runs, and runs into a queue of URLs.
 *
 * THE OVERLAP RULE IS THE ONE THAT MATTERS. A job whose previous run is still QUEUED or RUNNING
 * does not get a second one. Without it, a five-minute cron against a job that takes twenty
 * minutes would start four concurrent runs of the same work by the end of the first — four times
 * the traffic at a host whose delay was configured for one, which is the politeness posture
 * defeated not by a bug in the delay but by arithmetic nobody did.
 *
 * THE SCHEDULE IS ADVANCED BEFORE THE RUN IS CREATED, deliberately. If run creation then fails,
 * the job has skipped one tick — a missed run. The other order risks a job whose `next_run_at`
 * never moves because creation succeeded and the update did not, which is a job that starts a run
 * every five minutes forever. A missed run is recoverable by waiting; a runaway one is recoverable
 * only by somebody noticing.
 */

type Client = SupabaseClient<Database>

/**
 * What a job's `scope` may contain, at this phase.
 *
 * DELIBERATELY NARROW. Phase 26 supplies URL patterns and category mappings; until then a scope is
 * a list of seed URLs and an optional depth. `.strict()` means a scope carrying a Phase 26 field
 * early fails here rather than being silently ignored — the same commitment device as
 * `rawItemSchema`, applied to configuration instead of to extraction.
 */
export const jobScopeSchema = z
  .object({
    seedUrls: z.array(z.string().url()).max(100).default([]),
    maxDepth: z.number().int().min(0).max(3).default(0),
  })
  .strict()

export type JobScope = z.infer<typeof jobScopeSchema>

/**
 * Read a job's scope, tolerating a stored value that does not parse.
 *
 * A JOB WITH AN UNREADABLE SCOPE PRODUCES NO SEED URLS RATHER THAN AN EXCEPTION. It is one job in
 * a tick that promotes many, and throwing here would stop every other job from being scheduled
 * because one row was edited badly. The empty scope makes the run visibly do nothing, which is the
 * legible failure.
 */
export function readJobScope(scope: unknown): JobScope {
  const parsed = jobScopeSchema.safeParse(scope)
  return parsed.success ? parsed.data : { seedUrls: [], maxDepth: 0 }
}

/**
 * The next time a five-field cron expression fires after `from`.
 *
 * A MINUTE-BY-MINUTE SEARCH, BOUNDED AT ~370 DAYS, and not a cron library. The expression is
 * `minute hour day-of-month month day-of-week` with `*`, lists, ranges and steps — which is what
 * an operator types and all this needs to read. A dependency for it would be a dependency parsing
 * a string a person edits in a form, and this is fifty lines that a test can enumerate exhaustively.
 * The bound means a nonsensical-but-parseable expression (February 30th) returns null rather than
 * looping, and a null `next_run_at` is a job that never fires — visible in the Studio as "no next
 * run" rather than as a hung request.
 */
export function nextCronRun(expression: string, from: Date): Date | null {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return null

  const minutes = parseCronField(fields[0]!, 0, 59)
  const hours = parseCronField(fields[1]!, 0, 23)
  const days = parseCronField(fields[2]!, 1, 31)
  const months = parseCronField(fields[3]!, 1, 12)
  const weekdays = parseCronField(fields[4]!, 0, 6)
  if (!minutes || !hours || !days || !months || !weekdays) return null

  // Start at the next whole minute: a cron that fires "now" has already fired.
  const cursor = new Date(from.getTime())
  cursor.setUTCSeconds(0, 0)
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1)

  const limit = 370 * 24 * 60
  for (let step = 0; step < limit; step += 1) {
    if (
      minutes.has(cursor.getUTCMinutes()) &&
      hours.has(cursor.getUTCHours()) &&
      months.has(cursor.getUTCMonth() + 1) &&
      // CRON'S ODD RULE, AND IT IS THE STANDARD ONE: when both day-of-month and day-of-week are
      // restricted, a match on EITHER fires. Treating it as an AND makes `0 0 1 * 1` mean "the
      // first of the month, if it is a Monday" instead of "the first of the month, and every
      // Monday" — which is a schedule that fires roughly one seventh as often as intended.
      matchesDay(cursor, fields[2]!, fields[4]!, days, weekdays)
    ) {
      return cursor
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1)
  }
  return null
}

function matchesDay(
  at: Date,
  dayField: string,
  weekdayField: string,
  days: Set<number>,
  weekdays: Set<number>,
): boolean {
  const dayRestricted = dayField !== '*'
  const weekdayRestricted = weekdayField !== '*'
  const dayMatch = days.has(at.getUTCDate())
  const weekdayMatch = weekdays.has(at.getUTCDay())

  if (dayRestricted && weekdayRestricted) return dayMatch || weekdayMatch
  if (dayRestricted) return dayMatch
  if (weekdayRestricted) return weekdayMatch
  return true
}

// `*`, `5`, `1-5`, a star with a `/15` step, `1,3,5`, `1-10/2`. Null for anything else.
// (Written as a line comment because a step expression contains the sequence that would end a
// block comment — which is exactly the kind of thing a cron parser has to be careful about.)
export function parseCronField(field: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>()

  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/')
    if (rangePart === undefined) return null

    const step = stepPart === undefined ? 1 : Number(stepPart)
    if (!Number.isInteger(step) || step < 1) return null

    let start: number
    let end: number
    if (rangePart === '*') {
      start = min
      end = max
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-')
      start = Number(a)
      end = Number(b)
    } else {
      start = Number(rangePart)
      end = start
    }

    if (!Number.isInteger(start) || !Number.isInteger(end)) return null
    if (start < min || end > max || start > end) return null

    for (let value = start; value <= end; value += step) values.add(value)
  }

  return values.size === 0 ? null : values
}

export interface PromotedRun {
  readonly jobId: string
  readonly runId: string
  readonly sourceId: string
  readonly queued: number
}

/**
 * Promote every due job into a run with its seed URLs queued.
 *
 * A JOB WITH NO SEED URLS STILL GETS A RUN, and the run is finished by the drain loop on the same
 * tick with a queue depth of zero. That is better than skipping it silently: an operator who
 * configured a job wrongly sees a run that fetched nothing, which is a question they can act on,
 * rather than nothing at all, which looks like the scheduler being broken.
 */
export async function promoteDueJobs(admin: Client): Promise<PromotedRun[]> {
  const due = await listDueJobs(admin)
  const promoted: PromotedRun[] = []

  for (const job of due) {
    if (await hasActiveRunForJob(admin, job.id)) {
      // The previous run is still going. Move the schedule on so this job is not re-examined every
      // tick, and leave the running one alone.
      await setJobNextRunAt(admin, job.id, advance(job))
      continue
    }

    await setJobNextRunAt(admin, job.id, advance(job))

    const runId = await createResearchRun(admin, {
      jobId: job.id,
      sourceId: job.source_id,
      trigger: 'SCHEDULED',
      requestedBy: null,
      isDryRun: false,
    })

    const scope = readJobScope(job.scope)
    const queued = await enqueueWorkItems(admin, {
      runId,
      sourceId: job.source_id,
      urls: scope.seedUrls.slice(0, job.max_urls ?? scope.seedUrls.length),
      depth: 0,
      notBefore: new Date(),
    })

    promoted.push({ jobId: job.id, runId, sourceId: job.source_id, queued })
  }

  return promoted
}

function advance(job: ResearchJobRow): Date | null {
  if (job.cron_expression === null) return null
  return nextCronRun(job.cron_expression, new Date())
}
