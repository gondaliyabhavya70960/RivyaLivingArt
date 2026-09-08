import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The digital-fabrication band. SEED §10-08.
 *
 * IT IS WITHHELD WHOLE AT LAUNCH, by §10's own instruction: "Do not publish as a current capability
 * until owner confirms actual fabrication capability." The flag is on the section, so the Phase 08
 * publish trigger refuses the row — there is no entry to withhold, because the section IS the
 * claim. This block therefore ships built and, as seeded, renders on no public page. That is the
 * correct outcome and not a reason to leave it unbuilt: the owner confirming the capability must be
 * a change of one field in Studio, not a phase of engineering.
 *
 * THE MODEL SLOT IS RESERVED AND EMPTY. Phase 21 puts a viewer in it; until then the slot exists so
 * that binding a model later is a media choice rather than a schema migration, and the renderer
 * emits nothing at all for it — not a frame, not a placeholder, not a "3D coming soon".
 */
const schema = z.object({
  /**
   * `media_assets.id` of a `MODEL` asset, or null. Phase 21 reads it; Phase 11 only carries it.
   * Not a `mediaSlots` entry: those describe images and video the section renders now.
   */
  model_media_id: z.string().uuid().nullable(),
})

export type ThreeDResinPayload = z.infer<typeof schema>

export const threeDResinBlock: BlockModule<ThreeDResinPayload> = {
  type: 'three-d-resin',
  state: 'BUILT',
  label: '3D + resin',
  description: 'The digital-fabrication band, with a reserved slot for the Phase 21 viewer.',
  sharedFields: [
    'eyebrow',
    'heading',
    'body',
    'cta_label',
    'cta_url',
    'media_desktop_id',
    'media_mobile_id',
    'media_alt_override',
  ],
  schema,
  defaults: { model_media_id: null },
  payloadFields: [
    {
      name: 'model_media_id',
      kind: 'text',
      label: '3D model asset id',
      help: 'Reserved for the Phase 21 viewer. Leave empty; nothing renders from it yet.',
    },
  ],
  entryArrays: [],
  mediaSlots: [
    { id: 'scene', role: 'DESKTOP', repeating: false, desktopRatio: '16:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['split', 'full-bleed'],
  allowedPages: null,
}
