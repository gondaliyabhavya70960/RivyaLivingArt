import 'server-only'

import { isEnabled } from '@/lib/flags'
import type { Database } from '@/lib/supabase/database.types'
import { recordFetch } from '@/lib/supabase/repositories/research/fetches'
import { recordProductSighting } from '@/lib/supabase/repositories/research/products'
import { recordRawItem } from '@/lib/supabase/repositories/research/raw-items'
import {
  finishResearchRun,
  listActiveRuns,
  markRunRunning,
  readRunStatus,
  updateRunStats,
} from '@/lib/supabase/repositories/research/runs'
import { storeSnapshot } from '@/lib/supabase/repositories/research/snapshots'
import {
  getResearchSource,
  recordSourceFetchOutcome,
} from '@/lib/supabase/repositories/research/sources'
import {
  countWorkItemsByState,
  enqueueWorkItems,
  leaseWorkItems,
  reclaimExpiredLeases,
  releaseWorkItem,
} from '@/lib/supabase/repositories/research/work-items'
import type { SupabaseClient } from '@supabase/supabase-js'

import { compressSnapshot, fetchPage, snapshotKey } from '../core/fetch'
import { warnScraper } from '../core/log'
import { effectiveDelayMs, checkRobots, permitsRequest, type RobotsDecision } from '../core/robots'
import { readRawItem } from '../core/raw'
import {
  failureStateAfter,
  isBackoffStatus,
  leaseBudget,
  MAX_ATTEMPTS,
  nextAttemptAt,
  nextSourceFetchAt,
  retryAfterMs,
} from '../core/rate-limit'

/**
 * One cron tick's worth of work.
 *
 * THE BUDGET IS WALL CLOCK AND IT IS CHECKED BETWEEN ITEMS, NOT ESTIMATED. Vercel gives this
 * function sixty seconds; it stops at fifty and leaves the rest of the queue for the next tick,
 * with every lease released. Trying to predict how many items fit — "four seconds each, so twelve"
 * — is how a slow host turns into a killed invocation holding twelve leases that then have to time
 * out. Measuring is cheap and exact.
 *
 * THE KILL SWITCH IS CHECKED BEFORE EVERY FETCH, NOT ONCE PER TICK. FEAT §32's `research.enabled`
 * is what an owner reaches for when something is going wrong, and a switch that takes effect at
 * the end of the current batch is a switch that keeps fetching for another minute after they threw
 * it. Once per item is the resolution that makes "stop" mean stop.
 *
 * NOTHING IN THIS FILE WRITES TO A PUBLIC TABLE, and nothing ever may (isolation invariant I4).
 * The guard script proves it by walking the imports.
 */

type Client = SupabaseClient<Database>

/** Ten seconds short of Vercel's sixty, so the release always happens inside the invocation. */
export const TICK_BUDGET_MS = 50_000

/** How long a claim is held. Long enough for a slow fetch, short enough to reclaim quickly. */
export const LEASE_SECONDS = 120

export interface DrainSummary {
  readonly reclaimed: number
  readonly fetched: number
  readonly disallowed: number
  readonly failed: number
  readonly discovered: number
  readonly runsFinished: number
  readonly stoppedBy: 'BUDGET' | 'QUEUE_EMPTY' | 'KILL_SWITCH'
}

/**
 * Drain as much of the queue as fits in this tick.
 *
 * IT TAKES THE RUNS AND NOT THE SOURCES as its outer loop, because a run is what an operator
 * started and what they are watching. Leasing is per source, which is where the politeness limits
 * live, and the two are reconciled by leasing for the run's source with that source's budget.
 */
export async function drainQueue(admin: Client): Promise<DrainSummary> {
  const startedAt = Date.now()
  const summary = {
    reclaimed: 0,
    fetched: 0,
    disallowed: 0,
    failed: 0,
    discovered: 0,
    runsFinished: 0,
    stoppedBy: 'QUEUE_EMPTY' as DrainSummary['stoppedBy'],
  }

  if (!(await isEnabled('research_enabled'))) {
    // A WARNING RATHER THAN SILENCE. A cron that quietly does nothing for a week because a flag is
    // off is indistinguishable from a cron that is broken, and the difference is the first thing
    // anybody would want to know.
    warnScraper({
      level: 'WARNING',
      event: 'research.disabled',
      message: 'The research kill switch is off, so no source was fetched on this tick.',
    })
    return { ...summary, stoppedBy: 'KILL_SWITCH' }
  }

  summary.reclaimed = await reclaimExpiredLeases(admin)

  const runs = await listActiveRuns(admin)

  for (const run of runs) {
    if (Date.now() - startedAt > TICK_BUDGET_MS) {
      summary.stoppedBy = 'BUDGET'
      break
    }

    const source = await getResearchSource(admin, run.source_id)
    if (source === null) continue

    if (run.status === 'QUEUED') await markRunRunning(admin, run.id)

    const budget = leaseBudget(source.concurrency, source.in_flight_count)
    if (budget === 0) continue

    const items = await leaseWorkItems(admin, {
      sourceId: source.id,
      limit: budget,
      leaseSeconds: LEASE_SECONDS,
    })

    for (const item of items) {
      if (Date.now() - startedAt > TICK_BUDGET_MS) {
        // Hand the item straight back. A released item is fetched on the next tick; an item left
        // LEASED waits out its two minutes first.
        await releaseWorkItem(admin, {
          id: item.id,
          state: 'PENDING',
          notBefore: new Date(),
          error: null,
        })
        summary.stoppedBy = 'BUDGET'
        break
      }

      // BETWEEN EVERY ITEM: has this run been cancelled, and is the master switch still on? Both
      // are one small read against the effect of getting them wrong.
      const status = await readRunStatus(admin, run.id)
      if (status === 'CANCELLED') {
        await releaseWorkItem(admin, {
          id: item.id,
          state: 'SKIPPED',
          notBefore: null,
          error: null,
        })
        break
      }
      if (!(await isEnabled('research_enabled'))) {
        await releaseWorkItem(admin, {
          id: item.id,
          state: 'PENDING',
          notBefore: new Date(),
          error: null,
        })
        summary.stoppedBy = 'KILL_SWITCH'
        break
      }

      const outcome = await handleItem(admin, {
        runId: run.id,
        source,
        item,
        isDryRun: run.is_dry_run,
      })

      summary.fetched += outcome.fetched
      summary.disallowed += outcome.disallowed
      summary.failed += outcome.failed
      summary.discovered += outcome.discovered
    }

    const counts = await countWorkItemsByState(admin, run.id)
    await updateRunStats(admin, run.id, counts)

    const outstanding = (counts['PENDING'] ?? 0) + (counts['LEASED'] ?? 0)
    if (outstanding === 0) {
      const failed = counts['FAILED'] ?? 0
      await finishResearchRun(admin, run.id, {
        status: failed > 0 ? 'PARTIAL' : 'SUCCEEDED',
        stats: counts,
        errorSummary: failed > 0 ? `${failed} item(s) could not be fetched.` : null,
      })
      summary.runsFinished += 1
    }
  }

  return summary
}

interface ItemOutcome {
  readonly fetched: number
  readonly disallowed: number
  readonly failed: number
  readonly discovered: number
}

/**
 * One URL, end to end: ask robots, fetch or refuse, record, queue what was found.
 *
 * THE ROBOTS CHECK COMES BEFORE THE REQUEST AND ITS REFUSAL IS RECORDED. That ordering is the
 * whole claim this subsystem makes about itself, and `research_fetches`' own constraint enforces
 * the evidence: a DISALLOWED row carrying an HTTP status, a hash or a storage key cannot be
 * stored, so a row saying "we did not fetch this" cannot also say what came back.
 */
async function handleItem(
  admin: Client,
  input: {
    readonly runId: string
    readonly source: Database['public']['Tables']['research_sources']['Row']
    readonly item: Database['public']['Tables']['research_work_items']['Row']
    readonly isDryRun: boolean
  },
): Promise<ItemOutcome> {
  const { source, item } = input
  const verdict = await checkRobots(admin, item.url)

  if (!permitsRequest(verdict.decision)) {
    await recordFetch(admin, {
      runId: input.runId,
      sourceId: source.id,
      workItemId: item.id,
      url: item.url,
      finalUrl: null,
      httpStatus: null,
      robotsDecision: verdict.decision,
      contentHash: null,
      bytes: null,
      durationMs: null,
      storageKey: null,
      error: verdict.decision === 'DISALLOWED' ? 'robots.txt disallows this URL.' : null,
    })
    await releaseWorkItem(admin, {
      id: item.id,
      state: 'SKIPPED',
      notBefore: null,
      error: reasonFor(verdict.decision),
    })
    return { fetched: 0, disallowed: 1, failed: 0, discovered: 0 }
  }

  // THE HOST'S CRAWL-DELAY, AS A FLOOR. Applied to the SOURCE's next-fetch clock below, so it
  // paces every subsequent URL on this host and not only this one.
  const delayMs = effectiveDelayMs(source.request_delay_ms, verdict.crawlDelaySeconds)

  const outcome = await fetchPage(item.url)
  const succeeded = outcome.body !== null

  const failure = failureStateAfter({
    succeeded,
    consecutiveFailures: source.consecutive_failures,
  })
  await recordSourceFetchOutcome(admin, source.id, {
    nextFetchNotBefore: nextSourceFetchAt(delayMs),
    consecutiveFailures: failure.consecutiveFailures,
    circuitOpenUntil: failure.circuitOpenUntil,
  })

  if (failure.circuitOpenUntil !== null) {
    warnScraper({
      level: 'WARNING',
      event: 'research.circuit_open',
      message: 'A source failed five times in a row; its runs are paused.',
      context: { source: String(source.slug) },
    })
  }

  if (!succeeded) {
    const backoff = isBackoffStatus(outcome.httpStatus ?? 0)
      ? retryAfterMs(outcome.retryAfter)
      : null
    const exhausted = item.attempts >= MAX_ATTEMPTS

    await recordFetch(admin, {
      runId: input.runId,
      sourceId: source.id,
      workItemId: item.id,
      url: item.url,
      finalUrl: outcome.finalUrl,
      httpStatus: outcome.httpStatus,
      robotsDecision: verdict.decision,
      contentHash: null,
      bytes: outcome.bytes,
      durationMs: outcome.durationMs,
      storageKey: null,
      error: outcome.error,
    })

    await releaseWorkItem(admin, {
      id: item.id,
      state: exhausted ? 'FAILED' : 'PENDING',
      notBefore: exhausted
        ? null
        : nextAttemptAt({ attempt: item.attempts, retryAfterMs: backoff }),
      error: outcome.error ?? 'The request failed.',
    })
    return { fetched: 0, disallowed: 0, failed: 1, discovered: 0 }
  }

  const body = outcome.body as string
  const hash = outcome.contentHash

  /*
   * A DRY RUN FETCHES AND RECORDS AND STORES NOTHING DERIVED. It proves the source is reachable,
   * that robots permits the URL and that the politeness settings behave — which is what an
   * operator is checking before they let a job loose — without creating research_products rows
   * somebody then has to triage.
   */
  let storageKey: string | null = null
  if (!input.isDryRun && hash !== null) {
    storageKey = await storeSnapshot(admin, {
      key: snapshotKey(String(source.slug), hash),
      body: compressSnapshot(body),
    })
  }

  const fetchId = await recordFetch(admin, {
    runId: input.runId,
    sourceId: source.id,
    workItemId: item.id,
    url: item.url,
    finalUrl: outcome.finalUrl,
    httpStatus: outcome.httpStatus,
    robotsDecision: verdict.decision,
    contentHash: hash,
    bytes: outcome.bytes,
    durationMs: outcome.durationMs,
    storageKey,
    error: null,
  })

  if (input.isDryRun) {
    await releaseWorkItem(admin, { id: item.id, state: 'DONE', notBefore: null, error: null })
    return { fetched: 1, disallowed: 0, failed: 0, discovered: 0 }
  }

  const raw = readRawItem(body, outcome.finalUrl)

  await recordRawItem(admin, {
    runId: input.runId,
    sourceId: source.id,
    fetchId,
    sourceUrl: outcome.finalUrl,
    sourceExternalId: null,
    raw,
    contentHash: hash,
    adapterKey: source.adapter_key,
    adapterVersion: null,
  })

  await recordProductSighting(admin, {
    sourceId: source.id,
    sourceUrl: raw.canonicalUrl ?? outcome.finalUrl,
    sourceExternalId: null,
    runId: input.runId,
  })

  /*
   * DISCOVERED LINKS ARE QUEUED ONLY WITHIN THE JOB'S DEPTH. Depth 0 — the default — means a run
   * fetches exactly the seed URLs it was given and follows nothing, which is the right default for
   * a subsystem whose worst failure is fetching more than somebody agreed to. Following links is
   * something an operator turns on per job, knowing the source.
   */
  let discovered = 0
  if (item.depth < 1) {
    discovered = await enqueueWorkItems(admin, {
      runId: input.runId,
      sourceId: source.id,
      urls: raw.links,
      depth: item.depth + 1,
      notBefore: nextSourceFetchAt(delayMs),
    })
  }

  await releaseWorkItem(admin, { id: item.id, state: 'DONE', notBefore: null, error: null })
  return { fetched: 1, disallowed: 0, failed: 0, discovered }
}

function reasonFor(decision: RobotsDecision): string {
  if (decision === 'DISALLOWED') return 'robots.txt disallows this URL.'
  return 'robots.txt could not be read, so this URL was left alone.'
}
