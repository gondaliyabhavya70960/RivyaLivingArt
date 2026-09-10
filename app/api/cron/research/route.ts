import { NextResponse } from 'next/server'

import { checkCronAuth } from '@/lib/cms/cron-auth'
import { pruneSearchQueries } from '@/lib/supabase/repositories/search'
import { createAdminClient } from '@/lib/supabase/admin'
import { drainQueue } from '@/lib/scraper/workflows/drain'
import { promoteDueJobs } from '@/lib/scraper/workflows/schedule'
import { pruneSnapshots } from '@/lib/scraper/workflows/prune'

/**
 * The research tick. Vercel calls it every five minutes; `vercel.json` registers it.
 *
 * SIXTY SECONDS, AND THE DRAIN LOOP STOPS AT FIFTY. `maxDuration` is the ceiling the platform
 * enforces; `TICK_BUDGET_MS` is the one the code enforces, ten seconds below it, so the leases are
 * always released inside the invocation that took them. A run that does not finish stays RUNNING
 * and continues on the next tick — work items are the unit of progress, not runs.
 *
 * IT IS A ROUTE HANDLER AND NOT A PAGE, AND NOTHING PUBLIC LINKS TO IT (isolation invariant I3).
 * There is no sitemap entry, no feed and no JSON-LD block that mentions a research table.
 *
 * ORDER MATTERS AND IT IS: PROMOTE, DRAIN, PRUNE. Promoting first means a job that came due thirty
 * seconds ago is worked on THIS tick rather than in five minutes. Pruning last means the tick's
 * politeness budget goes to fetching, and the retention sweep gets whatever is left — a snapshot
 * that lives an extra five minutes past a hundred and eighty days costs nothing, and a fetch
 * skipped because the pruner ran first costs a run.
 *
 * A REFUSED REQUEST GETS 401, NOT 404, and this differs from the phase document deliberately.
 * `app/api/cron/content-schedule` established 401-with-`CRON_SECRET` for this repository, and two
 * cron endpoints answering differently to the same mistake is worse than either answer on its own.
 * A 404 also actively misleads the person most likely to hit this by hand: an operator debugging a
 * missed tick reads "not found" as "wrong path" and goes looking for a routing problem that is not
 * there. The endpoint's existence is not a secret; the secret is the secret.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request): Promise<NextResponse> {
  const auth = checkCronAuth(request, process.env.CRON_SECRET)
  if (auth === 'NOT_CONFIGURED') {
    // NO SECRET, NO ROUTE. Treating "unconfigured" as "no check needed" would turn one forgotten
    // variable into an open endpoint that makes requests to third-party websites.
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  if (auth !== 'OK') {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const admin = createAdminClient()

  const promoted = await promoteDueJobs(admin)
  const drained = await drainQueue(admin)
  const pruned = await pruneSnapshots(admin)

  /*
   * THE SECOND PRUNE IS PHASE 23'S, and it lives here because it is the same shape of work: a
   * retention sweep that nobody should have to remember to run. `search_queries` holds what
   * visitors typed, at ninety days, and a table of search terms that grows forever is a privacy
   * liability accumulating quietly.
   */
  const searchQueriesPruned = await pruneSearchQueries(admin, 90)

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    promoted: promoted.length,
    queued: promoted.reduce((total, run) => total + run.queued, 0),
    fetched: drained.fetched,
    disallowed: drained.disallowed,
    failed: drained.failed,
    discovered: drained.discovered,
    reclaimed: drained.reclaimed,
    runs_finished: drained.runsFinished,
    // WHY THE TICK STOPPED, in the response, because "fetched: 0" has three very different causes
    // and an operator should not have to guess which.
    stopped_by: drained.stoppedBy,
    snapshots_pruned: pruned,
    search_queries_pruned: searchQueriesPruned,
  })
}
