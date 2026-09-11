import { NextResponse } from 'next/server'

import { checkCronAuth } from '@/lib/cms/cron-auth'
import { logSystem } from '@/lib/logging/system-log'
import { createAdminClient } from '@/lib/supabase/admin'
import { RETENTION_DAYS, purgeSystemLogs } from '@/lib/supabase/repositories/system-logs'
import { VITALS_RETENTION_DAYS, purgeVitalsSamples } from '@/lib/supabase/repositories/web-vitals'

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
  const admin = createAdminClient()
  const outcome = await purgeSystemLogs(admin, now)
  /*
   * THE VITALS PURGE IS NOT ALLOWED TO TAKE THE LOG PURGE DOWN WITH IT. The log retention run is
   * the one this route exists for and the one whose failure matters; a samples table that keeps a
   * few extra days of rows is a footnote. So it is attempted, and a failure is recorded as a
   * WARNING on the same tick rather than thrown.
   */
  let vitalsRemoved = 0
  let vitalsError: string | null = null
  try {
    vitalsRemoved = await purgeVitalsSamples(admin, now)
  } catch (error) {
    vitalsError = error instanceof Error ? error.message : 'unknown error'
    await logSystem({
      level: 'WARNING',
      channel: 'SYSTEM',
      event: 'vitals.retention.failed',
      message: 'The web vitals retention purge did not run',
      context: { retention_days: VITALS_RETENTION_DAYS },
    })
  }
  await logSystem({
    level: 'INFO',
    channel: 'SYSTEM',
    event: 'logs.retention.purged',
    message:
      `Retention purge removed ${String(outcome.infoWarning)} INFO/WARNING and ` +
      `${String(outcome.errorSecurity)} ERROR/SECURITY rows, and ` +
      `${String(vitalsRemoved)} web vitals sample(s)`,
    context: {
      info_warning_removed: outcome.infoWarning,
      error_security_removed: outcome.errorSecurity,
      info_warning_days: RETENTION_DAYS.INFO,
      error_security_days: RETENTION_DAYS.ERROR,
      vitals_removed: vitalsRemoved,
      vitals_days: VITALS_RETENTION_DAYS,
      vitals_failed: vitalsError !== null,
    },
  })

  return NextResponse.json({
    ran_at: now.toISOString(),
    removed: {
      info_warning: outcome.infoWarning,
      error_security: outcome.errorSecurity,
      web_vitals: vitalsRemoved,
    },
    retention_days: {
      info_warning: RETENTION_DAYS.INFO,
      error_security: RETENTION_DAYS.ERROR,
      web_vitals: VITALS_RETENTION_DAYS,
    },
  })
}
