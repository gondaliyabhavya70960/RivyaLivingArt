import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'

/**
 * THE QUERIES BEHIND A DATA REQUEST — Phase 41.
 *
 * `lib/inquiries/pii.ts` holds the POLICY: which columns identify a person, what each becomes on
 * erasure, how long a row is kept and how an enquirer is matched without a customer id. This file
 * holds the six reads and writes that policy needs, because `scripts/db/check-data-layer.mjs`
 * requires every `.from()` in the product to live under `lib/supabase/repositories/**` — the place
 * the Zod schemas and the error mapping already are — and a policy module that queried directly
 * would be the one exception that makes the rule unenforceable.
 *
 * EVERY FUNCTION HERE TAKES THE ADMIN CLIENT AND SAYS SO IN ITS NAME OR ITS COMMENT. Erasure writes
 * columns no session may write, and the row belongs to somebody who has no login here to authorise
 * it with. The permission check happens before any of this is reached — `inquiries.export`, plus the
 * owner's own role for an erasure — in the Server Action or the CLI that calls it.
 *
 * NOTHING HERE DECIDES ANYTHING. It selects, it updates what it is given, and it maps an error to a
 * thrown message. Every judgement — what counts as personal, how long is long enough, whether a
 * phone number matches — is in the policy module, where it can be read in one place.
 */

type Client = SupabaseClient<Database>
type InquiryUpdate = Database['public']['Tables']['inquiries']['Update']

export interface InquiryIdRow {
  readonly id: string
  readonly reference_code: string
}

/** Every enquiry whose email matches exactly. `email` is `citext`, so the comparison is case-insensitive. */
export async function inquiryIdsByEmail(admin: Client, email: string): Promise<string[]> {
  const { data, error } = await admin.from('inquiries').select('id').eq('email', email)
  if (error !== null) throw new Error(`enquiry lookup by email failed: ${error.message}`)
  return (data ?? []).map((row: { id: string }) => row.id)
}

/**
 * Every enquiry's id and phone number, for digit comparison in the caller.
 *
 * READ WHOLE AND COMPARED IN THE APPLICATION, because PostgREST has no digit-stripping operator and
 * a `like` over a formatted column misses `+91 98…` when given `098…`. The set is small — this is a
 * studio, not a marketplace. If it stops being small the fix is a generated `phone_digits` column,
 * not a cleverer query, and the change lands here rather than in the policy module.
 */
export async function inquiryPhones(
  admin: Client,
): Promise<readonly { id: string; phone: string }[]> {
  const { data, error } = await admin.from('inquiries').select('id, phone')
  if (error !== null) throw new Error(`enquiry lookup by phone failed: ${error.message}`)
  return (data ?? []) as readonly { id: string; phone: string }[]
}

/** The reference codes for a set of ids, so a dry run can be read before it is repeated for real. */
export async function inquiryReferences(admin: Client, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const { data, error } = await admin
    .from('inquiries')
    .select('reference_code')
    .in('id', [...ids])
  if (error !== null) throw new Error(`reference lookup failed: ${error.message}`)
  return (data ?? []).map((row: { reference_code: string }) => row.reference_code)
}

/** Everything held about one enquirer, for a subject access request. Full rows, by design. */
export async function inquiryRecordsFor(
  admin: Client,
  ids: readonly string[],
): Promise<{ readonly inquiries: unknown[]; readonly attachments: unknown[] }> {
  if (ids.length === 0) return { inquiries: [], attachments: [] }
  const [rows, attachments] = await Promise.all([
    admin
      .from('inquiries')
      .select('*')
      .in('id', [...ids]),
    admin
      .from('inquiry_attachments')
      .select('*')
      .in('inquiry_id', [...ids]),
  ])
  if (rows.error !== null) throw new Error(`enquiry export failed: ${rows.error.message}`)
  if (attachments.error !== null) {
    throw new Error(`attachment export failed: ${attachments.error.message}`)
  }
  return { inquiries: rows.data ?? [], attachments: attachments.data ?? [] }
}

/**
 * Enquiries untouched since `cutoff` that have not already been erased.
 *
 * `notErasedName` is the sentinel an erased row carries, passed in rather than imported so this file
 * holds no opinion about what erasure looks like. Skipping an already-erased row is what lets a
 * repeated retention run report zero, so an operator can tell "nothing was due" from "it ran and did
 * nothing".
 */
export async function inquiriesOlderThan(
  admin: Client,
  cutoff: Date,
  notErasedName: string,
): Promise<readonly InquiryIdRow[]> {
  const { data, error } = await admin
    .from('inquiries')
    .select('id, reference_code')
    .lt('updated_at', cutoff.toISOString())
    .neq('name', notErasedName)
  if (error !== null) throw new Error(`retention scan failed: ${error.message}`)
  return (data ?? []) as readonly InquiryIdRow[]
}

/** Apply the caller's erased values to a set of ids. Returns how many rows were written. */
export async function applyErasure(
  admin: Client,
  ids: readonly string[],
  values: InquiryUpdate,
): Promise<number> {
  if (ids.length === 0) return 0
  const { error, count } = await admin
    .from('inquiries')
    .update(values, { count: 'exact' })
    .in('id', [...ids])
  if (error !== null) throw new Error(`erasure failed: ${error.message}`)
  return count ?? 0
}
