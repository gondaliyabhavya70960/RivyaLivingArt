import { NextResponse } from 'next/server'

import { runSnapshots } from '@/lib/analytics/snapshot'
import { checkCronAuth } from '@/lib/cms/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAnalyticsReads, createSnapshotWriter } from '@/lib/supabase/repositories/analytics'

/**
 * The daily Studio analytics snapshot — Phase 37. `vercel.json` registers it at 03:45 UTC, after
 * the 02:30 research analytics and the 03:15 opportunity score jobs, so the competitive metrics
 * read tonight's Phase 31/32 rows rather than yesterday's.
 *
 * WRITES ONE ROW PER METRIC FOR TODAY, idempotently, and prunes rows past the 400-day retention.
 * `CRON_SECRET`, like every scheduled route (amendment A25); 401 for a refused request, 503 for an
 * unconfigured deployment, the same shape as `research/route.ts`.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request): Promise<NextResponse> {
  const auth = checkCronAuth(request, process.env.CRON_SECRET)
  if (auth === 'NOT_CONFIGURED') {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  if (auth !== 'OK') {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const admin = createAdminClient()
  const result = await runSnapshots(createAnalyticsReads(admin), createSnapshotWriter(admin))

  return NextResponse.json({
    as_of: result.asOf,
    written: result.written,
    pruned: result.pruned,
    available: result.lines.filter((line) => line.availability === 'AVAILABLE').length,
    unavailable: result.lines
      .filter((line) => line.availability === 'UNAVAILABLE')
      .map((line) => ({ id: line.id, reason: line.reason })),
  })
}
