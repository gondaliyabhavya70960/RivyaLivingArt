import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * Cards, each with its own title, description, link and picture. SEED §10-03.
 *
 * PAYLOAD FAMILY: REPEATING ITEMS, and it is the one that makes `sync_media_usages` earn its
 * keep. Each card's media reference goes into the reserved `payload.media` array, which the
 * trigger turns into `cards[0]`, `cards[1]`, … — the indexed `slot_key` form
 * `lib/media/gaps.ts` `slotKeyOf()` strips. Verification step 9 is exactly this block with three
 * cards.
 *
 * THE CARDS AND THE MEDIA ARRAY ARE SEPARATE, which looks redundant and is not. `media` is a
 * reserved key with a fixed shape the DATABASE reads; `cards` is this block's own editorial data.
 * Merging them would mean the trigger had to know a card's shape, and every future block with
 * repeating media would have to adopt it.
 */
const cardSchema = z.object({
  title: z.string(),
  description: z.string(),
  href: z.string(),
  /** Index into `payload.media` entries whose slot is `cards`. Null renders the card textless. */
  media_index: z.number().int().min(0).nullable(),
})

const schema = z.object({
  cards: z.array(cardSchema),
  /** How many across at the widest breakpoint. The grid halves below 1024 and stacks below 768. */
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  /**
   * OPTIONAL IN THE SCHEMA, PRESENT IN THE DEFAULTS. Optional so a row written before this key
   * existed still parses; present in the defaults so a NEW block starts with `[]` rather than an
   * absent key, which is what lets the editor render the field at all and what keeps
   * `payloadFields` honest — a field naming a key the defaults do not have writes into nothing.
   */
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

export type CategoryGridPayload = z.infer<typeof schema>

export const categoryGridBlock: BlockModule<CategoryGridPayload> = {
  type: 'category-grid',
  state: 'BUILT',
  label: 'Category grid',
  description: 'A row of cards, each with a title, description, link and its own image.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { cards: [], columns: 3, media: [] },
  payloadFields: [
    {
      name: 'columns',
      kind: 'select',
      label: 'Columns',
      options: [
        { value: '2', label: 'Two' },
        { value: '3', label: 'Three' },
        { value: '4', label: 'Four' },
      ],
    },
    {
      name: 'cards',
      kind: 'json',
      label: 'Cards',
      help: 'title, description, href and media_index for each card. media_index counts the media entries below, from 0.',
    },
    {
      name: 'media',
      kind: 'json',
      label: 'Card images',
      help: 'One { slot: "cards", role: "GALLERY", media_id } per card image, in order.',
    },
  ],
  mediaSlots: [
    { id: 'cards', role: 'GALLERY', repeating: true, desktopRatio: '4:5', mobileRatio: '4:5' },
  ],
  layoutVariants: ['grid', 'carousel'],
  allowedPages: null,
}
