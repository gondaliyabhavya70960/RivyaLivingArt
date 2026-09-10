import 'server-only'

import type { Database } from '@/lib/supabase/database.types'
import { recordFetch } from '@/lib/supabase/repositories/research/fetches'
import { storeSnapshot } from '@/lib/supabase/repositories/research/snapshots'
import {
  getResearchSource,
  recordSourceFetchOutcome,
} from '@/lib/supabase/repositories/research/sources'
import type { SupabaseClient } from '@supabase/supabase-js'

import { compressSnapshot, fetchPage, snapshotKey } from '../core/fetch'
import { effectiveDelayMs, checkRobots, permitsRequest } from '../core/robots'
import { failureStateAfter, nextSourceFetchAt } from '../core/rate-limit'

/**
 * One URL, fetched on purpose, by somebody who pressed a button.
 *
 * WHY THIS IS NOT `fetch()` IN A SERVER ACTION, which is what it would have been if written where
 * it is used. Every politeness rule in this subsystem lives on the path the drain loop takes:
 * robots.txt is consulted from the shared cache, the source's delay is advanced so the next
 * request — scheduled or manual — waits for it, a `research_fetches` row is written whatever
 * happened, and a failure moves the circuit breaker. A second route to the network is a second
 * place for all of that to be missing, and the one most likely to be reached in a hurry.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It creates no run, leases no work item and extracts nothing.
 * A probe answers one question — "what does this URL actually return, and are we allowed to ask" —
 * and the answer is a fetch row an operator can read on the runs surface. Making it create a run
 * would put a one-page run in a list whose whole purpose is to show scheduled work.
 *
 * THE REFUSAL IS THE INTERESTING OUTCOME. A `DISALLOWED` verdict returns before any packet leaves,
 * and the row it writes carries no status, no hash and no snapshot — which
 * `research_fetches_disallowed_has_no_response` makes unstorable otherwise. That row is the
 * evidence that the rules were honoured, and it is why the refusal is recorded rather than simply
 * returned.
 */

type Client = SupabaseClient<Database>

export interface ProbeOutcome {
  readonly robotsDecision: 'ALLOWED' | 'DISALLOWED' | 'NO_ROBOTS' | 'ERROR'
  readonly httpStatus: number | null
  readonly bytes: number
  readonly durationMs: number
  readonly fetchId: string
  readonly error: string | null
}

export async function probeOneUrl(
  admin: Client,
  input: { readonly sourceId: string; readonly url: string },
): Promise<ProbeOutcome> {
  const source = await getResearchSource(admin, input.sourceId)
  if (source === null) throw new Error('That source no longer exists.')

  const verdict = await checkRobots(admin, input.url)

  if (!permitsRequest(verdict.decision)) {
    const fetchId = await recordFetch(admin, {
      runId: null,
      sourceId: input.sourceId,
      workItemId: null,
      url: input.url,
      finalUrl: null,
      httpStatus: null,
      robotsDecision: verdict.decision,
      contentHash: null,
      bytes: null,
      durationMs: 0,
      storageKey: null,
      error: verdict.decision === 'DISALLOWED' ? 'refused by robots.txt' : 'robots.txt unreadable',
    })
    return {
      robotsDecision: verdict.decision,
      httpStatus: null,
      bytes: 0,
      durationMs: 0,
      fetchId,
      error: 'no request was made',
    }
  }

  const outcome = await fetchPage(input.url)

  // THE SNAPSHOT IS KEPT, exactly as a scheduled fetch's would be. A probe whose page was not
  // retained would be a request made to somebody else's server for evidence that was then thrown
  // away, which is the one outcome that has all the cost and none of the value.
  let storageKey: string | null = null
  if (outcome.body !== null && outcome.contentHash !== null) {
    storageKey = await storeSnapshot(admin, {
      key: snapshotKey(source.slug, outcome.contentHash),
      body: compressSnapshot(outcome.body),
    })
  }

  const fetchId = await recordFetch(admin, {
    runId: null,
    sourceId: input.sourceId,
    workItemId: null,
    url: input.url,
    finalUrl: outcome.finalUrl,
    httpStatus: outcome.httpStatus,
    robotsDecision: verdict.decision,
    contentHash: outcome.contentHash,
    bytes: outcome.bytes,
    durationMs: outcome.durationMs,
    storageKey,
    error: outcome.error,
  })

  /*
   * THE DELAY IS ADVANCED AND THE CIRCUIT IS MOVED, which is the half of this that a hand-rolled
   * probe would have skipped. A person pressing this button twice in a second must be spaced by the
   * source's own delay exactly as two queued items would be — the host cannot tell the difference,
   * and it is the host the rule is for. A failure counts towards the same five that open the
   * circuit, for the same reason.
   */
  const succeeded = outcome.error === null && (outcome.httpStatus ?? 0) < 400
  const failure = failureStateAfter({
    succeeded,
    consecutiveFailures: source.consecutive_failures,
  })
  await recordSourceFetchOutcome(admin, source.id, {
    nextFetchNotBefore: nextSourceFetchAt(
      effectiveDelayMs(source.request_delay_ms, verdict.crawlDelaySeconds),
    ),
    consecutiveFailures: failure.consecutiveFailures,
    circuitOpenUntil: failure.circuitOpenUntil,
  })

  return {
    robotsDecision: verdict.decision,
    httpStatus: outcome.httpStatus,
    bytes: outcome.bytes,
    durationMs: outcome.durationMs,
    fetchId,
    error: outcome.error,
  }
}
