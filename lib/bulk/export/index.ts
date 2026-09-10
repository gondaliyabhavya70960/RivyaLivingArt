import 'server-only'

import { withAudit } from '@/lib/auth/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  listInquiriesForExport,
  listMediaForExport,
  listProductsForExport,
} from '@/lib/supabase/repositories/bulk-export'

import type { BulkActor } from '../types'

/**
 * CSV export of products, media and enquiries.
 *
 * THE ENQUIRY EXPORT IS THE ONE THAT NEEDED THINKING ABOUT, and its rule is: MESSAGE BODIES ARE
 * EXCLUDED UNLESS THE OPERATOR TICKS A BOX, AND THE TICK IS RECORDED IN THE AUDIT ROW ALONGSIDE
 * THE EXACT FIELD LIST. An enquiry carries a name, a phone number and whatever somebody chose to
 * say about their home; the default export is the pipeline data, and taking the free text is a
 * deliberate act somebody can be asked about later.
 *
 * IT REQUIRES `inquiries.export`, WHICH IS NOT `inquiries.read`. Reading an enquiry in the Studio
 * and carrying five hundred of them out as a file are different acts, and Phase 04 gave them
 * different permissions for that reason.
 *
 * EVERY EXPORT IS AUDITED WITH ITS FIELD SET, not just its row count. "Somebody exported the
 * enquiries" is not the question a data-protection question asks; "which columns" is.
 */

/** RFC 4180: quote when the value contains a delimiter, a quote or a newline; double the quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<Record<string, unknown>>,
): string {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(','))
  // A TRAILING NEWLINE, because a file without one makes `wc -l` and several spreadsheet importers
  // disagree about how many rows it has.
  return `${lines.join('\r\n')}\r\n`
}

export const PRODUCT_EXPORT_FIELDS = [
  'slug',
  'sku',
  'title',
  'subtitle',
  'summary',
  'category_slug',
  'status',
  'price_state',
  'price_minor',
  'price_from_minor',
  'currency',
  'availability_state',
  'edition_state',
  'edition_size',
  'is_customizable',
  'is_large_format',
  'owner_verification',
  'created_at',
  'updated_at',
] as const

export const MEDIA_EXPORT_FIELDS = [
  'rivya_asset_id',
  'public_id',
  'folder',
  'filename',
  'kind',
  'status',
  'is_ai_generated',
  'is_concept',
  'source',
  'tags',
  'width',
  'height',
  'created_at',
] as const

/**
 * The enquiry fields an export may carry, split into two sets that are NOT interchangeable.
 *
 * The base set is what the sales pipeline is made of. The free-text set is what a person wrote.
 */
export const INQUIRY_EXPORT_FIELDS = [
  'reference_code',
  'kind',
  'pipeline_status',
  'name',
  'phone',
  'email',
  'city',
  'created_at',
  'whatsapp_state',
] as const

export const INQUIRY_FREE_TEXT_FIELDS = ['message', 'answers'] as const

export async function exportProductsCsv(actor: BulkActor): Promise<string> {
  const rows = await listProductsForExport(createAdminClient())
  await withAudit(
    {
      action: 'bulk.export.products',
      actorUserId: actor.userId,
      actorRole: actor.role,
      entityType: 'product',
      summary: `${rows.length} product(s) exported`,
      after: { fields: PRODUCT_EXPORT_FIELDS, rows: rows.length } as never,
    },
    async () => undefined,
  )
  return toCsv(PRODUCT_EXPORT_FIELDS, rows)
}

export async function exportMediaCsv(actor: BulkActor): Promise<string> {
  const rows = await listMediaForExport(createAdminClient())
  await withAudit(
    {
      action: 'bulk.export.media',
      actorUserId: actor.userId,
      actorRole: actor.role,
      entityType: 'media_asset',
      summary: `${rows.length} asset(s) exported`,
      after: { fields: MEDIA_EXPORT_FIELDS, rows: rows.length } as never,
    },
    async () => undefined,
  )
  return toCsv(MEDIA_EXPORT_FIELDS, rows)
}

/**
 * `includeMessageBodies` DEFAULTS TO FALSE AND IS RECORDED EITHER WAY.
 *
 * The audit row carries the exact field list, so "did that export contain what customers wrote"
 * has an answer months later without anyone having to remember.
 */
export async function exportInquiriesCsv(
  actor: BulkActor,
  options: { readonly includeMessageBodies: boolean },
): Promise<string> {
  const fields = options.includeMessageBodies
    ? [...INQUIRY_EXPORT_FIELDS, ...INQUIRY_FREE_TEXT_FIELDS]
    : [...INQUIRY_EXPORT_FIELDS]

  const rows = await listInquiriesForExport(createAdminClient(), options.includeMessageBodies)

  await withAudit(
    {
      action: 'bulk.export.inquiries',
      actorUserId: actor.userId,
      actorRole: actor.role,
      entityType: 'inquiry',
      summary: `${rows.length} enquiry/enquiries exported${options.includeMessageBodies ? ', INCLUDING message bodies' : ''}`,
      after: {
        fields,
        rows: rows.length,
        includedMessageBodies: options.includeMessageBodies,
      } as never,
    },
    async () => undefined,
  )

  return toCsv(fields, rows)
}
