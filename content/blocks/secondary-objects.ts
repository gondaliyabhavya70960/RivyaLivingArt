import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import { entryVerificationSchema } from '@/lib/cms/entry-visibility'

/**
 * The smaller work: preservation, décor, gifts. SEED §10-11.
 *
 * PAYLOAD FAMILY: REPEATING ITEMS, and one of the four carries a flag. "Personalised Pieces" is a
 * personalisation capability claim and is also the one card with no Higgsfield family of its own,
 * which the Phase 11 media table records as a gap rather than filling from `gifts`.
 *
 * NO PRICE AND NO DIMENSION FIELD EXISTS HERE, and its absence is the point rather than an
 * omission. §10-11 and §32 forbid presenting these as buyable inventory, and a schema without the
 * field cannot be filled in later "just for this one card" — `tests/unit/homepage-payloads.test.ts`
 * asserts the absence so that adding one is a visible decision.
 */
const cardSchema = z.object({
  key: z.string().min(1),
  title: z.string(),
  href: z.string(),
  description: z.string().optional(),
  media_index: z.number().int().min(0).nullable().optional(),
  owner_verification: entryVerificationSchema,
})

const schema = z.object({
  cards: z.array(cardSchema),
  media: z
    .array(
      z.object({
        slot: z.literal('cards'),
        role: z.literal('GALLERY'),
        media_id: z.string().uuid(),
      }),
    )
    .optional(),
})

export type SecondaryObjectsPayload = z.infer<typeof schema>

export const secondaryObjectsBlock: BlockModule<SecondaryObjectsPayload> = {
  type: 'secondary-objects',
  state: 'BUILT',
  label: 'Secondary objects',
  description: 'Cards for the smaller work — preservation, décor, gifts.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { cards: [], media: [] },
  payloadFields: [
    {
      name: 'cards',
      kind: 'json',
      label: 'Cards',
      help: 'key, title, href and optional description and media_index for each. No price or dimension field exists on this block by design.',
    },
    {
      name: 'media',
      kind: 'json',
      label: 'Card images',
      help: 'One { slot: "cards", role: "GALLERY", media_id } per card, in order.',
    },
  ],
  entryArrays: ['cards'],
  mediaSlots: [
    { id: 'cards', role: 'GALLERY', repeating: true, desktopRatio: '3:4', mobileRatio: '4:5' },
  ],
  layoutVariants: ['grid', 'row'],
  allowedPages: null,
}
