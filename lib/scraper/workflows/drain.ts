import 'server-only'

import { isEnabled } from '@/lib/flags'
import type { Database } from '@/lib/supabase/database.types'
import { recordFetch } from '@/lib/supabase/repositories/research/fetches'
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

import {
  countConsecutiveAbortedRuns,
  finishAdapterRun,
  getAdapterRun,
  listAdapterRunsForRun,
  startAdapterRun,
  type AdapterRunStatus,
} from '@/lib/supabase/repositories/research/adapter-runs'

import { getAdapter } from '../adapters/execution'
import { compressSnapshot, fetchPage, snapshotKey } from '../core/fetch'
import { warnScraper } from '../core/log'
import { CONSECUTIVE_ABORTED_RUNS_TO_OPEN_CIRCUIT, SourceFailureTracker } from '../core/run-adapter'
import { extractPage } from './extract'
import { effectiveDelayMs, checkRobots, permitsRequest, type RobotsDecision } from '../core/robots'
import {
  CIRCUIT_OPEN_MINUTES,
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
 *
 * PHASE 27 MOVED EVERYTHING AFTER THE FETCH INTO `./extract.ts`, and the seam is exactly where the
 * responsibilities divide: this file decides WHETHER a request may be made and records what came
 * back; that one decides what the bytes MEAN. The reason to draw it there rather than anywhere else
 * is that the second half must be runnable with no network at all — `scripts/research/reextract.ts`
 * re-runs an adapter over stored snapshots, and it could not if reading a page and interpreting one
 * were the same function.
 *
 * THE ADAPTER RUN AND THE FAILURE TRACKER ARE PER SOURCE, NOT PER ITEM, AND ONE OF THEM SURVIVES
 * THE TICK. `SourceFailureTracker` counts ten consecutive item failures and lives in memory, so it
 * is per invocation; `research_adapter_runs.status = 'ABORTED'` is the row that makes "for the rest
 * of the run" true across the many cron ticks a run is drained over. A tick that finds a source
 * already ABORTED for this run leases nothing for it — which is the difference between a source
 * that stopped and a source that stops again every five minutes.
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
  /** Sources whose adapter failed ten items in a row and stopped for the rest of the run. */
  readonly aborted: number
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
    aborted: 0,
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

    /*
     * THE ADAPTER ROW IS OPENED BEFORE THE FIRST ITEM, NOT AFTER THE FIRST SUCCESS. A source whose
     * adapter fails on every page must still have a panel on the run detail screen, or the one
     * failure mode this accounting exists for is the one it cannot show. `startAdapterRun` upserts,
     * so the second tick of a long run reuses the row and its counters stay cumulative.
     *
     * A DRY RUN OPENS NONE. It fetches, checks robots and stores the snapshot; it derives nothing,
     * so a row claiming an adapter had read something would be a row about work that did not
     * happen.
     */
    const adapter = getAdapter(source.adapter_key)
    const adapterRunId = run.is_dry_run
      ? null
      : await startAdapterRun(admin, {
          runId: run.id,
          sourceId: source.id,
          adapterKey: source.adapter_key,
          // A KEY THAT RESOLVES TO NOTHING IS RECORDED AS SUCH RATHER THAN LEFT BLANK. The column
          // is `not null`, and `extract.ts` marks the row FAILED on the first item — but the row
          // has to exist first, and it has to say which version it did not find.
          adapterVersion: adapter?.version ?? 'unresolved',
        })

    // ALREADY STOPPED FOR THIS RUN. The tracker is in memory and this row is not, so this is what
    // makes "for the rest of the run" survive the tick boundary.
    if (adapterRunId !== null && (await isAbortedForRun(admin, run.id, source.id))) continue

    const tracker = new SourceFailureTracker()

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
        adapterRunId,
        tracker,
      })

      summary.fetched += outcome.fetched
      summary.disallowed += outcome.disallowed
      summary.failed += outcome.failed
      summary.discovered += outcome.discovered

      // TEN CONSECUTIVE FAILURES STOP THIS SOURCE AND NOTHING ELSE. The outer loop moves to the
      // next run, whose source is untouched — which is FEAT §27's whole claim, expressed as a
      // `break` rather than as an exception nobody would catch at the right level.
      if (tracker.aborted) {
        summary.aborted += 1
        break
      }
    }

    if (adapterRunId !== null) {
      await closeAdapterRun(admin, {
        adapterRunId,
        sourceId: source.id,
        sourceSlug: String(source.slug),
        tracker,
      })
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
    /** Null on a dry run, which derives nothing and so has no adapter row to account against. */
    readonly adapterRunId: string | null
    readonly tracker: SourceFailureTracker
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

  /*
   * EVERYTHING FROM HERE IS `extract.ts`'s, AND THE SEAM IS WHERE IT IS FOR A REASON. This function
   * has decided whether a request may be made and recorded what came back; what the bytes MEAN is a
   * separate question, answered by an adapter, and it must be answerable with no network at all —
   * `scripts/research/reextract.ts` re-runs one over stored snapshots, and it could not if the two
   * halves were one function.
   *
   * `adapterRunId` is null only on a dry run, which by then has already returned above.
   */
  if (input.adapterRunId === null) {
    await releaseWorkItem(admin, { id: item.id, state: 'DONE', notBefore: null, error: null })
    return { fetched: 1, disallowed: 0, failed: 0, discovered: 0 }
  }

  const extraction = await extractPage(admin, {
    runId: input.runId,
    source,
    fetchId,
    page: {
      url: outcome.finalUrl,
      body,
      contentHash: hash,
      storageKey,
      httpStatus: outcome.httpStatus,
    },
    adapterRunId: input.adapterRunId,
    tracker: input.tracker,
  })

  /*
   * DISCOVERED LINKS ARE QUEUED ONLY WITHIN THE JOB'S DEPTH. Depth 0 — the default — means a run
   * fetches exactly the seed URLs it was given and follows nothing, which is the right default for
   * a subsystem whose worst failure is fetching more than somebody agreed to. Following links is
   * something an operator turns on per job, knowing the source.
   *
   * AN EXTRACTION FAILURE STILL QUEUES WHAT DISCOVERY FOUND. The two adapter calls are independent:
   * a page whose product fields could not be read is still a page with links on it, and dropping
   * them would make one broken template stop a crawl the rest of the site would have completed.
   */
  let discovered = 0
  if (item.depth < 1 && extraction.discovered.length > 0) {
    discovered = await enqueueWorkItems(admin, {
      runId: input.runId,
      sourceId: source.id,
      urls: extraction.discovered.map((found) => found.url),
      depth: item.depth + 1,
      notBefore: nextSourceFetchAt(delayMs),
    })
  }

  /*
   * THE ITEM IS `DONE` EVEN WHEN EXTRACTION FAILED, AND THAT IS NOT AN OVERSIGHT. A work item is a
   * URL TO FETCH, and it was fetched — the page is on disk, the fetch row is written, and retrying
   * it would ask a third party's server for a document Rivya already has because OUR reading of it
   * was wrong. An adapter failure is accounted on `research_adapter_runs` and repaired by
   * `scripts/research/reextract.ts`, which needs no network at all.
   */
  await releaseWorkItem(admin, { id: item.id, state: 'DONE', notBefore: null, error: null })
  return { fetched: 1, disallowed: 0, failed: 0, discovered }
}

/** Is this source already stopped for this run? The row, because the tracker is per tick. */
async function isAbortedForRun(admin: Client, runId: string, sourceId: string): Promise<boolean> {
  const rows = await listAdapterRunsForRun(admin, runId)
  return rows.some((row) => row.source_id === sourceId && row.status === 'ABORTED')
}

/**
 * Close one source's adapter row for this tick, and open the circuit if it has aborted three runs
 * in a row.
 *
 * THREE ABORTED RUNS IS A SOURCE THAT CANNOT BE READ, NOT A BAD NIGHT. One is a template change,
 * two is a template change nobody has fixed yet; three is Rivya repeatedly asking a third party for
 * pages it cannot use, which is traffic spent for nothing and exactly the thing the politeness
 * posture exists to avoid. The circuit that opens is the same one five consecutive FETCH failures
 * open — the source is left alone until it closes — because from the host's point of view the two
 * are the same behaviour.
 *
 * IT IS NOT FINAL. `finishAdapterRun` writes the status of the row this tick; a later tick of the
 * same run finds it ABORTED and leases nothing, and a NEW run starts a new row. A source recovers
 * by being fixed, not by waiting.
 */
async function closeAdapterRun(
  admin: Client,
  input: {
    readonly adapterRunId: string
    readonly sourceId: string
    readonly sourceSlug: string
    readonly tracker: SourceFailureTracker
  },
): Promise<void> {
  /*
   * THE STATUS COMES FROM THE ROW, NOT FROM THE TRACKER, AND THE DIFFERENCE MATTERS ACROSS TICKS.
   * `SourceFailureTracker` counts CONSECUTIVE failures inside one invocation — which is what
   * decides an abort — but "did anything fail in this run" is a question about the whole run, and a
   * run is drained across many ticks. `items_failed` is cumulative on the row, so a tick that saw
   * nothing fail does not overwrite an earlier tick's PARTIAL with OK.
   */
  const row = await getAdapterRun(admin, input.adapterRunId)
  const status: AdapterRunStatus = input.tracker.aborted
    ? 'ABORTED'
    : (row?.items_failed ?? 0) > 0
      ? 'PARTIAL'
      : 'OK'

  await finishAdapterRun(admin, { id: input.adapterRunId, status, durationMs: null })

  if (status !== 'ABORTED') return

  const consecutive = await countConsecutiveAbortedRuns(admin, input.sourceId)
  if (consecutive < CONSECUTIVE_ABORTED_RUNS_TO_OPEN_CIRCUIT) return

  await recordSourceFetchOutcome(admin, input.sourceId, {
    nextFetchNotBefore: new Date(),
    consecutiveFailures: 0,
    circuitOpenUntil: new Date(Date.now() + CIRCUIT_OPEN_MINUTES * 60_000),
  })

  warnScraper({
    level: 'WARNING',
    event: 'research.adapter_circuit_open',
    message:
      'A source aborted three adapter runs in a row; it is paused until its adapter is fixed.',
    context: { source: input.sourceSlug, aborted: consecutive },
  })
}

function reasonFor(decision: RobotsDecision): string {
  if (decision === 'DISALLOWED') return 'robots.txt disallows this URL.'
  return 'robots.txt could not be read, so this URL was left alone.'
}
