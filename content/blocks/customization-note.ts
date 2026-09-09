import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * What changes when a piece is made to order, or made large. SEED §12-04.
 *
 * PAYLOAD FAMILY: NONE, and deliberately no list. The obvious design is a payload of bullet points
 * — "dimensions", "access", "weight", "structural considerations" — and every one of those bullets
 * would be a service claim in a field an editor can extend without review. As one paragraph in
 * `body`, the whole statement carries one verification flag and the owner confirms a sentence they
 * can read rather than a list they have to audit.
 *
 * IT REFUSES TO RENDER UNVERIFIED, which duplicates the publish trigger on purpose. Phase 08's
 * trigger already refuses to move a flagged section to `PUBLISHED`, so this branch should be
 * unreachable — but the section describes what a large-format commission involves, and if it ever
 * DID arrive on a page unverified, the failure would be silent and public. Two mechanisms for one
 * rule is the right ratio when the cost of being wrong is a claim Rivya cannot meet.
 */
const schema = z.object({})

export type CustomizationNotePayload = z.infer<typeof schema>

export const customizationNoteBlock: BlockModule<CustomizationNotePayload> = {
  type: 'customization-note',
  state: 'BUILT',
  label: 'Customization note',
  description: 'A statement about what changes when a piece is made to order.',
  sharedFields: ['eyebrow', 'heading', 'body', 'cta_label', 'cta_url'],
  schema,
  defaults: {},
  payloadFields: [],
  entryArrays: [],
  mediaSlots: [],
  layoutVariants: ['banded', 'plain'],
  allowedPages: null,
}
