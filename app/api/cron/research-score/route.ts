import { NextResponse } from 'next/server'

import { checkCronAuth } from '@/lib/cms/cron-auth'
import { NoActiveModelError, scoreScope } from '@/lib/scraper/workflows/score'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The nightly scoring run. `vercel.json` registers it at 03:15 UTC — after the 02:30 analytics
 * snapshot, so the band inputs a score cites are last night's, not the night before's.
 *
 * NO ACTIVE MODEL IS NOT AN ERROR. Until an owner or admin activates one, the tick answers 200
 * with `skipped: no_active_model`; a cron that 500s every night because a human has not yet made
 * a decision is an alert nobody can act on.
 *
 * `CRON_SECRET`, as every scheduled route since amendment A25.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request): Promise<NextResponse> {
  const auth = checkCronAuth(request, process.env.CRON_SECRET)
  if (auth === 'NOT_CONFIGURED')
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  if (auth !== 'OK') return NextResponse.json({ error: 'unauthorised' }, { status: 401 })

  const admin = createAdminClient()
  try {
    const outcome = await scoreScope(admin, admin, {})
    return NextResponse.json({
      ran_at: outcome.computedAt,
      model_version: outcome.model.version,
      rows: outcome.rows,
      scored: outcome.scored,
      insufficient_data: outcome.insufficient,
      written: outcome.written,
    })
  } catch (error) {
    if (error instanceof NoActiveModelError) {
      return NextResponse.json({ ran_at: new Date().toISOString(), skipped: 'no_active_model' })
    }
    throw error
  }
}
