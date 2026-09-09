import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The framing paragraph above a page's categories. SEED §12-02.
 *
 * PAYLOAD FAMILY: NONE. It is a heading, a paragraph and one supporting picture — every one of them
 * a shared field. `manifesto` and `scale-statement` are the same shape, and the repetition is the
 * point: a block earns a payload only when it holds something the shared fields cannot express.
 *
 * IT IS NOT A `statement`, THOUGH IT LOOKS LIKE ONE. The difference is where it sits and what
 * follows it: a category intro introduces the list beneath it, so it renders tighter to what comes
 * next and never centres. Keeping them separate is what lets the two change independently — and a
 * `statement` on `/about` should not shift because a category page wanted more air.
 */
const schema = z.object({})

export type CategoryIntroPayload = z.infer<typeof schema>

export const categoryIntroBlock: BlockModule<CategoryIntroPayload> = {
  type: 'category-intro',
  state: 'BUILT',
  label: 'Category introduction',
  description: 'The framing paragraph that introduces a page of categories.',
  sharedFields: [
    'eyebrow',
    'heading',
    'body',
    'media_desktop_id',
    'media_mobile_id',
    'media_alt_override',
  ],
  schema,
  defaults: {},
  payloadFields: [],
  entryArrays: [],
  mediaSlots: [
    { id: 'intro', role: 'DESKTOP', repeating: false, desktopRatio: '16:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['left', 'centred'],
  allowedPages: null,
}
