import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * A rule between bands. The degenerate case, and it is in Tier 1 on purpose.
 *
 * PAYLOAD FAMILY: NONE, AND NO COPY FIELDS EITHER. `sharedFields: []` is the case that proves the
 * chrome/copy split in `block-module.ts` is real: a divider still gets `theme`, `is_visible`,
 * `position`, a publish window, a fact classification and an owner-verification flag from the
 * shared section editor, because those are not copy — they are how any block behaves. If
 * `sharedFields: []` had meant "no editor", a divider would have no visibility toggle and exit
 * criterion 2 would be false for it.
 */
const schema = z.object({
  /** How much room the rule takes. Not a class name — the renderer maps it to §5.1 spacing steps. */
  spacing: z.enum(['tight', 'normal', 'loose']),
  /** A hairline, or whitespace alone. */
  rule: z.boolean(),
})

export type DividerPayload = z.infer<typeof schema>

export const dividerBlock: BlockModule<DividerPayload> = {
  type: 'divider',
  state: 'BUILT',
  label: 'Divider',
  description: 'Space, optionally with a hairline rule.',
  sharedFields: [],
  schema,
  defaults: { spacing: 'normal', rule: true },
  payloadFields: [
    {
      name: 'spacing',
      kind: 'select',
      label: 'Spacing',
      options: [
        { value: 'tight', label: 'Tight' },
        { value: 'normal', label: 'Normal' },
        { value: 'loose', label: 'Loose' },
      ],
    },
    { name: 'rule', kind: 'boolean', label: 'Draw a line' },
  ],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: [],
  allowedPages: null,
}
