import { section } from './section'
import type { SeedModule } from './types'

/**
 * `/contact`, SEED §21–§22 — a hero, the contact details and the enquiry form schema.
 *
 * THE CONTACT DETAILS ARE SUPPLIED, NOT INVENTED, and that distinction is the whole reason they
 * may be seeded at all. §21 gives a phone number, a WhatsApp number and an email address under the
 * heading "Seed from supplied business information" — they come from the owner, through the
 * specification of record, rather than from the seed making something up. D10 forbids fabricating
 * business facts; it does not forbid recording ones the owner supplied.
 *
 * They are still `OWNER_VERIFICATION_REQUIRED`. A phone number transcribed from a document is a
 * claim about how to reach a real business, and the cost of it being wrong — an enquiry that goes
 * nowhere — is paid by a customer. The owner confirms it once and it publishes.
 *
 * THE LOCATION IS ABSENT, and that is not an oversight. §21 says "existing supplied Google Maps
 * destination" and supplies no link. A seeded map pin would be an invented address, which is
 * exactly what D10 names. The field is left null with a note saying what belongs there.
 *
 * THE FORM SCHEMA IS SEEDED AS DATA, NOT AS A BUILT FORM. §22 gives seven fields and eight enquiry
 * types; Phase 20 builds the form that renders them and the inquiry table it writes into. Seeding
 * the vocabulary now means the owner can rename "Enquiry Type" or add a ninth option before the
 * form exists, which is the point of putting it in the CMS rather than in a component.
 */

const PAGE = 'page:contact'

/** §22's seven fields, in its order. `(optional)` is the specification's own annotation. */
const FORM_FIELDS: readonly { label: string; required: boolean }[] = [
  { label: 'Name', required: true },
  { label: 'Phone', required: true },
  { label: 'Email', required: false },
  { label: 'City', required: true },
  { label: 'Enquiry Type', required: true },
  { label: 'Message', required: true },
  { label: 'Reference Upload', required: false },
]

/** §22's eight enquiry types, in its order. */
const ENQUIRY_TYPES = [
  'Large-Format Furniture',
  'Custom Furniture',
  '3D + Resin',
  'Wall / Statement Art',
  'Preservation',
  'Product Question',
  'General Enquiry',
  'Other',
] as const

export const contactSeed: SeedModule = {
  name: 'contact',
  description: 'The 3 sections of /contact: hero, contact details (§21) and the form schema (§22).',
  records: [
    section({
      page: PAGE,
      key: 'contact.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'CONTACT',
      heading: 'Tell us what you would like to create.',
      body: 'For product questions, custom commissions, large-format furniture or project enquiries, send us the details below or continue directly on WhatsApp.',
      fact: 'BRAND_COPY',
      layoutVariant: 'contained',
      payload: { is_video: false, autoplay: false, scrim: 30 },
    }),

    section({
      page: PAGE,
      key: 'contact.02.details',
      blockType: 'contact-details',
      position: 2,
      heading: 'Reach the studio.',
      fact: 'VERIFIED_BUSINESS_FACT',
      // Supplied by the owner through §21, and confirmed by them before it publishes. An enquiry
      // that goes to a wrong number is paid for by a customer.
      verify: true,
      payload: {
        phone: '+91 7096036250',
        whatsapp: '+91 7096036250',
        email: 'gondaliyabhavya70960@gmail.com',
        // §21 says "existing supplied Google Maps destination" and supplies none. Null rather than
        // a guessed address: a map pin the seed invented is exactly what D10 forbids.
        location_url: null,
        location_label: null,
      },
    }),

    section({
      page: PAGE,
      key: 'contact.03.form',
      blockType: 'contact-form',
      position: 3,
      heading: 'Send an enquiry.',
      // The rule this form exists under, stated where an editor will read it: the enquiry is
      // written to the database BEFORE any WhatsApp redirect, and a failed save never redirects.
      supporting: 'Your enquiry is saved first, then you continue the conversation on WhatsApp.',
      fact: 'EDITORIAL_COPY',
      payload: { fields: FORM_FIELDS, enquiry_types: ENQUIRY_TYPES },
    }),
  ],
}
