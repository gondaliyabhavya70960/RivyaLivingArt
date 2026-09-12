import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import { entryVerificationSchema } from '@/lib/cms/entry-visibility'

/**
 * Steps without media — the lighter sibling of `process-steps`.
 *
 * PAYLOAD FAMILY: REPEATING ITEMS, ORDERED. The number is the content rather than decoration, so
 * nothing here sorts and the renderer emits an `<ol>`: a screen reader announcing "list, 4 items"
 * carries meaning a visual numeral cannot.
 *
 * WHY IT IS NOT `process-steps` WITH THE PICTURES LEFT OUT. That block carries a repeating GALLERY
 * media slot, a `media_index` per step and a `chapter` variant in which one section IS one stage of
 * `/process`. A "how a commission works" list on `/custom-commissions` wants none of that, and
 * offering it means an editor choosing `media_index` values for a block that shows no media. The
 * schemas differ by exactly what each one can honour, which is the rule the whole catalogue follows.
 *
 * WITHHELD STEPS ARE REMOVED BEFORE NUMBERING, as in `process-steps`, and for the same reason: a
 * visible sequence reading 01, 03, 06 tells a visitor something is missing and invites them to
 * wonder what.
 */
const stepSchema = z.object({
  title: z.string(),
  body: z.string(),
  /** Stable across reordering. Optional for the reason `category-grid`'s `key` is optional. */
  key: z.string().min(1).optional(),
  owner_verification: entryVerificationSchema,
})

const schema = z.object({
  steps: z.array(stepSchema),
})

export type NumberedStepsPayload = z.infer<typeof schema>

export const numberedStepsBlock: BlockModule<NumberedStepsPayload> = {
  type: 'numbered-steps',
  state: 'BUILT',
  label: 'Numbered steps',
  description: 'Steps without media — the lighter sibling of process steps.',
  sharedFields: ['eyebrow', 'heading', 'body', 'cta_label', 'cta_url'],
  schema,
  defaults: { steps: [] },
  payloadFields: [
    {
      name: 'steps',
      kind: 'json',
      label: 'Steps',
      help: 'key, title and body for each step. The order of this list is the order on the page. Set owner_verification to OWNER_VERIFICATION_REQUIRED on a step that claims a capability not yet confirmed.',
    },
  ],
  entryArrays: ['steps'],
  mediaSlots: [],
  layoutVariants: ['stacked', 'grid'],
  allowedPages: null,
}
