import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'
import { entryVerificationSchema } from '@/lib/cms/entry-visibility'

/**
 * The materials a piece is made of, one card each. SEED §10-06.
 *
 * PAYLOAD FAMILY: REPEATING ITEMS WITH ENTRY-LEVEL VERIFICATION, and this block is the reason that
 * mechanism exists. §10 marks the THIRD statement — "Fabricated Form" — `OWNER_VERIFICATION_REQUIRED`
 * and leaves the other three alone. Withholding the section would take Resin, Wood and Finish off
 * the homepage to withhold one claim; withholding nothing would publish it. So the flag sits on the
 * card, and the layout has to be right at three as well as four.
 */
const materialSchema = z.object({
  key: z.string().min(1),
  title: z.string(),
  description: z.string(),
  media_index: z.number().int().min(0).nullable().optional(),
  owner_verification: entryVerificationSchema,
})

const schema = z.object({
  materials: z.array(materialSchema),
  media: z
    .array(
      z.object({
        slot: z.literal('materials'),
        role: z.literal('GALLERY'),
        media_id: z.string().uuid(),
      }),
    )
    .optional(),
})

export type MaterialPalettePayload = z.infer<typeof schema>

export const materialPaletteBlock: BlockModule<MaterialPalettePayload> = {
  type: 'material-palette',
  state: 'BUILT',
  label: 'Material palette',
  description: 'One card per material, each with its own image and description.',
  sharedFields: ['eyebrow', 'heading', 'body'],
  schema,
  defaults: { materials: [], media: [] },
  payloadFields: [
    {
      name: 'materials',
      kind: 'json',
      label: 'Materials',
      help: 'key, title, description and media_index for each. Set owner_verification to OWNER_VERIFICATION_REQUIRED on a card claiming something not yet confirmed and it stays off the public page.',
    },
    {
      name: 'media',
      kind: 'json',
      label: 'Material images',
      help: 'One { slot: "materials", role: "GALLERY", media_id } per card, in order.',
    },
  ],
  entryArrays: ['materials'],
  mediaSlots: [
    { id: 'materials', role: 'GALLERY', repeating: true, desktopRatio: '1:1', mobileRatio: '4:5' },
  ],
  layoutVariants: ['grid', 'row'],
  allowedPages: null,
}
