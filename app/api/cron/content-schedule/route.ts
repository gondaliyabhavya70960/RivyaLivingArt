import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { checkCronAuth } from '@/lib/cms/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { runContentSchedule } from '@/lib/supabase/repositories/cms'

/**
 * The scheduled publish/unpublish sweep, invoked by Vercel Cron.
 *
 * THE VARIABLE MUST BE NAMED EXACTLY `CRON_SECRET`. Vercel attaches
 * `Authorization: Bearer <value>` to a cron invocation only for that one name — call it
 * `CRON_TOKEN` and the header simply never arrives, the route 401s on every tick, and nothing
 * anywhere reports an error. It is in `.env.example` under that name for this reason.
 *
 * NO SECRET, NO ROUTE. A missing `CRON_SECRET` returns 503 rather than running unauthenticated.
 * The alternative — treating "no secret configured" as "no check required" — turns a
 * misconfiguration into an open endpoint that publishes content, which is the worst possible
 * failure mode for a deploy that forgot one variable.
 *
 * THE ROUTE IS DYNAMIC AND UNCACHED, necessarily: it has side effects, and a cached cron endpoint
 * would run once and then serve its old summary on every subsequent tick while doing nothing.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<NextResponse> {
  const auth = checkCronAuth(request, process.env.CRON_SECRET)
  if (auth === 'NOT_CONFIGURED') {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  if (auth !== 'OK') {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const result = await runContentSchedule(createAdminClient())

  /**
   * REVALIDATION HAPPENS AFTER THE WRITE, NEVER BEFORE, and only for paths the sweep actually
   * changed. The function returns them already deduped: two sections published on one page are
   * one revalidation, not two. Revalidating optimistically — before the transaction commits, or
   * for every due row whether or not it succeeded — caches the pre-publish page and the content
   * stays invisible until the next tick.
   */
  for (const path of result.paths) {
    revalidatePath(path)
  }

  /**
   * The response is a summary, not a payload anyone renders. It is what a person reads in the
   * Vercel cron log when asking "did the 09:00 publish happen, and if not, why not" — so the
   * refusals are in it explicitly rather than being inferable from a count.
   */
  return NextResponse.json({
    ran_at: result.ran_at,
    published: result.published.length,
    failed: result.failed.length,
    revalidated: result.paths,
    refusals: result.failed.map((failure) => ({
      section_id: failure.section_id,
      target: failure.target,
      attempts: failure.attempts,
      state: failure.state,
      error: failure.error,
    })),
  })
}
