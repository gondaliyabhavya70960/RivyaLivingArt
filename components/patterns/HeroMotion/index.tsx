'use client'

import * as React from 'react'

import { MediaVideo } from '@/components/patterns/MediaVideo'
import { useAfterPaint } from '@/components/primitives/motion/useAfterPaint'
import { useDeliveryConstraints } from '@/components/primitives/motion/useDeliveryConstraints'
import { useMinViewportWidth } from '@/components/primitives/motion/useMinViewportWidth'
import { useReducedMotion } from '@/components/primitives/motion/useReducedMotion'
import { mayAutoplayInline } from '@/lib/media/poster'
import type { MediaRef } from '@/lib/media/types'

/**
 * HeroMotion (RC-214) — the hero's decorative motion layer, and the thing that must never become
 * the page's largest contentful paint.
 *
 * IT RENDERS NOTHING, OR IT RENDERS A CLIP THAT IS ALREADY PLAYING. There is no third state: no
 * poster, no play control, no reserved box, no spinner. The still underneath is the hero — it was
 * painted first, at priority, and it is what a visitor sees whenever this layer declines to mount.
 * That is why this component exists at all rather than dropping a `MediaVideo` into the hero:
 * `MediaVideo`'s own refusal is a poster with a play button over it, which is correct for a video
 * somebody came to watch and wrong for an ambient layer over hero copy, where it would sit on top
 * of the section's two calls to action offering a third.
 *
 * FIVE GATES, ALL OF WHICH MUST PASS.
 *
 *   1. AFTER PAINT (`useAfterPaint`). Phase 11's budget puts the LCP element at the still; a video
 *      element in the first commit competes with it for the connection at the worst moment.
 *   2. `prefers-reduced-motion: no-preference` (DESIGN_SYSTEM §4.3). Not "a shorter animation" —
 *      no element at all.
 *   3. `navigator.connection.saveData !== true`, and `deviceMemory >= 4` with it. Somebody on Data
 *      Saver has told their browser they are paying for bytes; an ambient clip spends them without
 *      being asked for.
 *   4. 768px and above. Below that the still is the whole hero, which is also why Phase 11 binds a
 *      9:16 mobile clip that does not mount: the binding survives so the gate can be relaxed later
 *      without going back to the media table.
 *   5. `mayAutoplayInline` — the asset's own duration. An unprobed or long clip does not play by
 *      itself, and a layer that would render its play control instead must not render at all.
 *
 * THE GATES ARE READ HERE AND READ AGAIN BY `MediaVideo`, WHICH IS NOT A DUPLICATE DECISION. They
 * come from the same three hooks, so the two cannot disagree; what differs is the QUESTION. This
 * one asks whether a decorative layer should exist, and `MediaVideo` asks whether the element it
 * was given may play. Collapsing them would mean either this component reaching into
 * `MediaVideo`'s internals or `MediaVideo` growing a mode in which it renders nothing — and a
 * media component that can silently render nothing is one that hides a broken binding.
 *
 * `aria-hidden`, AND NOT BECAUSE IT IS DECORATIVE-BY-DEFAULT. The still it covers carries the
 * section's `alt` text, and the clip is the same subject in motion: announcing both would read the
 * hero's picture twice to a screen reader that cannot see either. `MediaVideo` still receives a
 * real `alt` — it labels the element for anyone who reaches it another way, and an empty string
 * there would be a component telling a lie about its own contents.
 */

/** Below this width the still is the whole hero. `--rv-bp-md`, matching `MediaVideo` exactly. */
const MOTION_MIN_WIDTH = 768

export type HeroMotionProps = {
  /** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. Passed, never imported: this stays a pure component. */
  readonly cloudName: string
  /** The motion clip. */
  readonly media: MediaRef
  /**
   * The public id of the STILL, so the video's poster is the picture already on screen.
   *
   * Phase 11 states it as a rule: the clip is never used as the poster. The desktop still is 21:9
   * and the only desktop clip in the library is 16:9, so a poster taken from the clip would paint
   * a differently-framed image over the one the visitor is already looking at.
   */
  readonly posterPublicId: string | null
  /** `media_assets.duration_s`, or null when the probe has not run. Null does not autoplay. */
  readonly durationSeconds: number | null
  /** Describes the clip. From the CMS — never a literal in this file (D2). */
  readonly alt: string
  /** The seeded play-control label `MediaVideo` requires. Unused while this layer is ambient. */
  readonly playLabel: string
}

export function HeroMotion({
  cloudName,
  media,
  posterPublicId,
  durationSeconds,
  alt,
  playLabel,
}: HeroMotionProps): React.ReactElement | null {
  const painted = useAfterPaint()
  const reducedMotion = useReducedMotion()
  const { saveData, lowMemory } = useDeliveryConstraints()
  const wideEnough = useMinViewportWidth(MOTION_MIN_WIDTH)

  const held = reducedMotion || saveData || lowMemory || !wideEnough
  const willPlay = mayAutoplayInline({ durationSeconds, prefersReducedMotion: held })

  // Every hook runs on every render — the branch is here, after them, because that is the rule
  // and because the gates are reactive: a visitor who rotates a phone or changes their motion
  // preference gets the layer added or removed, rather than a stale answer from the first render.
  if (!painted || !willPlay || cloudName === '') return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <MediaVideo
        cloudName={cloudName}
        media={media}
        posterPublicId={posterPublicId}
        durationSeconds={durationSeconds}
        alt={alt}
        preset="hero-xl"
        playLabel={playLabel}
        loop
      />
    </div>
  )
}
