import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

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
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { steps: [], numbered: true },
  mediaSlots: [
    { id: 'steps', role: 'GALLERY', repeating: true, desktopRatio: '4:3', mobileRatio: '4:5' },
  ],
  layoutVariants: ['alternating', 'stacked'],
  allowedPages: null,
}
