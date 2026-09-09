import { z } from 'zod'

import type { BlockModule } from '@/lib/cms/block-module'

/**
 * One piece of media given the whole width, with a caption. FEAT §8 elements 3 AND 6.
 *
 * ONE BLOCK, USED TWICE ON AN EXHIBITION PAGE — that is what the phase's own element table means
 * by "3 · Signature media" and "6 · Video · `signature-media` (video slot)". The still and the
 * film are the same band with the same shape and the same caption; only `is_video` differs. Two
 * blocks would mean two renderers, two editors and two sets of ratios that drift apart.
 *
 * THE STILL IS ALWAYS BOUND AND IS ALWAYS WHAT LOADS FIRST. `media_desktop_id` and
 * `media_mobile_id` carry it, exactly as on a hero, and the clip in the `video` slot mounts over
 * it afterwards. Phase 11 made this change to the hero for a reason that applies here unchanged: a
 * band whose `<video>` REPLACED the still made the largest element on the page a media element
 * that may never be allowed to play, and handed the visitor whose motion preference forbids it a
 * frame chosen by the encoder rather than the picture an editor chose. A `signature-media` with
 * `is_video` true and no still is therefore not a video band — it renders nothing.
 *
 * THE CAPTION IS PART OF THE WORK, not a decoration. FEAT §8 puts a signature image on an
 * exhibition page to show one object properly, and the sentence under it is where the studio says
 * what is being shown. It is `nullable` because not every image needs one, and it is a payload
 * field rather than `supporting` because `supporting` is body copy that happens to sit near media,
 * whereas this is bound to the image and must move with it when the band is reordered.
 *
 * NO ENTRY IN `content/media-slots.ts`, DELIBERATELY. That registry is the DESIGN's claim that a
 * fixed surface needs a picture, and every key in it names a concrete route — the seven category
 * pages are enumerated one by one, and Phase 15 added none for `/product/[slug]`. Ten
 * `/collections/<slug>` entries would each be a gap with `fillableBy: []`, which earns a
 * generation brief; briefing new assets for ten collections the owner has not confirmed exist is
 * both the fabrication D10 forbids and a charge nobody approved. The band binds media through the
 * CMS like any other section, and nothing validates a binding against that registry.
 */
const schema = z.object({
  /**
   * Whether the `video` slot is played over the still. False renders the still alone.
   */
  is_video: z.boolean(),
  /**
   * Autoplay is opt-in, and defaults to false — the same editorial half of the decision the hero
   * records. `MediaVideo` (RC-233) independently refuses to autoplay under `prefers-reduced-motion`,
   * on `saveData`, below 4 GB `deviceMemory` and below 768px, so this flag can only ever withhold
   * playback, never force it.
   */
  autoplay: z.boolean(),
  /** The sentence under the media. Null where the picture speaks for itself. */
  caption: z.string().nullable(),
  /**
   * The clip.
   *
   * OPTIONAL IN THE SCHEMA, PRESENT IN THE DEFAULTS, for the reason `hero` and `category-grid`
   * both state: a row written before this key existed must still parse, while a NEW block starts
   * with `[]` so the editor has a field to fill and `payloadFields` names a key the defaults have.
   */
  media: z
    .array(
      z.object({
        slot: z.literal('video'),
        role: z.literal('DESKTOP'),
        media_id: z.string().uuid(),
      }),
    )
    .optional(),
})

export type SignatureMediaPayload = z.infer<typeof schema>

export const signatureMediaBlock: BlockModule<SignatureMediaPayload> = {
  type: 'signature-media',
  state: 'BUILT',
  label: 'Signature media',
  description: 'One image or film across the full width, with a caption bound to it.',
  sharedFields: ['eyebrow', 'heading', 'media_desktop_id', 'media_mobile_id', 'media_alt_override'],
  schema,
  defaults: { is_video: false, autoplay: false, caption: null, media: [] },
  payloadFields: [
    { name: 'is_video', kind: 'boolean', label: 'Play a film over the still' },
    {
      name: 'autoplay',
      kind: 'boolean',
      label: 'Play automatically',
      help: 'Ignored under reduced motion, on a slow connection, and below 768px.',
    },
    { name: 'caption', kind: 'textarea', label: 'Caption' },
    {
      name: 'media',
      kind: 'json',
      label: 'Film',
      help: 'One { slot: "video", role: "DESKTOP", media_id } entry. The still stays in the desktop and mobile media fields above and is what loads first.',
    },
  ],
  entryArrays: [],
  mediaSlots: [
    { id: 'video', role: 'DESKTOP', repeating: false, desktopRatio: '16:9', mobileRatio: '4:5' },
  ],
  layoutVariants: ['full-bleed', 'inset'],
  allowedPages: null,
}
