import dynamic from 'next/dynamic'
import * as React from 'react'

import type { ConfiguratorCopy, UploadLimits } from '@/components/patterns/Configurator'
import { visibleSteps } from '@/lib/cms/forms'
import { siteStringOrEmpty } from '@/lib/cms/strings'

import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Mounts the bespoke brief on `/custom-commissions`.
 *
 * IT RENDERS NOTHING UNLESS THREE THINGS ARE TRUE, and the renderer cannot tell which one failed
 * because it is not given that information. `lib/cms/references.ts` resolves the band to a form or
 * to null: null covers the flag being off, the named form not existing, and the form existing but
 * unpublished. Three different facts, one correct behaviour — and distinguishing them on the public
 * page would publish the studio's release schedule.
 *
 * THE FLAG SHIPS OFF, so today this is always null and `/custom-commissions` keeps the six Phase 09
 * sections it has had since the seed. That is the phase document's out-of-scope section working as
 * written: the configurator collects a brief and Phase 20 persists it, so between the two a visitor
 * who completed eleven steps would press a button that saved nothing. D1 is explicit that the save
 * comes first.
 *
 * EVERY WORD IT PASSES ACROSS THE CLIENT BOUNDARY IS RESOLVED HERE. `Configurator` is a Client
 * Component and cannot read `global_content`; handing it a `SiteStrings` map would work and would
 * also hand it every string on the site. It gets the fifteen it uses, already resolved, so the
 * boundary carries the copy the form needs and nothing else.
 *
 * THE SUBMIT LABEL COMES FROM THE FORM, NOT FROM THIS FILE. `customization_forms.submit_label_key`
 * names a `global_content` row — `CTA.send_an_enquiry` on all three templates — so the site's action
 * vocabulary has one copy and an owner changing the verb changes it everywhere at once.
 */

/**
 * LOADED ON DEMAND, AND THE GATE IS WHAT FOUND THIS.
 *
 * `components/sections/registry.ts` statically imports every renderer, so a Client Component
 * imported statically from this file joins the HOMEPAGE bundle — a page that will never render a
 * configurator. `scripts/site/check-island-budget.mjs` reported a sixth island against a budget of
 * five and named this file, which is the whole reason that gate exists.
 *
 * `allowedPages: ['/custom-commissions']` on the block is a Studio restriction; it constrains what
 * an editor can add to a page and says nothing about the import graph. `next/dynamic` is what makes
 * the restriction true of the bundle as well. The band's own copy stays server-rendered — only the
 * interactive form is deferred, and only on the one page that mounts it.
 */
const Configurator = dynamic(
  async () => (await import('@/components/patterns/Configurator')).Configurator,
)

/** What `app/api/inquiries/upload-sign` enforces. Stated once, echoed into the hint the visitor reads. */
const UPLOAD_LIMITS: UploadLimits = { maxFiles: 5, maxBytes: 10 * 1024 * 1024 }

export function CommissionConfiguratorSection({
  section,
  strings,
  reference,
}: SectionRenderProps): React.ReactElement | null {
  const form = reference?.configurator
  if (form === undefined || form === null) return null

  const steps = visibleSteps(form)
  // A published form always has an enabled contact step — `enforce_form_publishable()` refuses
  // otherwise — so an empty list here means the band is pointing at something that changed
  // underneath it. Nothing to draw is the honest response.
  if (steps.length === 0) return null

  const copy: ConfiguratorCopy = {
    progress: siteStringOrEmpty(strings, 'UI_LABEL.configurator.progress'),
    progressLabel: siteStringOrEmpty(strings, 'UI_LABEL.configurator.progress.label'),
    next: siteStringOrEmpty(strings, 'UI_LABEL.configurator.next'),
    back: siteStringOrEmpty(strings, 'UI_LABEL.configurator.back'),
    review: siteStringOrEmpty(strings, 'UI_LABEL.configurator.review'),
    reviewEdit: siteStringOrEmpty(strings, 'UI_LABEL.configurator.review.edit'),
    reviewEmpty: siteStringOrEmpty(strings, 'UI_LABEL.configurator.review.empty'),
    optional: siteStringOrEmpty(strings, 'UI_LABEL.configurator.optional'),
    required: siteStringOrEmpty(strings, 'UI_LABEL.configurator.required'),
    uploadChoose: siteStringOrEmpty(strings, 'UI_LABEL.configurator.upload.choose'),
    uploadHint: siteStringOrEmpty(strings, 'UI_LABEL.configurator.upload.hint'),
    uploadRemove: siteStringOrEmpty(strings, 'UI_LABEL.configurator.upload.remove'),
    uploading: siteStringOrEmpty(strings, 'UI_LABEL.configurator.upload.uploading'),
    saved: siteStringOrEmpty(strings, 'UI_LABEL.configurator.saved'),
    stepErrors: siteStringOrEmpty(strings, 'UI_LABEL.configurator.step.errors'),
    // SEED §49's upload error, already seeded by Phase 09. Not restated: two rows saying the same
    // thing means one of them goes stale.
    uploadError: siteStringOrEmpty(strings, 'FORM_COPY.error.upload'),
    submit: siteStringOrEmpty(strings, form.form.submit_label_key ?? ''),
  }

  return (
    <SectionShell section={section}>
      <SectionCopy section={section} />
      <Configurator
        definition={{
          formId: form.form.id,
          slug: form.form.slug,
          introHeading: form.form.intro_heading,
          introBody: form.form.intro_body,
          steps,
        }}
        form={{ form: form.form, steps }}
        copy={copy}
        uploadLimits={UPLOAD_LIMITS}
        // From `?product=`, resolved server-side to a real row. Empty when no product was named or
        // its category has no §15 starting point — never a nearest-match.
        prefill={reference?.prefill}
      />
    </SectionShell>
  )
}
