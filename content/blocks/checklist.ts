import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import { entryVerificationSchema } from '@/lib/cms/entry-visibility'

/**
 * A list of points, each with a mark.
 *
 * PAYLOAD FAMILY: REPEATING ITEMS, UNORDERED — the opposite of `numbered-steps`, which is the same
 * shape with the order load-bearing. A checklist is a set: "included in every commission" reads the
 * same whichever way round two items sit, and a renderer is free to lay it out in two columns
 * because of that. Nothing here sorts either, though — the editor's order is still their order.
 *
 * EVERY ITEM CAN BE WITHHELD SEPARATELY, and on this block that matters more than most. A list of
 * what the studio includes is a list of capability claims, one per line; the section-level flag
 * would withhold the whole list to withhold one line. `entryArrays` names `items` so the Studio
 * surface, the verification sweep and `visibleEntries` all read the same field.
 */
const itemSchema = z.object({
  text: z.string(),
  /**
   * A second line under the point. Empty renders nothing rather than an empty paragraph.
   *
   * DEFAULTED RATHER THAN OPTIONAL, so the renderer can call `.trim()` without a guard and the
   * seeded lists — §15's starting points and brief fields, which are bare sentences — need no
   * second field invented for them.
   */
  detail: z.string().default(''),
  /** Stable across reordering. Optional for the reason `category-grid`'s `key` is optional. */
  key: z.string().min(1).optional(),
  owner_verification: entryVerificationSchema,
})

const schema = z.object({
  items: z.array(itemSchema),
})

export type ChecklistPayload = z.infer<typeof schema>

export const checklistBlock: BlockModule<ChecklistPayload> = {
  type: 'checklist',
  state: 'BUILT',
  label: 'Checklist',
  description: 'A list of points, each with a mark.',
  sharedFields: ['eyebrow', 'heading', 'body', 'cta_label', 'cta_url'],
  schema,
  defaults: { items: [] },
  payloadFields: [
    {
      name: 'items',
      kind: 'json',
      label: 'Points',
      help: 'key, text and detail for each point. Set owner_verification to OWNER_VERIFICATION_REQUIRED on a point that claims something about the business nobody has confirmed.',
    },
  ],
  entryArrays: ['items'],
  mediaSlots: [],
  layoutVariants: ['single-column', 'two-column'],
  allowedPages: null,
}
