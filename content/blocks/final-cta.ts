import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The closing conversion band. SEED §10-13.
 *
 * PAYLOAD FAMILY: NONE — two CTAs and a picture, all shared copy fields.
 *
 * ITS SECOND CTA IS NOT A WHATSAPP LINK, and the restraint is D1 rather than design. A chat opened
 * from here carries no enquiry, so it would have to use `buildDirectContactUrl` — which
 * `scripts/site/check-whatsapp-usage.mjs` permits only in the announcement bar, the footer and
 * `/contact`. The homepage's closing band sends a visitor to a form that persists an inquiry first;
 * that ordering is the business rule, not a preference.
 */
const schema = z.object({})

export type FinalCtaPayload = z.infer<typeof schema>

export const finalCtaBlock: BlockModule<FinalCtaPayload> = {
  type: 'final-cta',
  state: 'BUILT',
  label: 'Final call to action',
  description: 'The closing conversion band, with up to two calls to action over a wide image.',
  sharedFields: [
    'eyebrow',
    'heading',
    'body',
    'cta_label',
    'cta_url',
    'cta_secondary_label',
    'cta_secondary_url',
    'media_desktop_id',
    'media_mobile_id',
    'media_alt_override',
  ],
  schema,
  defaults: {},
  payloadFields: [],
  entryArrays: [],
  mediaSlots: [
    { id: 'band', role: 'DESKTOP', repeating: false, desktopRatio: '21:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['banded', 'centred'],
  allowedPages: null,
}
