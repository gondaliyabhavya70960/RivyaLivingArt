import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * The page opener. SEED §10-01, §11, §12, §13, §15, §16, §17, §18, §21 — the most reused block in
 * the catalogue, which is why it is the worked example the other 27 are written against.
 *
 * PAYLOAD FAMILY: MEDIA-ONLY. Everything a hero says lives in the shared copy fields; the only
 * block-specific data is how its media behaves. That is the common case — most blocks in the
 * catalogue need no payload at all, and the ones that do need very little.
 *
 * THE POSTER SLOT IS DECLARED SEPARATELY FROM THE DESKTOP/MOBILE PAIR because a poster is not a
 * third size of the same picture: under reduced motion it IS the experience, and it must be the
 * video's own opening frame rather than a related still. `content/media-slots.ts` says the same
 * thing about `home.hero.poster` from the other direction.
 */
const schema = z.object({
  /** A hero may lead with a video; the poster slot below is then required, not optional. */
  is_video: z.boolean(),
  /**
   * Autoplay is opt-in per block, and defaults to false.
   *
   * `MediaVideo` (RC-233) already refuses to autoplay under `prefers-reduced-motion`, on
   * `saveData`, below 4 GB `deviceMemory` and under 768px. This flag is the editorial half of the
   * same decision: some heroes are a still that happens to move, and some are a statement that
   * should wait to be asked for.
   */
  autoplay: z.boolean(),
  /** Overlay strength, 0–100. The palette is dark; a light hero needs the scrim, a dark one does not. */
  scrim: z.number().int().min(0).max(100),
})

export type HeroPayload = z.infer<typeof schema>

export const heroBlock: BlockModule<HeroPayload> = {
  type: 'hero',
  state: 'BUILT',
  label: 'Hero',
  description:
    'Full-width page opener with desktop and mobile media and up to two calls to action.',
  sharedFields: [
    'eyebrow',
    'heading',
    'heading_highlight',
    'body',
    'cta_label',
    'cta_url',
    'cta_secondary_label',
    'cta_secondary_url',
    'media_desktop_id',
    'media_mobile_id',
    'media_alt_override',
  ],
  schema,
  defaults: { is_video: false, autoplay: false, scrim: 40 },
  payloadFields: [
    { name: 'is_video', kind: 'boolean', label: 'This hero is a video' },
    {
      name: 'autoplay',
      kind: 'boolean',
      label: 'Play automatically',
      help: 'Ignored under reduced motion, on a slow connection, and below 768px.',
    },
    { name: 'scrim', kind: 'number', label: 'Overlay strength', min: 0, max: 100 },
  ],
  mediaSlots: [
    { id: 'poster', role: 'POSTER', repeating: false, desktopRatio: '21:9', mobileRatio: '9:16' },
  ],
  layoutVariants: ['full-bleed', 'contained', 'split'],
  allowedPages: null,
}
