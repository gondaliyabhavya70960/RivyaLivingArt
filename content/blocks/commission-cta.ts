import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import { entryVerificationSchema } from '@/lib/cms/entry-visibility'

/**
 * The commission band: an invitation, and the list of what can be specified. SEED §10-07.
 *
 * THE CAPABILITIES ARE OBJECTS, NOT STRINGS, and the change is what lets §10's rule be obeyed
 * precisely. "Only publish capabilities confirmed by owner" applied to a `string[]` can only be
 * enforced by withholding the whole band — which also withholds the heading and the CTA, neither
 * of which claims anything. As entries each carries its own flag, so the invitation publishes and
 * the six specifics wait.
 *
 * `label`, NOT `title`, because a capability is a chip rather than a card: it has no description,
 * no image and no destination. Calling it a title would invite a future editor to write a sentence
 * into it.
 */
const capabilitySchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  owner_verification: entryVerificationSchema,
})

const schema = z.object({
  capabilities: z.array(capabilitySchema),
})

export type CommissionCtaPayload = z.infer<typeof schema>

export const commissionCtaBlock: BlockModule<CommissionCtaPayload> = {
  type: 'commission-cta',
  state: 'BUILT',
  label: 'Commission call to action',
  description: 'The commission invitation, with the list of what a client can specify.',
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
  defaults: { capabilities: [] },
  payloadFields: [
    {
      name: 'capabilities',
      kind: 'json',
      label: 'What can be specified',
      help: 'key and label for each. Set owner_verification to OWNER_VERIFICATION_REQUIRED on a capability that is not yet confirmed and it stays off the public page.',
    },
  ],
  entryArrays: ['capabilities'],
  mediaSlots: [
    { id: 'scene', role: 'DESKTOP', repeating: false, desktopRatio: '3:2', mobileRatio: '4:5' },
  ],
  layoutVariants: ['split', 'banded'],
  allowedPages: null,
}
