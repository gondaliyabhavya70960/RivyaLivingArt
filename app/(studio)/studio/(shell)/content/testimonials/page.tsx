import { Button } from '@/components/primitives/Button'
import { Divider } from '@/components/primitives/Divider'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { TextAreaField, TextField } from '@/components/studio/FormField'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { TestimonialRow } from '@/components/studio/content/TestimonialRow'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { listTestimonialsForStudio } from '@/lib/supabase/repositories/testimonials'
import { clientConsentStateSchema } from '@/lib/supabase/schemas'
import { createClient } from '@/lib/supabase/server'

import {
  createTestimonialAction,
  publishTestimonialAction,
  saveTestimonialAction,
  setTestimonialConsentAction,
  setTestimonialVerificationAction,
  unpublishTestimonialAction,
} from './actions'

/**
 * /studio/content/testimonials — quotes from real people, of which there are none yet.
 *
 * THERE IS A CREATE FORM ON THIS SCREEN, AND AN EARLIER VERSION DELIBERATELY HAD NONE. The reasoning
 * then was that D10 names testimonials outright, that a quote written in-house is the plainest kind
 * of fabricated evidence, and that the surest prevention is to give nobody a box to type one into.
 *
 * That was the wrong place for the guard. It prevented nothing — a fabricated quote is refused at
 * publication by `enforce_testimonial_evidence_gate`, whoever typed it and however it arrived —
 * while making it impossible to record a REAL quote through the Studio at all, which left the
 * surface permanently unusable for its actual purpose. The gates are the guard: `consent` defaults
 * to PENDING, `owner_verification` to OWNER_VERIFICATION_REQUIRED, and a quote naming somebody
 * cannot go public until that person's agreement is recorded with a reference to where it is held.
 *
 * THE EMPTY STATE STILL EXPLAINS ITSELF rather than reading as a missing feature: an empty
 * testimonials table is the correct condition of a business that has not collected any.
 *
 * `consent` DEFAULTS TO PENDING HERE, NOT NOT_APPLICABLE, because a quote always came from someone.
 * A project may legitimately name nobody; a testimonial always has an author, even an unnamed one.
 */
export const metadata = studioMetadata('/studio/content/testimonials')

/** The consent vocabulary, in the schema's own order, with the words an editor reads. */
const CONSENT_OPTIONS = clientConsentStateSchema.options.map((value) => ({
  value,
  label: t(`studio.portfolio.consent.${value}`),
}))

export default async function Page() {
  const session = await requirePermission('content.read')
  const testimonials = await listTestimonialsForStudio(await createClient())

  const canWrite = roleHasPermission(session.role, 'content.write')
  const canVerify = roleHasPermission(session.role, 'content.verify')
  const canPublish = roleHasPermission(session.role, 'content.publish')

  return (
    <StudioPage path="/studio/content/testimonials">
      <Stack gap={8}>
        <Text size="sm" tone="secondary">
          {t('studio.testimonials.caption')}
        </Text>

        {testimonials.length === 0 ? (
          <Stack gap={2} data-empty="">
            <PageHeader level={2} title={t('studio.testimonials.emptyHeading')} />
            <Text size="sm" tone="secondary">
              {t('studio.testimonials.emptyBody')}
            </Text>
          </Stack>
        ) : (
          <ul role="list">
            {testimonials.map((row) => (
              <TestimonialRow
                key={row.id}
                row={{
                  id: row.id,
                  quote: row.quote,
                  attributedTo: row.attributed_to,
                  attributionRole: row.attribution_role,
                  consent: row.consent,
                  consentReference: row.consent_reference,
                  ownerVerification: row.owner_verification,
                  status: row.status,
                  sortOrder: row.sort_order,
                }}
                consentOptions={CONSENT_OPTIONS}
                canWrite={canWrite}
                canVerify={canVerify}
                canPublish={canPublish}
                saveAction={saveTestimonialAction}
                consentAction={setTestimonialConsentAction}
                verifyAction={setTestimonialVerificationAction}
                publishAction={publishTestimonialAction}
                unpublishAction={unpublishTestimonialAction}
              />
            ))}
          </ul>
        )}

        {canWrite ? (
          <>
            <Divider />
            <Stack gap={3}>
              <PageHeader level={2} title={t('studio.testimonials.newHeading')} />
              <HelpText>{t('studio.testimonials.newHelp')}</HelpText>
              <ActionForm action={createTestimonialAction} className="grid max-w-2xl gap-4">
                <TextAreaField
                  name="quote"
                  label={t('studio.testimonials.quoteLabel')}
                  help={t('studio.testimonials.quoteHelp')}
                  required
                  requiredLabel={t('studio.testimonials.requiredLabel')}
                />
                <TextField
                  name="attributed_to"
                  label={t('studio.testimonials.attributedLabel')}
                  help={t('studio.testimonials.attributedHelp')}
                />
                <TextField name="attribution_role" label={t('studio.testimonials.roleLabel')} />
                <div>
                  <Button type="submit">{t('studio.testimonials.newSubmit')}</Button>
                </div>
              </ActionForm>
            </Stack>
          </>
        ) : null}
      </Stack>
    </StudioPage>
  )
}
