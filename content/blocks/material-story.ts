import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The `LIQUID → FORM → CRAFT → OBJECT` progression. SEED §10-05, FEAT §4.
 *
 * THE FOUR WORDS ARE NOT IN THIS PAYLOAD, and that is deliberate. SEED §10-05 gives them as a
 * "Headline sequence" and Phase 09 seeded them, verbatim and newline-separated, into the section's
 * `heading`. Repeating them here as stage labels would be the same copy in two places, and the day
 * an editor reworded the heading the stages would still say the old thing. A stage is therefore a
 * MEDIA POSITION and nothing else: an id, and which picture belongs to it.
 *
 * THE STAGES ARE NOT AN ANIMATION SPEC EITHER. `components/patterns/MaterialSequence.tsx` observes
 * scroll and highlights whichever stage is in view; under reduced motion, and with no JavaScript at
 * all, the same four stages render as a static vertical list with every picture visible. That is a
 * different LAYOUT rather than a faster animation, which is the distinction FEAT §4 draws and the
 * one that decides whether the section is readable when the effect does not run.
 */
const stageSchema = z.object({
  /** Stable across reordering; becomes `data-entry-key` and the observer's target id. */
  key: z.string().min(1),
  /** Index into `payload.media` entries whose slot is `stages`. Null renders the stage textless. */
  media_index: z.number().int().min(0).nullable(),
})

const schema = z.object({
  stages: z.array(stageSchema),
  media: z
    .array(
      z.object({
        slot: z.literal('stages'),
        role: z.literal('GALLERY'),
        media_id: z.string().uuid(),
      }),
    )
    .optional(),
})

export type MaterialStoryPayload = z.infer<typeof schema>

export const materialStoryBlock: BlockModule<MaterialStoryPayload> = {
  type: 'material-story',
  state: 'BUILT',
  label: 'Material story',
  description:
    'The liquid-to-object progression, as four media stages beside the headline sequence.',
  sharedFields: ['eyebrow', 'heading', 'body', 'cta_label', 'cta_url'],
  schema,
  defaults: { stages: [], media: [] },
  payloadFields: [
    {
      name: 'stages',
      kind: 'json',
      label: 'Stages',
      help: 'key and media_index for each stage, in order. The words themselves come from the headline above.',
    },
    {
      name: 'media',
      kind: 'json',
      label: 'Stage images',
      help: 'One { slot: "stages", role: "GALLERY", media_id } per stage, in order.',
    },
  ],
  entryArrays: [],
  mediaSlots: [
    { id: 'stages', role: 'GALLERY', repeating: true, desktopRatio: '1:1', mobileRatio: '1:1' },
  ],
  layoutVariants: ['sequence', 'stacked'],
  allowedPages: null,
}
