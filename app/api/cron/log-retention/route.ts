import { NextResponse } from 'next/server'

import { checkCronAuth } from '@/lib/cms/cron-auth'
import { logSystem } from '@/lib/logging/system-log'
import { createAdminClient } from '@/lib/supabase/admin'
import { RETENTION_DAYS, purgeSystemLogs } from '@/lib/supabase/repositories/system-logs'

/**
 * The daily log-retention purge — Phase 38. `vercel.json` registers it at 04:15 UTC. INFO and
 * WARNING rows older than 90 days, ERROR and SECURITY rows older than 400, by first occurrence;
 * the purge then logs its own summary at INFO on the SYSTEM channel. `CRON_SECRET`, like every
 * scheduled route (amendment A25). Phase 40 and 41 extend the same tick to `web_vitals_samples`
 * and `rate_limit_buckets` when those tables carry rows.
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

  const now = new Date()
  const outcome = await purgeSystemLogs(createAdminClient(), now)
  await logSystem({
    level: 'INFO',
    channel: 'SYSTEM',
    event: 'logs.retention.purged',
    message: `Retention purge removed ${String(outcome.infoWarning)} INFO/WARNING and ${String(outcome.errorSecurity)} ERROR/SECURITY rows`,
    context: {
      info_warning_removed: outcome.infoWarning,
      error_security_removed: outcome.errorSecurity,
      info_warning_days: RETENTION_DAYS.INFO,
      error_security_days: RETENTION_DAYS.ERROR,
    },
  })

  return NextResponse.json({
    ran_at: now.toISOString(),
    removed: { info_warning: outcome.infoWarning, error_security: outcome.errorSecurity },
    retention_days: { info_warning: RETENTION_DAYS.INFO, error_security: RETENTION_DAYS.ERROR },
  })
}
