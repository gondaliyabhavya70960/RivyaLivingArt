import 'server-only'

import { listInquiriesForExport } from '@/lib/supabase/repositories/inquiries'

import { FILTER_SCHEMAS } from '../definitions'
import type { Client, Record_ } from './shared'

/**
 * The enquiries builder — Phase 36. The only builder that can carry personal data, and only when
 * the definition says so; see the second refusal inside.
 */

export async function inquiries(
  client: Client,
  filter: Record<string, unknown>,
  includesPii: boolean,
): Promise<Record_[]> {
  const parsed = FILTER_SCHEMAS.INQUIRIES.parse(filter) as { kind?: string; status?: string }
  const rows = await listInquiriesForExport(client)
  return rows
    .filter(
      (row) =>
        (parsed.kind === undefined || row.kind === parsed.kind) &&
        (parsed.status === undefined || row.pipeline_status === parsed.status),
    )
    .map((row) => ({
      reference_code: row.reference_code,
      kind: row.kind,
      pipeline_status: row.pipeline_status,
      created_at: row.created_at,
      city: row.city,
      enquiry_type: row.enquiry_type,
      whatsapp_state: row.whatsapp_state,
      source_path: row.source_path,
      // PII ONLY WHEN THE DEFINITION CARRIES THE FLAG. The column allowlist refuses these names on
      // a definition without it, and this is the second refusal: even a column that slipped past
      // would find a blank.
      name: includesPii ? row.name : null,
      phone: includesPii ? row.phone : null,
      email: includesPii ? row.email : null,
    }))
}
