import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import {
  applyErasure,
  inquiriesOlderThan,
  inquiryIdsByEmail,
  inquiryPhones,
  inquiryRecordsFor,
  inquiryReferences,
} from '@/lib/supabase/repositories/inquiries-pii'

type Client = SupabaseClient<Database>

/**
 * PERSONAL DATA, AND THE THREE THINGS THAT CAN BE DONE WITH IT — Phase 41, FEAT §47.
 *
 * `inquiries` and its attachments are the ONLY personal data in this product. There are no customer
 * accounts (D1), no analytics identifiers (Phase 40's table has no column for one), and nothing in
 * `search_documents` or `web_vitals_samples` that names anybody. That makes the policy small enough
 * to state completely, which is the point of stating it at all:
 *
 *   EXPORT — everything held about one enquirer, as data they can read.
 *   ERASE — the contact details go, the row stays.
 *   ANONYMISE — the same erasure, applied on a schedule to anything older than the retention window.
 *
 * ERASURE KEEPS THE ROW AND THAT IS DELIBERATE. Deleting it would take the enquiry out of every
 * count, every status history and every figure the studio has already acted on — a request to be
 * forgotten would silently rewrite last quarter's numbers. Nulling the contact fields removes the
 * person while leaving the event: an enquiry of this type, on this date, with this outcome. Nobody
 * can be contacted through an anonymised row and nobody's history is destroyed by one.
 *
 * WHAT COUNTS AS A CONTACT FIELD IS A LIST, NOT A GUESS. `PERSONAL_FIELDS` below is the whole of it,
 * and `tests/unit/pii-scope.test.ts` asserts that every one of those columns is absent from the
 * search index and from the vitals table. Adding a personal column to `inquiries` without adding it
 * here would be the failure this list exists to prevent, so the test reads the list rather than
 * repeating it.
 */

/**
 * The columns that identify a person, and what each becomes on erasure.
 *
 * `name` AND `phone` ARE `not null` IN THE SCHEMA, so they cannot be nulled — they are replaced with
 * a fixed marker instead. The marker is not a name and is not mistakable for one; it exists so the
 * NOT NULL constraint that guarantees a contactable enquiry at creation time does not have to be
 * dropped to allow erasure later.
 */
export const PERSONAL_FIELDS = {
  name: { erasedTo: '[erased]', nullable: false },
  phone: { erasedTo: '[erased]', nullable: false },
  email: { erasedTo: null, nullable: true },
  city: { erasedTo: null, nullable: true },
  message: { erasedTo: null, nullable: true },
  ip_hash: { erasedTo: null, nullable: true },
  answers: { erasedTo: null, nullable: true },
} as const

export type PersonalField = keyof typeof PERSONAL_FIELDS

/** Retention before automatic anonymisation, from last activity. FEAT §47: a minimum of 24 months. */
export const RETENTION_MONTHS = 24

export interface ErasureOutcome {
  readonly matched: number
  readonly erased: number
  /** The reference codes touched, so a dry run can be read before it is repeated for real. */
  readonly references: readonly string[]
}

type InquiryUpdate = Database['public']['Tables']['inquiries']['Update']

/**
 * The values an erased row carries.
 *
 * `answers` GOES WHOLESALE rather than field by field. It is the configurator's free-text map — a
 * brief in the enquirer's own words, which routinely names their house, their street or their
 * family. There is no way to erase the person from it and keep it useful, so it goes.
 */
function erasedValues(): InquiryUpdate {
  /*
   * WRITTEN OUT RATHER THAN BUILT FROM `Object.entries(PERSONAL_FIELDS)`, because the generated
   * `Update` type rejects an index-signature object and a cast would turn a typo into a silent
   * no-op — an erasure that reported success and wrote nothing. Each value still comes from the
   * list above, so the two cannot disagree about what an erased row looks like, and
   * `tests/unit/pii-scope.test.ts` asserts every key of `PERSONAL_FIELDS` appears here.
   */
  return {
    name: PERSONAL_FIELDS.name.erasedTo,
    phone: PERSONAL_FIELDS.phone.erasedTo,
    email: PERSONAL_FIELDS.email.erasedTo,
    city: PERSONAL_FIELDS.city.erasedTo,
    message: PERSONAL_FIELDS.message.erasedTo,
    ip_hash: PERSONAL_FIELDS.ip_hash.erasedTo,
    answers: PERSONAL_FIELDS.answers.erasedTo,
  }
}

/**
 * Everything held about one enquirer, for a subject access request.
 *
 * MATCHED BY EMAIL OR PHONE, both normalised, because an enquirer who wrote twice may have used one
 * or the other. `email` is `citext` in the schema, so its comparison is already case-insensitive;
 * the phone is compared on its digits, because the same number arrives as `+91 98…`, `098…` and
 * `98…` depending on who typed it.
 */
export async function exportEnquirerData(
  admin: Client,
  identifier: { readonly email?: string; readonly phone?: string },
): Promise<{ readonly inquiries: unknown[]; readonly attachments: unknown[] }> {
  return inquiryRecordsFor(admin, await matchingInquiryIds(admin, identifier))
}

/**
 * Erase one enquirer, everywhere they appear.
 *
 * `dryRun` IS THE DEFAULT-SHAPED ARGUMENT, not an afterthought. An erasure cannot be undone, the
 * matching is by contact detail rather than by a stable id, and a typo in a phone number could match
 * somebody else entirely — so the operator sees exactly which references would be touched before
 * anything is written. `scripts/ops/anonymise-inquiries.ts` refuses to write without `--apply`.
 */
export async function eraseEnquirer(
  admin: Client,
  identifier: { readonly email?: string; readonly phone?: string },
  options: { readonly dryRun: boolean },
): Promise<ErasureOutcome> {
  const ids = await matchingInquiryIds(admin, identifier)
  if (ids.length === 0) return { matched: 0, erased: 0, references: [] }

  const references = await inquiryReferences(admin, ids)
  if (options.dryRun) return { matched: ids.length, erased: 0, references }

  return { matched: ids.length, erased: await applyErasure(admin, ids, erasedValues()), references }
}

/**
 * Anonymise everything past the retention window.
 *
 * MEASURED FROM LAST ACTIVITY, NOT FROM CREATION. An enquiry that turned into an eighteen-month
 * commission is still live correspondence; one created the same day and never answered is not. The
 * schema's `updated_at` moves on every status change and every note, so it is the right clock.
 *
 * AN ALREADY-ERASED ROW IS SKIPPED rather than written again, so a repeated run reports zero and the
 * operator can tell "nothing was due" from "it ran and did nothing".
 */
export async function anonymiseExpired(
  admin: Client,
  options: { readonly now: Date; readonly months?: number; readonly dryRun: boolean },
): Promise<ErasureOutcome> {
  const months = options.months ?? RETENTION_MONTHS
  const cutoff = new Date(options.now)
  cutoff.setMonth(cutoff.getMonth() - months)

  const rows = await inquiriesOlderThan(admin, cutoff, PERSONAL_FIELDS.name.erasedTo)
  const references = rows.map((row) => row.reference_code)
  if (rows.length === 0 || options.dryRun) {
    return { matched: rows.length, erased: 0, references }
  }

  const erased = await applyErasure(
    admin,
    rows.map((row) => row.id),
    erasedValues(),
  )
  return { matched: rows.length, erased, references }
}

/** Digits only, so the same number matches however it was typed. */
function digitsOf(value: string): string {
  return value.replace(/\D+/g, '')
}

async function matchingInquiryIds(
  admin: Client,
  identifier: { readonly email?: string; readonly phone?: string },
): Promise<string[]> {
  const email = identifier.email?.trim()
  const phone = identifier.phone === undefined ? undefined : digitsOf(identifier.phone)

  if ((email === undefined || email === '') && (phone === undefined || phone === '')) {
    // REFUSED RATHER THAN MATCHING EVERYTHING. An empty identifier reaching a bulk update is the one
    // mistake in this file that could not be recovered from.
    throw new Error('an erasure or export needs an email or a phone number')
  }

  const ids = new Set<string>()

  if (email !== undefined && email !== '') {
    for (const id of await inquiryIdsByEmail(admin, email)) ids.add(id)
  }

  if (phone !== undefined && phone !== '') {
    /*
     * MATCHED IN THE APPLICATION, NOT IN SQL. PostgREST has no digit-stripping operator, and a
     * `like` over a formatted column would miss `+91 98…` when given `098…`. The set of enquiries is
     * small — this is a studio, not a marketplace — so the honest answer is to read the column and
     * compare digits. If it ever stops being small, the fix is a generated `phone_digits` column,
     * not a cleverer query, and it lands in the repository rather than here.
     *
     * MATCHED ON A SUFFIX IN EITHER DIRECTION, because a country code is present in some rows and
     * absent in others and neither spelling is wrong.
     */
    for (const row of await inquiryPhones(admin)) {
      if (digitsOf(row.phone).endsWith(phone) || phone.endsWith(digitsOf(row.phone))) {
        ids.add(row.id)
      }
    }
  }

  return [...ids]
}
