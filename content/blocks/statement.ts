import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * Eyebrow, heading, body. SEED §11's philosophy and closing bands.
 *
 * PAYLOAD FAMILY: NONE. `z.object({})` rather than a nullable payload column — the block genuinely
 * has no block-specific data, and saying so with an empty object keeps `parseBlockPayload` total.
 * A block whose payload could be null would need every caller to branch before reading it.
 */
const schema = z.object({})

export type StatementPayload = z.infer<typeof schema>

export const statementBlock: BlockModule<StatementPayload> = {
  type: 'statement',
  state: 'BUILT',
  label: 'Statement',
  description: 'A short editorial band: eyebrow, heading and body, with no media.',
  sharedFields: ['eyebrow', 'heading', 'heading_highlight', 'body', 'supporting'],
  schema,
  defaults: {},
  payloadFields: [],
  mediaSlots: [],
  layoutVariants: ['centred', 'left'],
  allowedPages: null,
}
