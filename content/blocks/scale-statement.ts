import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * A statement about scale, carried by one wide picture. SEED §11-03.
 *
 * PAYLOAD FAMILY: NONE. Everything it shows is a shared copy field and the desktop/mobile media
 * pair, which is why the schema is an empty object rather than an empty-ish one with a key nobody
 * writes. `manifesto` and `divider` prove the same degenerate case.
 *
 * IT IS THE SITE'S ONE LEGITIMATE 21:9 CROP AT EDITORIAL SCALE, and the ratio is the argument: the
 * section says Rivya works "from intimate objects to room-defining pieces", and a wide frame is
 * what room-defining looks like on a page. The four 21:9 assets in `material-macro` are MATERIAL
 * macros rather than furniture shots, deliberately — a wide photograph of a finished table beside
 * that sentence would read as a delivered piece, which is a claim nobody has made.
 *
 * THE MOBILE CROP IS A SEPARATE ASSET, NEVER A CSS CROP OF THE WIDE ONE. D6 states the rule and
 * this block is where it bites hardest: 21:9 squeezed into a phone's width is 40 pixels of
 * letterbox, so `media_mobile_id` carries a 4:5 frame of its own and `ResponsiveMedia` chooses
 * between them at 768px.
 *
 * AS SEEDED IT IS WITHHELD WHOLE. §11 marks it, and the phase document agrees: the body states
 * that the studio's primary direction is large-format functional art and that it also makes
 * smaller preservation and personalised pieces. Both halves are capability claims, and the claim
 * is the paragraph rather than an item inside it — so the flag sits on the section and the Phase 08
 * publish trigger refuses the row until the owner confirms.
 */
const schema = z.object({})

export type ScaleStatementPayload = z.infer<typeof schema>

export const scaleStatementBlock: BlockModule<ScaleStatementPayload> = {
  type: 'scale-statement',
  state: 'BUILT',
  label: 'Scale statement',
  description: 'A statement about the range of scale Rivya works at, over one wide image.',
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
    { id: 'scale', role: 'DESKTOP', repeating: false, desktopRatio: '21:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['image-above', 'image-below'],
  allowedPages: null,
}
