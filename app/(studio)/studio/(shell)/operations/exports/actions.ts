'use server'

import type { StudioFormState } from '@/components/studio/form-state'
import { requirePermission } from '@/lib/auth/require'
import { exportInquiriesCsv, exportMediaCsv, exportProductsCsv } from '@/lib/bulk/export'
import { PermissionError } from '@/lib/supabase/errors'

/**
 * The export actions.
 *
 * THE ENQUIRY EXPORT CHECKS `inquiries.export`, NOT `bulk.execute`. Reading an enquiry in the
 * Studio and carrying five hundred of them out as a file are different acts, and Phase 04 gave
 * them different permissions for exactly that reason. A merchandiser holds both; a viewer holds
 * neither; an editor holds `inquiries.read` and not `inquiries.export`, which is the case this
 * distinction exists for.
 *
 * A SERVER ACTION CANNOT STREAM A FILE, so each of these returns the CSV as text and the client
 * component hands it to the browser as a Blob download. That is a real constraint of the Server
 * Action shape rather than a preference: a route handler could stream, and would be the right
 * answer if these files ever grew past a few megabytes. Recorded in STUDIO_GUIDE §12.
 */

function issue(message: string, code: string): StudioFormState {
  return { status: 'error', issues: [{ field: '_form', code, message }] }
}

export type ExportResult =
  | { readonly ok: true; readonly filename: string; readonly csv: string }
  | { readonly ok: false; readonly message: string }

export async function exportProductsAction(): Promise<ExportResult> {
  try {
    const session = await requirePermission('bulk.execute')
    const csv = await exportProductsCsv({ userId: session.userId, role: session.role })
    return { ok: true, filename: `rivya-products-${today()}.csv`, csv }
  } catch (error) {
    return { ok: false, message: messageFor(error, 'products') }
  }
}

export async function exportMediaAction(): Promise<ExportResult> {
  try {
    const session = await requirePermission('bulk.execute')
    const csv = await exportMediaCsv({ userId: session.userId, role: session.role })
    return { ok: true, filename: `rivya-media-${today()}.csv`, csv }
  } catch (error) {
    return { ok: false, message: messageFor(error, 'media') }
  }
}

export async function exportInquiriesAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    await requirePermission('inquiries.export')
    // Handled by the client component below, which calls `fetchInquiryExport`. This action exists
    // so the form has a server-side permission check even before the fetch.
    void form
    return { status: 'saved' }
  } catch {
    return issue('You cannot export enquiries.', 'forbidden')
  }
}

export async function fetchInquiryExport(includeMessageBodies: boolean): Promise<ExportResult> {
  try {
    const session = await requirePermission('inquiries.export')
    const csv = await exportInquiriesCsv(
      { userId: session.userId, role: session.role },
      { includeMessageBodies },
    )
    return { ok: true, filename: `rivya-enquiries-${today()}.csv`, csv }
  } catch (error) {
    return { ok: false, message: messageFor(error, 'enquiries') }
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function messageFor(error: unknown, what: string): string {
  if (error instanceof PermissionError) return `You cannot export ${what}.`
  return `The ${what} export failed. Nothing was written.`
}
