import type { BlockModule } from '@/lib/cms/block-module'
import { contactDetailsSchema } from '@/lib/site/contact-details'

/**
 * Address, hours and channels from one section's payload. SEED §21.
 *
 * THE SCHEMA IS NOT DECLARED HERE, and that is the point of the file. `lib/site/contact-details.ts`
 * already owns it, because the footer's contact column and `/contact` both read the same row and
 * §21 says not to hardcode the number in several components. A second schema in this module would
 * be a second definition of what a phone number is, and the two would disagree the first time one
 * of them gained a field. This block imports the one that exists.
 *
 * IT IS THE EASIEST OF THE SEVEN PLANNED BLOCKS TO BUILD AND WAS THE LAST TO BE. `contactDetailsOf`
 * is a PURE FUNCTION OVER A `PageSection`, and a renderer is handed its own section — so the block
 * needs no selector, no reference resolution and no extra query. Both ends were built and the
 * middle was missing.
 *
 * NO VARIANT. A list of channels is a list of channels; the one thing an editor might want to
 * change about it — which channels appear — they change by filling in or clearing a field.
 */
export type ContactDetailsPayload = ReturnType<typeof contactDetailsSchema.parse>

export const contactDetailsBlock: BlockModule<ContactDetailsPayload> = {
  type: 'contact-details',
  state: 'BUILT',
  label: 'Contact details',
  description: 'Address, hours and channels from global content.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema: contactDetailsSchema,
  defaults: {
    phone: null,
    whatsapp: null,
    email: null,
    location_url: null,
    location_label: null,
  },
  payloadFields: [
    { name: 'phone', kind: 'text', label: 'Phone' },
    { name: 'whatsapp', kind: 'text', label: 'WhatsApp number' },
    { name: 'email', kind: 'text', label: 'Email' },
    {
      name: 'location_url',
      kind: 'text',
      label: 'Map link',
      help: 'Both this and the label must be filled for the location to appear: a label with no link is not a link.',
    },
    { name: 'location_label', kind: 'text', label: 'Location label' },
  ],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: [],
  allowedPages: null,
}
