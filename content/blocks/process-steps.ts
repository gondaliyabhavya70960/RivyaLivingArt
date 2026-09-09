import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import { entryVerificationSchema } from '@/lib/cms/entry-visibility'

/**
 * Numbered stages, each with copy and a picture. SEED §10-10 and §16.
 *
 * PAYLOAD FAMILY: REPEATING ITEMS, like `category-grid`, but ORDERED — the number is the content,
 * not decoration, so the array's order is meaningful and the renderer must not sort it.
 *
 * The seven process families in the manifest (`process-studio`, `process-pigment`, `process-mould`,
 * `process-pour`, `process-cure`, `process-finish`, `process-timber`) are 79 assets between them,
 * which makes `/process` the best-covered surface on the site and this block the one most likely
 * to be filled first in Phase 09.
 */
const stepSchema = z.object({
  title: z.string(),
  body: z.string(),
  media_index: z.number().int().min(0).nullable(),
  /** Stable across reordering. Optional for the reason `category-grid`'s `key` is optional. */
  key: z.string().min(1).optional(),
  /**
   * A step that states what Rivya can physically do is a capability claim, and five of the
   * homepage's process statements are exactly that. Withheld until the owner confirms.
   */
  owner_verification: entryVerificationSchema,
})

const schema = z.object({
  steps: z.array(stepSchema),
  /** Show 01, 02, 03 beside each step. Off for a process that is not sequential. */
  numbered: z.boolean(),
  media: z
    .array(
      z.object({
        slot: z.literal('steps'),
        role: z.literal('GALLERY'),
        media_id: z.string().uuid(),
      }),
    )
    .optional(),
})

export type ProcessStepsPayload = z.infer<typeof schema>

export const processStepsBlock: BlockModule<ProcessStepsPayload> = {
  type: 'process-steps',
  state: 'BUILT',
  label: 'Process steps',
  description: 'Ordered stages, each with a heading, copy and an image.',
  /*
   * THE MEDIA FIELDS ARRIVED IN PHASE 12, FOR THE CHAPTER LAYOUT. A `/process` chapter is one
   * section carrying one stage of the process: its words are the section's own heading and body,
   * and its picture is the section's own media rather than an entry inside `steps`. Before this the
   * block could only hold a picture inside a repeating item, so a chapter had to duplicate its
   * heading into a step just to have somewhere to put the image — and the page rendered the same
   * sentence twice.
   */
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
  defaults: { steps: [], numbered: true, media: [] },
  payloadFields: [
    { name: 'numbered', kind: 'boolean', label: 'Number the steps' },
    {
      name: 'steps',
      kind: 'json',
      label: 'Steps',
      help: 'key, title, body and media_index for each step. The order of this list is the order on the page. Set owner_verification to OWNER_VERIFICATION_REQUIRED on a step that claims a capability not yet confirmed.',
    },
    {
      name: 'media',
      kind: 'json',
      label: 'Step images',
      help: 'One { slot: "steps", role: "GALLERY", media_id } per step image, in order.',
    },
  ],
  mediaSlots: [
    { id: 'steps', role: 'GALLERY', repeating: true, desktopRatio: '4:3', mobileRatio: '4:5' },
  ],
  entryArrays: ['steps'],
  /*
   * `chapter` IS A DIFFERENT SHAPE, NOT A DIFFERENT SKIN. `alternating` and `stacked` lay out a
   * LIST of steps inside one section; `chapter` is one section that IS one step, numbered by its
   * position among its siblings on the page. `/process` is seven of them; the homepage's process
   * band is one section holding five steps.
   */
  layoutVariants: ['alternating', 'stacked', 'chapter'],
  allowedPages: null,
}
