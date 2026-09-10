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

import { nextCronRun, parseCronField } from '../core/cron'

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
 * WHERE THE CRON GRAMMAR WENT, AND WHY IT COULD NOT STAY HERE.
 *
 * `nextCronRun` and `parseCronField` were written in this file and now live in
 * `lib/scraper/core/cron.ts`, re-exported below so every caller and test keeps the import it had.
 * The move is not tidying: this module begins `import 'server-only'`, a module whose whole purpose
 * is to throw when a client bundle reaches it, and Phase 26 needs the same grammar inside the
 * source form's validator, which a Client Component reaches. A parser cannot be both.
 *
 * The new home is pure — no I/O, no ambient clock, no marker — and it carries the six-hour
 * minimum-interval rule beside the grammar it is computed from, mirroring the CHECK in migration
 * `0240` (CANONICAL-DECISIONS.md, amendment A26).
 */
export { nextCronRun, parseCronField }

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
