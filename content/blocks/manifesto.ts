import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The brand statement band. SEED §10-02.
 *
 * PAYLOAD FAMILY: NONE. Every word it shows is a shared copy field, which is why the schema is an
 * empty object rather than an empty-ish one with a key nobody writes. `sharedFields` is the whole
 * contract, and `divider` proves the degenerate case is legitimate.
 *
 * IT IS THE ONE HOMEPAGE SECTION WITHHELD WHOLE ALONGSIDE 08, and the reason is that the claim is
 * the section: its body states that Rivya combines resin with wood, digitally developed structures
 * and careful finishing. There is no entry to flag — the sentence is the band — so the section
 * carries `owner_verification` and the Phase 08 publish trigger refuses it until the owner
 * confirms. SEED §10 classifies the copy `DRAFT_MARKETING_COPY`; the flag is this project's own
 * D10 rule applied to a capability claim, and the two are different columns.
 */
const schema = z.object({})

export type ManifestoPayload = z.infer<typeof schema>

export const manifestoBlock: BlockModule<ManifestoPayload> = {
  type: 'manifesto',
  state: 'BUILT',
  label: 'Manifesto',
  description: 'The brand statement band with a supporting image.',
  sharedFields: [
    'eyebrow',
    'heading',
    'body',
    'cta_label',
    'cta_url',
    'media_desktop_id',
    'media_mobile_id',
    'media_alt_override',
  ],
  schema,
  defaults: {},
  payloadFields: [],
  entryArrays: [],
  mediaSlots: [
    { id: 'portrait', role: 'DESKTOP', repeating: false, desktopRatio: '4:5', mobileRatio: '4:5' },
  ],
  layoutVariants: ['image-right', 'image-left', 'centred'],
  allowedPages: null,
}
