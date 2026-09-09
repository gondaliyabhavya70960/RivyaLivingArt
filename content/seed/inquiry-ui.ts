import type { SeedModule, SeedRecord } from './types'

/**
 * The words the enquiry form's own controls use.
 *
 * A MODULE OF ITS OWN, following `configurator-ui.ts` and its three siblings. Not one of these
 * sentences is quoted from the specification: SEED §22 names the FIELDS a contact form asks for —
 * "Name", "Phone", "City" — and says nothing about what a label, a placeholder or a success control
 * should say. D2 leaves no room for typing them into JSX, and `scripts/cms/check-section-copy.ts`
 * fails the build over it.
 *
 * THE FIELD NAMES ARE §22's, VERBATIM, and that is deliberate rather than lazy: an owner reading
 * the specification and the form side by side should see the same six words.
 *
 * THE SUCCESS AND ERROR SENTENCES ARE NOT HERE. §48's heading and body and §49's three errors were
 * seeded in Phase 09 under `FORM_COPY`, and restating them would create two rows saying the same
 * thing, one of which goes stale. Only the ONE §49 case Phase 09 did not anticipate is added below:
 * a submission refused by the rate limit, which §49 has no sentence for because Phase 09 had no
 * rate limit.
 *
 * NOTHING HERE MENTIONS PRICE, COST, QUOTE OR ESTIMATE. `tests/unit/no-pricing.test.ts` reads this
 * file among others, and the submit label is `CTA.send_an_enquiry`, already seeded — the site's
 * action vocabulary has one copy.
 *
 * EVERY ROW IS `EDITORIAL_COPY` / `NOT_REQUIRED` AND SEEDS PUBLISHED. They name controls; a field
 * with no label is not a field, and gating the enquiry form behind owner verification would make
 * the site's only conversion path unusable while telling the owner nothing they could act on.
 */

function uiRow(key: string, value: string, label: string, description: string): SeedRecord {
  return {
    seedKey: `global:UI_LABEL.${key}`,
    table: 'global_content',
    fields: {
      group_key: 'UI_LABEL',
      key,
      label,
      value,
      description,
      is_enabled: true,
      status: 'PUBLISHED',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
}

function formRow(key: string, value: string, label: string, description: string): SeedRecord {
  return {
    seedKey: `global:FORM_COPY.${key}`,
    table: 'global_content',
    fields: {
      group_key: 'FORM_COPY',
      key,
      label,
      value,
      description,
      is_enabled: true,
      status: 'PUBLISHED',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
}

export const inquiryUiSeed: SeedModule = {
  name: 'inquiry-ui',
  description:
    'Phase 20 enquiry form chrome: the six SEED §22 field labels and the handoff controls.',
  records: [
    uiRow('inquiry.name', 'Name', 'Enquiry form — name', 'SEED §22 field name, verbatim.'),
    uiRow('inquiry.phone', 'Phone', 'Enquiry form — phone', 'SEED §22 field name, verbatim.'),
    uiRow(
      'inquiry.email',
      'Email',
      'Enquiry form — email',
      'SEED §22 field name, verbatim. Optional: a customer who gives a number has given enough.',
    ),
    uiRow('inquiry.city', 'City', 'Enquiry form — city', 'SEED §22 field name, verbatim.'),
    uiRow(
      'inquiry.enquiry_type',
      'Enquiry Type',
      'Enquiry form — enquiry type',
      'SEED §22 field name, verbatim. The options are the section payload, not this row: the list is editorial.',
    ),
    uiRow('inquiry.message', 'Message', 'Enquiry form — message', 'SEED §22 field name, verbatim.'),
    uiRow(
      'inquiry.required',
      'Required',
      'Enquiry form — required marker',
      'The word beside a field that must be answered. A marker with no word is a symbol a screen reader cannot explain.',
    ),
    uiRow(
      'inquiry.reference',
      'Your reference is {{code}}. Quote it if you get in touch again.',
      'Enquiry form — reference code',
      'Shown after a successful save. A whole sentence with a placeholder rather than a label and a value glued together in JSX, so it can be reworded or reordered.',
    ),
    uiRow(
      'inquiry.continue',
      'Continue to WhatsApp',
      'Enquiry form — continue to WhatsApp',
      'The control on the success state. Never shown unless the enquiry was saved and a number resolved.',
    ),
    uiRow(
      'inquiry.no_whatsapp',
      'Your enquiry is saved. The studio will be in touch; the contact details below reach them directly.',
      'Enquiry form — saved with no WhatsApp link',
      'Shown when the enquiry saved and no WhatsApp number resolved. The saved enquiry is the outcome that matters, so this says so instead of showing a dead link.',
    ),
    uiRow(
      'inquiry.sending',
      'Sending…',
      'Enquiry form — in progress',
      'The submit control while the enquiry is being written. Named so the button does not simply go quiet.',
    ),
    formRow(
      'error.too_many',
      'That is several enquiries from this connection in a short time. Please try again later, or reach the studio directly.',
      'Form error — too many enquiries',
      'The one SEED §49 case Phase 09 could not anticipate: Phase 20 added a per-address rate limit, and a refusal a visitor cannot explain is worse than one they can.',
    ),
  ],
}
