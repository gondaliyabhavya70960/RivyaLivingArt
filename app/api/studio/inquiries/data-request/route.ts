import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { exportEnquirerData } from '@/lib/inquiries/pii'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * A subject access request — everything held about one enquirer, as a file — Phase 41.
 *
 * A ROUTE HANDLER RATHER THAN A SERVER ACTION, because the answer is a FILE. The point of this
 * request is that a person receives their data; a Server Action would have to return the rows into
 * the page so the browser could build a download from them, which puts somebody's full enquiry
 * history into the DOM of a Studio tab that may be left open on a shared screen. A response with
 * `Content-Disposition: attachment` goes to disk and nowhere else.
 *
 * POST, AND THE IDENTIFIER IS IN THE BODY. A GET would put an email address or a phone number in a
 * URL, and URLs are written to access logs, proxy logs, browser history and referrer headers. The
 * one thing this endpoint must not do is leak the identity of the person exercising a privacy
 * right.
 *
 * `inquiries.export` — the same permission as the CSV, for the same reason: this is a copy of
 * customer data leaving the building. Erasure demands more (the owner's own role) and lives in
 * `app/(studio)/studio/(shell)/inquiries/actions.ts`.
 *
 * `no-store`, ALWAYS. There is no version of this answer worth keeping in a cache anywhere.
 */

const bodySchema = z
  .object({
    email: z.string().trim().max(320).optional(),
    phone: z.string().trim().max(40).optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.email !== undefined && value.email !== '') ||
      (value.phone !== undefined && value.phone !== ''),
    { message: 'an email or a phone number is required' },
  )

export async function POST(request: NextRequest): Promise<Response> {
  let session
  try {
    session = await requirePermission('inquiries.export')
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    throw error
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'identifier_required' }, { status: 400 })
  }

  const identifier = {
    ...(parsed.data.email !== undefined && parsed.data.email !== ''
      ? { email: parsed.data.email }
      : {}),
    ...(parsed.data.phone !== undefined && parsed.data.phone !== ''
      ? { phone: parsed.data.phone }
      : {}),
  }

  const data = await exportEnquirerData(createAdminClient(), identifier)

  await writeAudit({
    action: 'inquiries.data_request.export',
    result: 'SUCCESS',
    actorUserId: session.userId,
    actorRole: session.role,
    entityType: 'inquiries',
    // A count, never the identifier that was searched for. The audit log is read by more people
    // than the inbox is, and this row exists to record that an export happened, not who asked.
    summary: `Exported one enquirer's data: ${String(data.inquiries.length)} enquiry/enquiries and ${String(data.attachments.length)} attachment(s).`,
  })

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // A fixed name. A filename built from the identifier would write somebody's email address
      // into the operator's Downloads folder and into every backup of it.
      'Content-Disposition': 'attachment; filename="data-request.json"',
      'Cache-Control': 'private, no-store',
    },
  })
}
