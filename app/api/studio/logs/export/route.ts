import { NextResponse } from 'next/server'

import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { parseLogFilter } from '@/lib/logging/log-filters'
import { redact } from '@/lib/logging/redact'
import { listSystemLogs } from '@/lib/supabase/repositories/system-logs'
import { createClient } from '@/lib/supabase/server'

/**
 * `GET /api/studio/logs/export?…` — the system log as CSV, under the same filters as the page —
 * Phase 38. `operations.logs.export` (owner, admin), audited. The context column is the redacted
 * JSON, redacted again here because a CSV that leaves the building is the moment it matters.
 */

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/gu, '""')}"`
}

const COLUMNS = [
  'occurred_at',
  'first_occurred_at',
  'occurrence_count',
  'level',
  'channel',
  'event',
  'message',
  'actor_id',
  'actor_role',
  'request_id',
  'workflow_run_id',
  'research_source_id',
  'entity_type',
  'entity_id',
  'context',
] as const

export async function GET(request: Request): Promise<Response> {
  let session
  try {
    session = await requirePermission('operations.logs.export')
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    throw error
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const filter = { ...parseLogFilter(params), limit: 500 }
  const rows = await listSystemLogs(await createClient(), filter)

  await writeAudit({
    action: 'operations.logs.export',
    result: 'SUCCESS',
    actorUserId: session.userId,
    actorRole: session.role,
    entityType: 'system_logs',
    summary: `Exported ${String(rows.length)} system log rows`,
    after: { filter },
  })

  const body = [
    COLUMNS.map(csvCell).join(','),
    ...rows.map((row) =>
      COLUMNS.map((column) =>
        csvCell(column === 'context' ? JSON.stringify(redact(row.context)) : row[column]),
      ).join(','),
    ),
  ].join('\r\n')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="rivya-system-logs.csv"',
      'cache-control': 'no-store, max-age=0',
    },
  })
}
