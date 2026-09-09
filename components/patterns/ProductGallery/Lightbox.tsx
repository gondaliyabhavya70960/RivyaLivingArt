'use client'

import * as React from 'react'

import { Dialog } from '@/components/patterns/Dialog'
import { MediaImage } from '@/components/patterns/MediaImage'
import { Text } from '@/components/primitives/Text'
import { useReducedMotion } from '@/components/primitives/motion/useReducedMotion'
import { mediaRefOf } from '@/lib/media/ref'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The lightbox — `Dialog` with a filmstrip's keyboard model bolted on, and nothing else.
 *
 * IT DOES NOT REIMPLEMENT A MODAL. Focus capture and restoration, `Escape`, the scrim, the `inert`
 * sweep over the background, the scroll lock and the reduced-motion entrance all belong to
 * RC-201 and are already correct there. A second implementation would be a second focus cycle to
 * keep in step with the first, which is exactly the divergence `MediaSlot`'s header warns about for
 * ratio boxes. What is added here is the ONE thing a dialog does not know: that its content is a
 * sequence.
 *
 * THE KEYS ARE THE SPECIFICATION'S. Left/Right move by one and WRAP, because a filmstrip that dead-
 * ends at both ends makes a visitor guess which end they are at. Home and End jump. `Escape` is
 * Dialog's, and it restores focus to the thumbnail that opened the lightbox rather than to the top
 * of the document.
 *
 * ZOOM IS A SCALE TRANSFORM WITH A REDUCED-MOTION BRANCH. Under `prefers-reduced-motion` the zoomed
 * state is applied with no transition at all rather than a shortened one: the guidance is about
 * vestibular triggers, and a fast scale is still a scale. `useReducedMotion` is a store subscription,
 * so a visitor who changes the setting mid-session gets the new behaviour without a reload.
 */

export interface LightboxProps {
  readonly assets: readonly MediaAsset[]
  /** Which asset is showing. The parent owns it so a thumbnail click can set it. */
  readonly index: number
  readonly onIndexChange: (index: number) => void
  readonly open: boolean
  readonly onClose: () => void
  readonly cloudName: string
  /** Accessible name of the dialog and of its close control, both from `global_content`. */
  readonly title: string
  readonly closeLabel: string
  /** "{{position}} of {{total}}" — announced, and shown under the image. */
  readonly positionLabel: string | null
}

export function Lightbox({
  assets,
  index,
  onIndexChange,
  open,
  onClose,
  cloudName,
  title,
  closeLabel,
  positionLabel,
}: LightboxProps): React.ReactElement | null {
  const reducedMotion = useReducedMotion()

  /**
   * Zoom is remembered WITH the image it applies to, rather than reset by an effect when `index`
   * changes. An effect that calls setState after every move is a second render per move, and the
   * lint rule that flags it is right: this is derivable. Storing which image the zoom belongs to
   * makes "a new image starts unzoomed" fall out of the comparison, with no effect at all.
   *
   * That rule matters here beyond render counts — carrying zoom across a move would land a visitor
   * in the middle of a picture they have not seen the whole of yet.
   */
  const [zoom, setZoom] = React.useState<{ readonly index: number; readonly on: boolean }>({
    index,
    on: false,
  })
  const zoomed = zoom.index === index && zoom.on

  const move = React.useCallback(
    (delta: number) => {
      if (assets.length === 0) return
      // Wrapping arithmetic that stays positive for a negative delta.
      onIndexChange((index + delta + assets.length) % assets.length)
    },
    [assets.length, index, onIndexChange],
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        move(1)
        return
      case 'ArrowLeft':
        event.preventDefault()
        move(-1)
        return
      case 'Home':
        event.preventDefault()
        onIndexChange(0)
        return
      case 'End':
        event.preventDefault()
        onIndexChange(assets.length - 1)
        return
      default:
        // `Escape` is deliberately absent: Dialog owns it, and handling it here as well would
        // close the lightbox twice and fight over where focus lands.
        return
    }
  }

  const asset = assets[index]
  if (asset === undefined) return null

  return (
    <Dialog open={open} onClose={onClose} title={title} closeLabel={closeLabel} size="lg">
      <div onKeyDown={onKeyDown} data-lightbox-stage="" data-zoomed={zoomed ? '' : undefined}>
        <button
          type="button"
          onClick={() => {
            setZoom({ index, on: !zoomed })
          }}
          data-lightbox-zoom=""
          className={
            reducedMotion
              ? 'block w-full cursor-zoom-in'
              : 'block w-full cursor-zoom-in transition-transform duration-300'
          }
          style={zoomed ? { transform: 'scale(1.6)' } : undefined}
          // The control's name is the image's own description — the button IS the image, and a
          // second invented label would be read instead of the picture's.
          aria-label={asset.alt_text}
          aria-pressed={zoomed}
        >
          <MediaImage
            media={mediaRefOf(asset)}
            alt={asset.alt_text}
            cloudName={cloudName}
            preset="hero"
            sizes="100vw"
          />
        </button>

        {positionLabel === null ? null : (
          <Text as="p" size="sm" tone="secondary" data-lightbox-position="" aria-live="polite">
            {positionLabel}
          </Text>
        )}
      </div>
    </Dialog>
  )
}
