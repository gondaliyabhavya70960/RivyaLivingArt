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
 * ChapterMedia (RC-216) — a process chapter's optional motion layer, over a still that is already
 * on the page.
 *
 * ONE CLIP PLAYS AT A TIME, ACROSS THE WHOLE PAGE, and that is the reason this exists rather than
 * `HeroMotion` being reused. `/process` is seven chapters and the library holds thirteen process
 * videos; seven ambient clips fetching and decoding together on a phone is the transfer budget
 * spent on decoration nobody asked for. The clip mounts only while its own chapter is crossing the
 * viewport, and a module-level claim makes sure a second chapter cannot take over while the first
 * still holds it.
 *
 * THE STILL IS NOT HERE. It is server-rendered by the section, at priority-free `loading="lazy"`,
 * and it is the whole chapter whenever this returns null — which is the common case and the launch
 * case: `media_assets` is empty, no clip is bound, and every chapter is complete without one.
 *
 * FIVE GATES, THE SAME FIVE `HeroMotion` APPLIES, plus the viewport one above: after paint, no
 * reduced-motion preference, no Data Saver, no low-memory device, at least 768px, and a clip whose
 * duration is known and short. Any refusal renders nothing at all — never a poster with a play
 * control, which over a chapter's own still would be a second picture and a button competing with
 * the page's reading order.
 */

/** Below this width the still is the whole chapter. `--rv-bp-md`, matching `MediaVideo`. */
const MOTION_MIN_WIDTH = 768

/**
 * Which chapter currently holds the page's one motion slot, by id.
 *
 * MODULE-LEVEL, because the thing being coordinated is a page-wide budget rather than any one
 * chapter's state. A context provider would be the tidier React answer and the wrong one here: it
 * would put a provider in the section tree — a second island on a page that needs none — to
 * coordinate something no server render can observe.
 */
let holder: string | null = null
const listeners = new Set<() => void>()

function claim(id: string): void {
  if (holder === id) return
  holder = id
  for (const listener of listeners) listener()
}

function release(id: string): void {
  if (holder !== id) return
  holder = null
  for (const listener of listeners) listener()
}

function useHolder(id: string): boolean {
  return React.useSyncExternalStore(
    React.useCallback((onStoreChange: () => void) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    }, []),
    React.useCallback(() => holder === id, [id]),
    () => false,
  )
}

export type ChapterMediaProps = {
  /** Stable per chapter — the section's id. Identifies the holder of the page's one motion slot. */
  readonly chapterId: string
  readonly cloudName: string
  /** The chapter's clip. */
  readonly media: MediaRef
  /** The still's public id, so the video's poster is the picture already on screen. */
  readonly posterPublicId: string | null
  readonly durationSeconds: number | null
  readonly alt: string
  readonly playLabel: string
}

export function ChapterMedia({
  chapterId,
  cloudName,
  media,
  posterPublicId,
  durationSeconds,
  alt,
  playLabel,
}: ChapterMediaProps): React.ReactElement | null {
  const frameRef = React.useRef<HTMLDivElement | null>(null)
  const painted = useAfterPaint()
  const reducedMotion = useReducedMotion()
  const { saveData, lowMemory } = useDeliveryConstraints()
  const wideEnough = useMinViewportWidth(MOTION_MIN_WIDTH)
  const holding = useHolder(chapterId)

  const held = reducedMotion || saveData || lowMemory || !wideEnough
  const eligible =
    painted &&
    cloudName !== '' &&
    mayAutoplayInline({ durationSeconds, prefersReducedMotion: held })

  React.useEffect(() => {
    const frame = frameRef.current
    if (frame === null || !eligible || typeof IntersectionObserver !== 'function') {
      release(chapterId)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) claim(chapterId)
          else release(chapterId)
        }
      },
      // The middle half of the viewport: a chapter takes the slot as it arrives and gives it up as
      // it leaves, so two adjacent chapters cannot both consider themselves in view.
      { rootMargin: '-25% 0px -25% 0px', threshold: 0 },
    )
    observer.observe(frame)

    return () => {
      observer.disconnect()
      release(chapterId)
    }
  }, [chapterId, eligible])

  return (
    <div ref={frameRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {eligible && holding ? (
        <MediaVideo
          cloudName={cloudName}
          media={media}
          posterPublicId={posterPublicId}
          durationSeconds={durationSeconds}
          alt={alt}
          preset="hero"
          playLabel={playLabel}
          loop
        />
      ) : null}
    </div>
  )
}
