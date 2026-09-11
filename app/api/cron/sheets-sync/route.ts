import { NextResponse } from 'next/server'

import { checkCronAuth } from '@/lib/cms/cron-auth'
import { isEnabled } from '@/lib/flags'
import { runDefinition, type RunSummary } from '@/lib/sheets/run'
import { isDue } from '@/lib/sheets/schedule'
import { createAdminClient } from '@/lib/supabase/admin'
import { listScheduledDefinitions } from '@/lib/supabase/repositories/sheets'

/**
 * The hourly Sheets tick. `vercel.json` registers it at :00 every hour.
 *
 * ONLY SCHEDULED, ENABLED, UNPAUSED DEFINITIONS RUN, and only those whose own cron expression has
 * fired since their last run. MANUAL is the default and is never touched here. With the
 * `google_sheets` flag off the tick answers `skipped: flag_off` and writes nothing — not even a run
 * row — because a flag that is off is a decision, not a failure.
 *
 * `CRON_SECRET`, as every scheduled route since amendment A25.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request): Promise<NextResponse> {
  const auth = checkCronAuth(request, process.env.CRON_SECRET)
  if (auth === 'NOT_CONFIGURED')
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  if (auth !== 'OK') return NextResponse.json({ error: 'unauthorised' }, { status: 401 })

  const ranAt = new Date()
  if (!(await isEnabled('google_sheets'))) {
    return NextResponse.json({ ran_at: ranAt.toISOString(), skipped: 'flag_off' })
  }

  const admin = createAdminClient()
  const candidates = await listScheduledDefinitions(admin)
  const due = candidates.filter((definition) =>
    isDue(
      definition.schedule,
      ranAt,
      definition.last_run_at === null ? null : new Date(definition.last_run_at),
    ),
  )

  const results: RunSummary[] = []
  for (const definition of due) {
    results.push(
      await runDefinition(admin, {
        definitionId: definition.id,
        trigger: 'CRON',
        actor: { userId: null, role: null },
        flagEnabled: true,
      }),
    )
  }

  return NextResponse.json({
    ran_at: ranAt.toISOString(),
    candidates: candidates.length,
    due: due.length,
    results: results.map((result) => ({
      slug: result.slug,
      status: result.status,
      error_code: result.errorCode,
      rows: result.rowCount,
      cells: result.cellCount,
      attempts: result.attempts,
      paused: result.paused,
    })),
  })
}
