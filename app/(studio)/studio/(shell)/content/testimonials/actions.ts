'use server'

import { revalidatePath } from 'next/cache'

import { withAudit, writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { testimonialPublishGates, unmetGates, type PublishGate } from '@/lib/portfolio/gates'
import type { StudioFormState } from '@/components/studio/form-state'
import {
  getTestimonialById,
  insertTestimonial,
  updateTestimonialRow,
} from '@/lib/supabase/repositories/testimonials'
import { clientConsentStateSchema } from '@/lib/supabase/schemas'
import { createClient } from '@/lib/supabase/server'

/**
 * The testimonials surface's Server Actions.
 *
 * THE SAME CONSENT DISCIPLINE AS A PROJECT, THROUGH DIFFERENT COLUMNS. A testimonial names a person
 * in `attributed_to` and records their agreement in `consent`; a project uses `client_display_name`
 * and `client_consent`. The rule is identical — a row that names somebody may not be published
 * unless that somebody has agreed — and it is enforced by a per-table trigger for the reason
 * `0150` gives at length: a shared plpgsql function would raise `record "new" has no field …` on
 * the first write to whichever table it was not written for.
 *
 * `consent` DEFAULTS TO PENDING, NOT NOT_APPLICABLE, and that difference is deliberate. A project
 * may legitimately name nobody. A quote always came from someone, so "does this person agree" is
 * always a live question here.
 *
 * THERE IS A CREATE FORM, AND THAT IS A REVERSAL. The screen first shipped without one, on the
 * grounds that a box to type a quote into is an invitation to write one in-house — the thing D10
 * names outright. On reflection that guard was in the wrong place: it prevented nothing (a
 * fabricated quote is refused at publication, by the gate, whoever typed it) while making it
 * impossible to record a REAL quote through the Studio at all. The gate is the guard.
 */

export type TestimonialActionState = StudioFormState

const issue = (message: string, code = 'refused', field = '_form'): TestimonialActionState => ({
  status: 'error',
  issues: [{ field, code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  return 'That change could not be saved.'
}

function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function uuid(form: FormData, name: string): string | null {
  const value = text(form, name)
  if (value === null) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

const LIST = '/studio/content/testimonials'

/** The words a refused publish shows for one unmet gate. See the note in the project editor: the
 *  issues travel as data, so the sentences live in the action rather than in `t()`. */
function gateMessage(gate: PublishGate): string {
  switch (gate.id) {
    case 'owner_verification':
      return 'Nobody has confirmed this quote is real.'
    case 'consent_withdrawn':
      return 'Consent has been withdrawn. This cannot be published.'
    case 'attribution_consent':
      return 'This names a person whose consent is not recorded as granted.'
    case 'client_consent':
      return 'This names a client whose consent is not recorded as granted.'
  }
}

/** Record a quote. Nothing that decides publication is on this form — see the module note. */
export async function createTestimonialAction(
  _previous: TestimonialActionState,
  form: FormData,
): Promise<TestimonialActionState> {
  try {
    const session = await requirePermission('content.write')

    const quote = text(form, 'quote')
    if (quote === null)
      return issue('A testimonial is a quote. Type what was said.', 'quote_required', 'quote')

    const client = await createClient()
    await withAudit(
      {
        action: 'content.testimonial.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'testimonials',
        summary: 'Recorded a testimonial',
      },
      async () =>
        insertTestimonial(client, {
          quote,
          attributedTo: text(form, 'attributed_to'),
          attributionRole: text(form, 'attribution_role'),
          projectId: uuid(form, 'project_id'),
          createdBy: session.userId,
        }),
    )

    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/**
 * Edit the quote, who said it and where it sits.
 *
 * IT DOES NOT TOUCH `consent`. Changing what a person is quoted as saying and recording that they
 * agreed to be quoted are different acts, and only one of them is owner-only. Keeping them in one
 * form would mean a hidden input could carry a consent alongside a typo correction.
 */
export async function saveTestimonialAction(
  _previous: TestimonialActionState,
  form: FormData,
): Promise<TestimonialActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That testimonial could not be identified.', 'id_missing')

    const quote = text(form, 'quote')
    if (quote === null)
      return issue('A testimonial is a quote. Type what was said.', 'quote_required', 'quote')

    const sortOrder = Number.parseInt(text(form, 'sort_order') ?? '', 10)
    const client = await createClient()
    await withAudit(
      {
        action: 'content.testimonial.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'testimonials',
        entityId: id,
      },
      async () =>
        updateTestimonialRow(client, id, {
          quote,
          attributed_to: text(form, 'attributed_to'),
          attribution_role: text(form, 'attribution_role'),
          ...(Number.isNaN(sortOrder) ? {} : { sort_order: sortOrder }),
          updated_by: session.userId,
        }),
    )

    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/**
 * Record what the person said about being quoted.
 *
 * `GRANTED` NEEDS `content.verify` AND A REFERENCE, exactly as a project's client consent does.
 * "Where is this recorded" is what makes a consent auditable a year later; without it, GRANTED is
 * an assertion with nothing behind it.
 *
 * AN ABSENT FIELD MEANS UNCHANGED, for the reason the project editor gives at length: a disabled
 * control posts nothing, and reading nothing as PENDING would quietly downgrade a recorded consent.
 */
export async function setTestimonialConsentAction(
  _previous: TestimonialActionState,
  form: FormData,
): Promise<TestimonialActionState> {
  try {
    const session = await requirePermission('content.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That testimonial could not be identified.', 'id_missing')

    const client = await createClient()
    const before = await getTestimonialById(client, id)

    const parsed = clientConsentStateSchema.safeParse(text(form, 'consent') ?? before.consent)
    if (!parsed.success) return issue('That is not a consent state.', 'consent_unknown')
    const consent = parsed.data

    const reference = text(form, 'consent_reference')
    if (consent === 'GRANTED') {
      await requirePermission('content.verify')
      if (reference === null) {
        return issue(
          'Record where the consent is held before marking it granted.',
          'consent_reference_required',
          'consent_reference',
        )
      }
    }

    await withAudit(
      {
        action: 'content.testimonial.consent',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'testimonials',
        entityId: id,
        summary: `Consent recorded as ${consent}`,
      },
      async () =>
        updateTestimonialRow(client, id, {
          consent,
          consent_reference: reference,
          updated_by: session.userId,
        }),
    )

    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/** The owner's confirmation that somebody really said this. `content.verify`: owner and admin. */
export async function setTestimonialVerificationAction(
  _previous: TestimonialActionState,
  form: FormData,
): Promise<TestimonialActionState> {
  try {
    const session = await requirePermission('content.verify')
    const id = uuid(form, 'id')
    if (id === null) return issue('That testimonial could not be identified.', 'id_missing')

    const target = text(form, 'owner_verification')
    if (target !== 'VERIFIED' && target !== 'OWNER_VERIFICATION_REQUIRED') {
      return issue('That is not a verification state.', 'verification_unknown')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'content.testimonial.verify',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'testimonials',
        entityId: id,
        summary: `Verification set to ${target}`,
      },
      async () =>
        updateTestimonialRow(client, id, {
          owner_verification: target,
          updated_by: session.userId,
        }),
    )

    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/** Publish the quote, or refuse and name the gate. A refusal writes a DENIED audit row. */
export async function publishTestimonialAction(
  _previous: TestimonialActionState,
  form: FormData,
): Promise<TestimonialActionState> {
  try {
    const session = await requirePermission('content.publish')
    const id = uuid(form, 'id')
    if (id === null) return issue('That testimonial could not be identified.', 'id_missing')

    const client = await createClient()
    const testimonial = await getTestimonialById(client, id)
    const unmet = unmetGates(testimonialPublishGates(testimonial))

    if (unmet.length > 0) {
      await writeAudit({
        action: 'content.testimonial.publish',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'testimonials',
        entityId: id,
        summary: `Publication refused: ${unmet.map((gate) => gate.id).join(', ')}`,
      })
      return {
        status: 'error',
        issues: unmet.map((gate) => ({
          field: 'publish',
          code: `gate_${gate.id}`,
          message: gateMessage(gate),
        })),
      }
    }

    await withAudit(
      {
        action: 'content.testimonial.publish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'testimonials',
        entityId: id,
      },
      async () =>
        updateTestimonialRow(client, id, {
          status: 'PUBLISHED',
          published_at: new Date().toISOString(),
          published_by: session.userId,
          updated_by: session.userId,
        }),
    )

    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

/** Take the quote off the site. No gate: see the project editor's note on why this never argues. */
export async function unpublishTestimonialAction(
  _previous: TestimonialActionState,
  form: FormData,
): Promise<TestimonialActionState> {
  try {
    const session = await requirePermission('content.publish')
    const id = uuid(form, 'id')
    if (id === null) return issue('That testimonial could not be identified.', 'id_missing')

    const client = await createClient()
    await withAudit(
      {
        action: 'content.testimonial.unpublish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'testimonials',
        entityId: id,
      },
      async () =>
        updateTestimonialRow(client, id, {
          status: 'DRAFT',
          published_at: null,
          published_by: null,
          updated_by: session.userId,
        }),
    )

    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error))
  }
}
