'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { t } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { eraseEnquirer } from '@/lib/inquiries/pii'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * THE DATA REQUEST — Phase 41, SECURITY.md §9.
 *
 * Two acts behind one panel, in the order the law and common sense put them: show me what you hold
 * about this person, then erase it. The export is a route handler (a file the owner hands over);
 * this module is the erasure, and the preview that must precede it.
 *
 * MATCHING IS BY CONTACT DETAIL, WHICH IS WHY THE PREVIEW EXISTS. There is no stable customer id in
 * this product — no accounts, by design — so an enquirer is found by the email or phone they typed,
 * and a mistyped digit matches somebody else. The preview is a dry run that returns the REFERENCE
 * CODES it would touch and writes nothing; the erasure takes those codes back as a confirmation and
 * refuses if they do not match what it is about to do. That is the whole safety model, and it is
 * the reason erasure is not one click.
 *
 * OWNER ONLY FOR THE ERASURE, and `inquiries.export` for the preview. The permission is held by the
 * merchandiser too, which is right for reading and wrong for an irreversible write against
 * somebody's record — so the erasure additionally requires the owner's own role. That check is a
 * role literal rather than a permission, deliberately: adding a permission for it would mean a
 * migration and a generated policy file for a rule with exactly one holder, and the rule would then
 * live in two places that can disagree.
 *
 * THE SERVICE ROLE, NECESSARILY. Erasure writes columns no session may write — `ip_hash` among them
 * — and the row belongs to a person who has no login here to authorise it with.
 *
 * NO CONTACT DETAIL IS EVER RETURNED OR LOGGED. The preview answers with reference codes and a
 * count; the audit summary names the codes. A reference code identifies the enquiry to the studio
 * without naming the enquirer, and an audit log is read by more people than an inbox is.
 */

const identifierSchema = z
  .object({
    email: z.string().trim().max(320).optional(),
    phone: z.string().trim().max(40).optional(),
  })
  .refine(
    (value) =>
      (value.email !== undefined && value.email !== '') ||
      (value.phone !== undefined && value.phone !== ''),
    // An empty identifier would match nothing here and everything in a careless implementation.
    // Refusing it in the schema means no code path downstream has to decide what "no identifier"
    // means.
    { message: 'an email or a phone number is required' },
  )

export type PreviewResult =
  { ok: true; matched: number; references: readonly string[] } | { ok: false; error: string }

export async function previewDataRequestAction(input: unknown): Promise<PreviewResult> {
  try {
    const session = await requirePermission('inquiries.export')

    const parsed = identifierSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: t('studio.inquiries.dataRequest.needsOne') }

    const outcome = await eraseEnquirer(createAdminClient(), identifierOf(parsed.data), {
      dryRun: true,
    })

    await writeAudit({
      action: 'inquiries.data_request.preview',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'inquiries',
      summary: `Previewed a data request: ${String(outcome.matched)} enquiry/enquiries matched (${outcome.references.join(', ') || 'none'}).`,
    })

    return { ok: true, matched: outcome.matched, references: outcome.references }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { ok: false, error: t('studio.inquiries.dataRequest.refused') }
    }
    throw error
  }
}

const eraseSchema = z.object({
  email: z.string().trim().max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  /** The codes the preview returned. The erasure refuses unless they still describe the same set. */
  confirmReferences: z.array(z.string().min(1).max(40)).min(1).max(500),
})

export type EraseResult = { ok: true; erased: number } | { ok: false; error: string }

export async function eraseDataRequestAction(input: unknown): Promise<EraseResult> {
  try {
    const session = await requirePermission('inquiries.export')
    if (session.role !== 'owner') {
      await writeAudit({
        action: 'inquiries.data_request.erase',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'inquiries',
        summary: 'Erasure refused: only the owner may erase an enquirer.',
      })
      return { ok: false, error: t('studio.inquiries.dataRequest.ownerOnly') }
    }

    const parsed = eraseSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: t('studio.inquiries.dataRequest.needsOne') }

    const admin = createAdminClient()
    const identifier = identifierOf(parsed.data)

    /*
     * THE DRY RUN IS REPEATED HERE RATHER THAN TRUSTED FROM THE BROWSER. Between the preview and
     * this call a new enquiry may have arrived from the same person, or one may have been erased
     * already. If the set has moved, nothing is written and the panel asks for a fresh preview —
     * which is the only way "I read the list before I confirmed" can mean anything.
     */
    const check = await eraseEnquirer(admin, identifier, { dryRun: true })
    const expected = [...parsed.data.confirmReferences].sort()
    const actual = [...check.references].sort()
    if (expected.length !== actual.length || expected.some((code, i) => code !== actual[i])) {
      return { ok: false, error: t('studio.inquiries.dataRequest.moved') }
    }
    if (actual.length === 0) return { ok: false, error: t('studio.inquiries.dataRequest.nothing') }

    const outcome = await eraseEnquirer(admin, identifier, { dryRun: false })

    await writeAudit({
      action: 'inquiries.data_request.erase',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'inquiries',
      summary: `Erased the enquirer behind ${String(outcome.erased)} enquiry/enquiries (${outcome.references.join(', ')}). Rows, statuses and timestamps kept; contact fields cleared.`,
    })

    revalidatePath('/studio/inquiries', 'layout')
    return { ok: true, erased: outcome.erased }
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { ok: false, error: t('studio.inquiries.dataRequest.refused') }
    }
    throw error
  }
}

/** Drops the empty strings a form sends for an untouched field. */
function identifierOf(value: { email?: string; phone?: string }): {
  email?: string
  phone?: string
} {
  return {
    ...(value.email !== undefined && value.email !== '' ? { email: value.email } : {}),
    ...(value.phone !== undefined && value.phone !== '' ? { phone: value.phone } : {}),
  }
}
