import dynamic from 'next/dynamic'
import * as React from 'react'

import type { InquiryCopy } from '@/components/patterns/InquiryForm/types'
import { contactFormBlock } from '@/content/blocks/contact-form'
import { siteStringOrEmpty } from '@/lib/cms/strings'

import { submitInquiry } from '@/app/(site)/_actions/submit-inquiry'

import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Mounts the general enquiry form — the site's one conversion path that is not a bespoke brief.
 *
 * LOADED ON DEMAND, for the reason the configurator is. `components/sections/registry.ts` imports
 * every renderer statically, so a Client Component imported statically from this file would join
 * the HOMEPAGE bundle — a page that has no enquiry form on it today and may have one tomorrow.
 * `scripts/site/check-island-budget.mjs` is what would notice, and this is what stops it having to.
 *
 * EVERY WORD IT PASSES ACROSS THE CLIENT BOUNDARY IS RESOLVED HERE. `InquiryForm` cannot read
 * `global_content`; handing it a `SiteStrings` map would work and would also hand it every string
 * on the site. It gets the sixteen it uses, already resolved.
 *
 * THE SUBMIT LABEL IS `CTA.send_an_enquiry`, seeded in Phase 09 and shared with the configurator,
 * so the site's action vocabulary has one copy and an owner changing the verb changes it in both.
 */
const InquiryForm = dynamic(
  async () => (await import('@/components/patterns/InquiryForm')).InquiryForm,
)

export function ContactFormSection({
  section,
  strings,
}: SectionRenderProps): React.ReactElement | null {
  const parsed = contactFormBlock.schema.safeParse(section.payload)
  // A malformed payload renders the band's copy and no form rather than nothing at all: the
  // heading and body are the editor's words and are still true, and a form is not the only way to
  // reach the studio — the contact details are on the same page.
  const enquiryTypes = parsed.success ? parsed.data.enquiry_types : []

  const copy: InquiryCopy = {
    name: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.name'),
    phone: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.phone'),
    email: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.email'),
    city: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.city'),
    enquiryType: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.enquiry_type'),
    message: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.message'),
    required: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.required'),
    submit: siteStringOrEmpty(strings, 'CTA.send_an_enquiry'),
    sending: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.sending'),
    successHeading: siteStringOrEmpty(strings, 'FORM_COPY.inquiry_success.heading'),
    successBody: siteStringOrEmpty(strings, 'FORM_COPY.inquiry_success.body'),
    reference: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.reference'),
    continueToWhatsApp: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.continue'),
    savedWithoutWhatsApp: siteStringOrEmpty(strings, 'UI_LABEL.inquiry.no_whatsapp'),
    errorGeneric: siteStringOrEmpty(strings, 'FORM_COPY.error.generic'),
    errorSave: siteStringOrEmpty(strings, 'FORM_COPY.error.inquiry_save'),
    errorTooMany: siteStringOrEmpty(strings, 'FORM_COPY.error.too_many'),
  }

  return (
    <SectionShell section={section}>
      <SectionCopy section={section} />
      <InquiryForm kind="GENERAL" copy={copy} enquiryTypes={enquiryTypes} action={submitInquiry} />
    </SectionShell>
  )
}
