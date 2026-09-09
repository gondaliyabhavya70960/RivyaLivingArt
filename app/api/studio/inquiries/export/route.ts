import { NextResponse } from 'next/server'

import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { listInquiriesForExport } from '@/lib/supabase/repositories/inquiries'
import { createClient } from '@/lib/supabase/server'

/**
 * The enquiry export, as CSV.
 *
 * `inquiries.export` AND NOT `inquiries.read`, and the difference is the point. Reading an enquiry
 * on a screen leaves it where it is; exporting one puts every customer's name and phone number in a
 * file that leaves the building the moment somebody emails it. The editor holds `inquiries.read`
 * and does not hold this.
 *
 * IT OMITS `ip_hash` AND `user_agent`, AND THE OMISSION IS AT THE QUERY. `listInquiriesForExport`
 * selects columns by name, so a later change to this writer cannot reintroduce them by widening a
 * `select('*')`. Those two exist to catch abuse; they are not part of following an enquiry up, and
 * a spreadsheet is exactly where a hashed address should never end up.
 *
 * EVERY EXPORT IS AUDITED, INCLUDING THE REFUSED ONES. `requirePermission` writes the DENIED row
 * itself; the SUCCEEDED row below records who took a copy of the customer list and when, which is
 * the question somebody will eventually ask.
 *
 * NO INQUIRY_EVENTS ROW PER ENQUIRY. The phase document's `EXPORTED` event kind exists and this
 * writes none: appending one row per enquiry to the timeline would bury the events that describe a
 * conversation under a hundred that describe a spreadsheet. The audit log is where an export
 * belongs, and it is one row.
 */

/** RFC 4180: quote everything, double the quotes inside. A name with a comma is not exotic. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

const COLUMNS = [
  'reference_code',
  'kind',
  'pipeline_status',
  'name',
  'phone',
  'email',
  'city',
  'enquiry_type',
  'whatsapp_state',
  'source_path',
  'created_at',
] as const

export async function GET(): Promise<Response> {
  let session
  try {
    session = await requirePermission('inquiries.export')
  } catch (error) {
    // 401 and 403 are different facts and are reported as different facts: one says "sign in", the
    // other says "not you". Collapsing them would tell a signed-in editor to sign in again.
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    throw error
  }

  const rows = await listInquiriesForExport(await createClient())

  await writeAudit({
    action: 'inquiries.export',
    result: 'SUCCESS',
    actorUserId: session.userId,
    actorRole: session.role,
    entityType: 'inquiries',
    summary: `Exported ${rows.length} enquiries`,
  })

  const body = [
    COLUMNS.map(csvCell).join(','),
    ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(',')),
  ].join('\r\n')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="rivya-enquiries.csv"',
      // Never cached, anywhere. A CDN holding a copy of the customer list is the same leak by a
      // different route.
      'cache-control': 'no-store, max-age=0',
    },
  })
}
