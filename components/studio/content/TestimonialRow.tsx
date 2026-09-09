'use client'

import * as React from 'react'
import { useActionState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { SelectField, TextAreaField, TextField, errorFor } from '@/components/studio/FormField'
import { DemoPill } from '@/components/studio/StatusPill'
import { OwnerVerificationPanel } from '@/components/studio/OwnerVerificationPanel'
import { t } from '@/components/studio/strings'
import { testimonialPublishGates } from '@/lib/portfolio/gates'

import { IDLE_FORM_STATE, formIssues, type StudioFormAction } from '../form-state'

/**
 * One testimonial, with everything that can be done to it.
 *
 * FOUR FORMS, NOT ONE, and the split is the same one the project editor makes: editing the quote,
 * recording consent, confirming the quote is real, and putting it on the site are four different
 * acts with three different permissions between them. A single form would let a hidden input carry
 * a consent alongside a typo correction — and consent is the one field on this screen that decides
 * whether a named person appears on a public website.
 *
 * THE GATES ARE SHOWN BEFORE PUBLISH IS PRESSED. `OwnerVerificationPanel` reads the same pure mirror
 * of the trigger that the publish action recomputes server-side, so what it says here is what the
 * database will do rather than a second opinion about it.
 *
 * NO DELETE. Nothing in this phase asks for one, and a quote somebody gave is not a thing to remove
 * casually: withdrawing consent archives it, which is the exit that leaves a record behind.
 */

export interface TestimonialRowData {
  readonly id: string
  readonly quote: string
  readonly attributedTo: string | null
  readonly attributionRole: string | null
  readonly consent: string
  readonly consentReference: string | null
  readonly ownerVerification: string
  readonly status: string
  readonly sortOrder: number
  /** Placeholder content the owner authorised; see docs/content/DEMO_CONTENT.md. */
  readonly isDemo: boolean
}

export interface TestimonialRowProps {
  readonly row: TestimonialRowData
  readonly consentOptions: readonly { readonly value: string; readonly label: string }[]
  readonly canWrite: boolean
  readonly canVerify: boolean
  readonly canPublish: boolean
  readonly saveAction: StudioFormAction
  readonly consentAction: StudioFormAction
  readonly verifyAction: StudioFormAction
  readonly publishAction: StudioFormAction
  readonly unpublishAction: StudioFormAction
}

export function TestimonialRow({
  row,
  consentOptions,
  canWrite,
  canVerify,
  canPublish,
  saveAction,
  consentAction,
  verifyAction,
  publishAction,
  unpublishAction,
}: TestimonialRowProps): React.ReactElement {
  const [saveState, save, saving] = useActionState(saveAction, IDLE_FORM_STATE)
  const [consentState, setConsent, consenting] = useActionState(consentAction, IDLE_FORM_STATE)
  const [verifyState, verify, verifying] = useActionState(verifyAction, IDLE_FORM_STATE)

  const isPublished = row.status === 'PUBLISHED'
  const [publishState, publish, publishing] = useActionState(
    isPublished ? unpublishAction : publishAction,
    IDLE_FORM_STATE,
  )

  const saveIssues = formIssues(saveState)
  const consentIssues = formIssues(consentState)
  const verified = row.ownerVerification === 'VERIFIED'
  const publishIssues = publishState.status === 'error' ? publishState.issues : []
  const rowError = errorFor(formIssues(verifyState), '_form')

  return (
    <li className="border-b border-line py-6" data-testimonial={row.id}>
      <Stack gap={4}>
        {/*
          The badge before the gate panel, not after. A reader deciding whether to act on a
          verification warning needs to know first whether the row is real.
        */}
        <DemoPill isDemo={row.isDemo} />
        <OwnerVerificationPanel
          gates={testimonialPublishGates({
            owner_verification: row.ownerVerification,
            attributed_to: row.attributedTo,
            consent: row.consent,
          })}
        />

        <form action={save} className="grid max-w-2xl gap-4">
          <input type="hidden" name="id" value={row.id} />
          <TextAreaField
            name="quote"
            label={t('studio.testimonials.quoteLabel')}
            help={t('studio.testimonials.quoteHelp')}
            defaultValue={row.quote}
            issues={saveIssues}
          />
          <TextField
            name="attributed_to"
            label={t('studio.testimonials.attributedLabel')}
            help={t('studio.testimonials.attributedHelp')}
            defaultValue={row.attributedTo ?? ''}
            issues={saveIssues}
          />
          <TextField
            name="attribution_role"
            label={t('studio.testimonials.roleLabel')}
            defaultValue={row.attributionRole ?? ''}
            issues={saveIssues}
          />
          <TextField
            name="sort_order"
            label={t('studio.testimonials.orderLabel')}
            defaultValue={String(row.sortOrder)}
            issues={saveIssues}
          />
          <div>
            <Button type="submit" disabled={!canWrite || saving}>
              {t('studio.testimonials.save')}
            </Button>
          </div>
        </form>

        <form action={setConsent} className="grid max-w-2xl gap-4">
          <input type="hidden" name="id" value={row.id} />
          <SelectField
            name="consent"
            label={t('studio.testimonials.consentLabel')}
            defaultValue={row.consent}
            issues={consentIssues}
            options={[...consentOptions]}
          />
          <TextField
            name="consent_reference"
            label={t('studio.testimonials.consentRefLabel')}
            help={t('studio.testimonials.consentRefHelp')}
            defaultValue={row.consentReference ?? ''}
            issues={consentIssues}
          />
          <div>
            <Button type="submit" disabled={!canWrite || consenting}>
              {t('studio.testimonials.consentSave')}
            </Button>
          </div>
        </form>

        {canVerify ? (
          <form action={verify}>
            <input type="hidden" name="id" value={row.id} />
            {/* The value is the state being asked for, never a toggle computed from this render. */}
            <Button
              type="submit"
              name="owner_verification"
              value={verified ? 'OWNER_VERIFICATION_REQUIRED' : 'VERIFIED'}
              variant={verified ? 'secondary' : 'primary'}
              disabled={verifying}
            >
              {verified ? t('studio.testimonials.verifyClear') : t('studio.testimonials.verifySet')}
            </Button>
          </form>
        ) : null}

        {canPublish ? (
          <Stack gap={2}>
            <form action={publish}>
              <input type="hidden" name="id" value={row.id} />
              <Button
                type="submit"
                variant={isPublished ? 'secondary' : 'primary'}
                disabled={publishing}
              >
                {isPublished
                  ? t('studio.testimonials.unpublish')
                  : t('studio.testimonials.publish')}
              </Button>
            </form>
            {publishIssues.length === 0 ? null : (
              <ul role="list" data-publish-refused="">
                {publishIssues.map((issue) => (
                  <li key={issue.code}>
                    <Text size="sm" tone="secondary">
                      {issue.message}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
          </Stack>
        ) : null}

        {rowError === undefined ? null : (
          <Text size="sm" tone="secondary" data-form-error="">
            {rowError}
          </Text>
        )}
      </Stack>
    </li>
  )
}
