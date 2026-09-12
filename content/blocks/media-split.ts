import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * An image beside copy, either way round.
 *
 * PAYLOAD FAMILY: NONE. The picture is the shared desktop/mobile pair and the words are the shared
 * copy fields, so there is nothing block-specific to hold.
 *
 * HOW IT DIFFERS FROM `manifesto`, which has the same shape and the same variants. A manifesto is
 * the brand statement: one per page at most, `display-lg` type, a 4:5 portrait beside it, and the
 * homepage's is withheld whole until the owner confirms the claim it makes. This is the general
 * case — a band an editor reaches for whenever a picture belongs next to a paragraph, at ordinary
 * heading scale and a landscape ratio, as many times on a page as the page needs. Building one out
 * of the other would mean either a manifesto that is no longer the manifesto, or a general-purpose
 * band that inherits a specific band's type scale.
 *
 * THE VARIANT MOVES THE PICTURE, NOT THE ORDER OF THE MARKUP, exactly as `manifesto` does: the
 * columns reorder with `order-2` at the grid breakpoint and the DOM is left alone, so a screen
 * reader and a keyboard meet the copy first at every width. Visual arrangement is art direction;
 * reading order is meaning.
 *
 * AN ABSENT ASSET DOES NOT STOP IT RENDERING and absent copy does. `ResponsiveMedia` draws its
 * reserved box with the seeded fallback label when nothing resolves — the layout was sized for it —
 * but a split with no words is a picture with a column of nothing beside it.
 */
const schema = z.object({})

export type MediaSplitPayload = z.infer<typeof schema>

export const mediaSplitBlock: BlockModule<MediaSplitPayload> = {
  type: 'media-split',
  state: 'BUILT',
  label: 'Media split',
  description: 'An image beside copy, either way round.',
  sharedFields: [
    'eyebrow',
    'heading',
    'heading_highlight',
    'body',
    'supporting',
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
    { id: 'split', role: 'DESKTOP', repeating: false, desktopRatio: '4:3', mobileRatio: '4:5' },
  ],
  layoutVariants: ['image-right', 'image-left'],
  allowedPages: null,
}
