import { NextResponse } from 'next/server'
import { z } from 'zod'

import { logSystem } from '@/lib/logging/system-log'
import { bucketKey, callerAddress, consume, type RateWindow } from '@/lib/security/rate-limit'

/**
 * CSP violation reports — Phase 41.
 *
 * THE POINT OF THIS ENDPOINT IS THE WEEK BEFORE ENFORCEMENT. A Content-Security-Policy that breaks
 * the 3D viewer or a Cloudinary video breaks it in production, on somebody's device, and the first
 * anybody hears is "the page is blank". So the policy ships as `Content-Security-Policy-Report-Only`
 * and every violation lands here, at SECURITY level in `system_logs`, where the Studio can
 * show it. `CSP_ENFORCE=1` flips the header name once the log is quiet. SECURITY.md §5.3 carries the
 * procedure and the date.
 *
 * IT STAYS AFTER ENFORCEMENT. An enforced policy still reports, and a report then means either an
 * injection attempt or a regression somebody shipped — both worth a log line.
 *
 * WHAT IT IS CAREFUL ABOUT. A report endpoint is an unauthenticated write path that anybody on the
 * internet can find, and the body is attacker-controlled:
 *
 *   * RATE LIMITED FIRST, before the body is read, so a flood costs the sender what a single report
 *     costs. Generously, because one broken page can legitimately produce a dozen reports.
 *   * ONLY SIX FIELDS ARE KEPT, each length-capped, and the rest of the report is discarded. A
 *     browser's report also carries `script-sample` — up to forty characters of the offending
 *     script — which is genuinely useful for debugging and is exactly the field an attacker would
 *     use to write chosen text into our logs. It is not stored.
 *   * `document-uri` IS REDUCED TO A PATH. The full URL can carry a query string, which on `/search`
 *     is a visitor's search term. A path is enough to find the page.
 *   * IT ALWAYS ANSWERS 204. A report endpoint that returns an error teaches a scanner which bodies
 *     are interesting.
 */

export const dynamic = 'force-dynamic'

/** Twenty a minute, two hundred an hour: one badly broken page, not a campaign. */
const REPORT_WINDOWS: readonly RateWindow[] = [
  { seconds: 60, limit: 20 },
  { seconds: 3600, limit: 200 },
]

const NO_STORE = { 'cache-control': 'no-store' } as const

/**
 * The six fields worth keeping, each capped. Not `.strict()`: a browser is free to add fields to the
 * report format and refusing the whole report over one would lose the signal this endpoint exists
 * for. Unknown fields are dropped rather than rejected, which is the opposite of the choice
 * `/api/vitals` makes — there, an unknown key is a client trying to send an identifier; here, it is
 * a browser vendor shipping a spec revision.
 */
const reportBody = z.object({
  'csp-report': z
    .object({
      'document-uri': z.string().max(2000).optional(),
      referrer: z.string().max(2000).optional(),
      'violated-directive': z.string().max(200).optional(),
      'effective-directive': z.string().max(200).optional(),
      'blocked-uri': z.string().max(2000).optional(),
      disposition: z.string().max(40).optional(),
    })
    .optional(),
})

/** The path only. A query string on `/search` is a visitor's search term. */
function pathOf(value: string | undefined): string | null {
  if (value === undefined || value === '') return null
  try {
    return new URL(value).pathname
  } catch {
    return value.startsWith('/') ? (value.split('?')[0] ?? null) : null
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const { allowed } = await consume(bucketKey('csp_report', callerAddress(request)), REPORT_WINDOWS)
  if (!allowed) return new NextResponse(null, { status: 204, headers: NO_STORE })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  }

  const parsed = reportBody.safeParse(body)
  const report = parsed.success ? parsed.data['csp-report'] : undefined
  if (report === undefined) return new NextResponse(null, { status: 204, headers: NO_STORE })

  const directive = report['effective-directive'] ?? report['violated-directive'] ?? 'unknown'

  await logSystem({
    /*
     * `SECURITY` IS A LEVEL IN THIS PRODUCT, NOT A CHANNEL (Phase 38), and it is the right level
     * here for two reasons. A violation is a security event whether it turns out to be an injection
     * attempt or our own regression. And `SECURITY` rows are retained 400 days rather than 90, which
     * is what makes a report-only soak useful afterwards: the record of what the policy would have
     * blocked survives long enough to be read when somebody asks why a directive is shaped as it is.
     *
     * The channel is `SYSTEM` because the policy is a property of the deployment rather than of any
     * one subsystem. A violation naming a Cloudinary URL is still a CSP fact, not a media fact.
     */
    level: 'SECURITY',
    channel: 'SYSTEM',
    event: 'csp.violation',
    message: `CSP ${report.disposition ?? 'report'}: ${directive}`,
    context: {
      directive,
      document_path: pathOf(report['document-uri']),
      referrer_path: pathOf(report.referrer),
      // The blocked URI is the thing that was refused — a script origin, `inline`, or `eval`. It is
      // the one attacker-influenceable value kept, and it is capped and never rendered as markup.
      blocked_uri: report['blocked-uri']?.slice(0, 300) ?? null,
      disposition: report.disposition ?? null,
    },
  })

  return new NextResponse(null, { status: 204, headers: NO_STORE })
}
