'use client'

import * as React from 'react'

import { useDeliveryConstraints } from '@/components/primitives/motion/useDeliveryConstraints'
import { useMinViewportWidth } from '@/components/primitives/motion/useMinViewportWidth'
import { useReducedMotion } from '@/components/primitives/motion/useReducedMotion'
import { cn } from '@/lib/ui/cn'
import { mayAutoplayInline, posterUrlFor } from '@/lib/media/poster'
import { type PresetName, resolveSpec } from '@/lib/media/transform'
import type { MediaRef } from '@/lib/media/types'
import { videoUrl } from '@/lib/media/url'

/**
 * MediaVideo (RC-233) is the only component in the product permitted to emit a `<video>`
 * (DESIGN_SYSTEM §10.1). A Client Component, because whether a video may play at all depends on
 * the visitor's motion preference, which the server cannot know.
 *
 * UNDER REDUCED MOTION NO `<video>` ELEMENT MOUNTS. §7.3's table says exactly that, and the
 * wording is doing work: it is not "the video does not autoplay", it is that the element is not
 * in the tree. A `<video preload="none">` that never plays still costs a media element, a
 * decoder the browser may reserve, and — on some engines — a poster fetch we did not ask for.
 * The poster renders instead, with a visible play control; pressing it mounts the element WITH
 * controls, so someone who asked for less motion can still choose to watch.
 *
 * THERE IS NO `autoplay` ATTRIBUTE IN THE MARKUP, EVER. `scripts/perf/check-video-props.mjs`
 * enforces this. Autoplay is applied imperatively after mount, gated on `mayAutoplayInline()`,
 * because the attribute is evaluated by the browser before any of our conditions can be consulted
 * — a `<video autoplay>` rendered and then corrected has already started fetching.
 *
 * THE POSTER IS ALWAYS PRESENT. `posterFor()` cannot fail to produce one: an explicit still if an
 * editor chose one, the video's own first frame otherwise. So there is no empty state to design
 * and no branch here that renders a hole.
 */

/**
 * Below this width no video mounts by itself (RC-233, CLOUDINARY.md §6).
 *
 * 768px is `--rv-bp-md`, the same breakpoint `AspectBox` switches its ratio at — so the box and
 * the decision about what goes in it change together rather than at two nearby widths.
 */
const INLINE_VIDEO_MIN_WIDTH = 768

export interface MediaVideoProps {
  /** The public cloud name — `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. */
  cloudName: string
  /** The video asset. */
  media: MediaRef
  /** An editor's chosen still, or null for the video's first frame. */
  posterPublicId: string | null
  /**
   * `media_assets.duration_s`, or null when `probe()` has not run.
   *
   * Null does not autoplay. See `mayAutoplayInline`: an unprobed asset is most likely one that was
   * just uploaded, which is exactly when nobody has checked how long it is.
   */
  durationSeconds: number | null
  /** Describes the video for assistive technology and labels the play control. */
  alt: string
  /** The treatment for the poster frame and the video's delivered width. */
  preset?: PresetName
  /** Visible label on the play control. From the CMS — never a literal in this file (D2). */
  playLabel: string
  /** Loop an inline autoplaying clip. Ignored once the visitor has pressed play. */
  loop?: boolean
  className?: string
}

export function MediaVideo({
  cloudName,
  media,
  posterPublicId,
  durationSeconds,
  alt,
  preset = 'hero',
  playLabel,
  loop = true,
  className,
}: MediaVideoProps): React.ReactElement {
  const reducedMotion = useReducedMotion()
  const { saveData, lowMemory } = useDeliveryConstraints()
  const wideEnough = useMinViewportWidth(INLINE_VIDEO_MIN_WIDTH)

  /**
   * `activated` means the visitor pressed play, and it is a one-way latch.
   *
   * Once pressed, the element mounts with `controls` and stays mounted whatever the motion
   * preference says — a preference change mid-session must not snatch away a video somebody
   * deliberately started.
   */
  const [activated, setActivated] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const spec = resolveSpec(preset)
  const poster = posterUrlFor(cloudName, { publicId: media.publicId, posterPublicId }, spec)
  /**
   * All FOUR gates, not just the media query.
   *
   * RC-233: "Under `prefers-reduced-motion: reduce`, `saveData`, or `deviceMemory < 4`, no
   * `<video>` element mounts at all", plus its mobile-behaviour row — "Below 768px the poster is
   * the whole experience unless the visitor presses play; no video element is mounted
   * speculatively" — which CLOUDINARY.md §6 states as `viewport >= 768px`. DESIGN_SYSTEM §4.3
   * gives the reason the non-preference gates exist at all: "a preference is not the only reason
   * to hold back". Somebody on Data Saver has told their browser they are paying for bytes, which
   * an ambient background clip spends without ever being asked for.
   *
   * They are folded into `prefersReducedMotion` rather than checked separately because the policy
   * function's question is "may this play by itself", and all four answer it the same way. What
   * they do NOT do is prevent playback: pressing play still works under every one of them, which
   * is the difference between not spending someone's data and deciding for them.
   */
  const autoplayAllowed = mayAutoplayInline({
    durationSeconds,
    prefersReducedMotion: reducedMotion || saveData || lowMemory || !wideEnough,
  })

  // The element mounts when it may play by itself, or once the visitor has asked for it.
  const mounted = autoplayAllowed || activated

  React.useEffect(() => {
    const element = videoRef.current
    if (element === null) return

    if (activated) {
      // A visitor-initiated play may fail — an autoplay policy, a codec, a network error. The
      // rejection is swallowed rather than thrown: the controls are visible either way, so the
      // visitor can retry, and an unhandled rejection here would surface as a page error for
      // something that is not one.
      void element.play().catch(() => undefined)
      return
    }

    if (autoplayAllowed) {
      void element.play().catch(() => undefined)
    }
  }, [activated, autoplayAllowed])

  return (
    <div className={cn('absolute inset-0 h-full w-full', className)}>
      {mounted ? (
        <video
          ref={videoRef}
          src={videoUrl(cloudName, media, { ...spec, muted: !activated })}
          poster={poster}
          // `controls` only once a person asked for the video. An inline ambient clip with a
          // control bar over it is a video player sitting in the middle of a page; the same clip
          // that somebody pressed play on needs one, and needs a way to stop it.
          controls={activated}
          // Muted while ambient. An autoplaying clip with sound is refused by every browser
          // anyway, so this is the difference between playing and silently not playing.
          muted={!activated}
          // Required on iOS: without it the video takes over the screen on play, which for an
          // ambient clip in a section is a full-screen takeover nobody asked for.
          playsInline
          loop={activated ? false : loop}
          // `none` on purpose, and it does not conflict with autoplay: `play()` fetches what it
          // needs. It means a video the visitor never reaches costs nothing but its poster.
          preload="none"
          aria-label={alt}
          className="absolute inset-0 h-full w-full rounded-none object-cover"
        />
      ) : (
        <>
          {/* Not a MediaImage: the poster URL is already resolved by poster policy, and routing it
              back through a component that resolves URLs from a preset would resolve it twice.
              `next/image` is refused here for the reason given in MediaImage's own disable. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full rounded-none object-cover"
          />
          <button
            type="button"
            onClick={() => setActivated(true)}
            // Covers the frame so the whole poster is the target, which is what a visitor expects
            // of a video still — while remaining a real button with a real accessible name.
            //
            // No focus-visible classes: base.css §2.10 draws ONE focus ring for the whole product
            // on `:focus-visible`, and a second one here would either duplicate it or quietly
            // disagree with it. Note that the ring sits 2px outside the control and MediaFrame
            // clips, which is why the label is inset rather than flush to the frame edge.
            className={cn('absolute inset-0 flex items-center justify-center')}
          >
            <span className="bg-surface-raised text-ink px-4 py-2 text-sm">{playLabel}</span>
          </button>
        </>
      )}
    </div>
  )
}
