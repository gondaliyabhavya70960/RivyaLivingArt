'use client'

import * as React from 'react'

import { MediaImage } from '@/components/patterns/MediaImage'
import { mediaRefOf } from '@/lib/cms/media'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The thumbnail strip — a roving-tabindex list, which is the point of the file.
 *
 * ONE TAB STOP, NOT TWENTY. A gallery of eighteen images with eighteen tabbable thumbnails puts
 * eighteen stops between the picture and the conversion rail, and a keyboard visitor who does not
 * want the gallery has to pass through all of them. The roving pattern gives the strip a single
 * stop: Tab reaches the active thumbnail, the arrows move within the strip, and Tab again leaves it.
 * That is APG's listbox-ish keyboard model, and it is what "thumbnails are a roving-tabindex list"
 * in the phase document means.
 *
 * THE ARROWS MOVE FOCUS AND SELECTION TOGETHER, and the moved-to thumbnail is focused imperatively
 * rather than by rendering `autoFocus` — a re-render that steals focus from wherever the visitor
 * actually is would be worse than no keyboard support. The effect only fires when the strip already
 * holds focus, which `hasFocus` tracks.
 *
 * IT RENDERS ON THE SERVER TOO. This is a client component but its first paint is server output, so
 * a visitor without JavaScript sees every thumbnail as a normal image in a list. They cannot open
 * the lightbox — that needs a dialog — but nothing is hidden from them, and `ProductGallery` renders
 * every still full-size above this strip for exactly that reason.
 */

export interface ThumbnailsProps {
  readonly assets: readonly MediaAsset[]
  readonly activeIndex: number
  readonly onSelect: (index: number) => void
  /** Enter or Space on a thumbnail. Absent means selection only, with no lightbox. */
  readonly onActivate?: (index: number) => void
  readonly cloudName: string
  /** The strip's accessible name, from `global_content`. */
  readonly label: string
}

export function Thumbnails({
  assets,
  activeIndex,
  onSelect,
  onActivate,
  cloudName,
  label,
}: ThumbnailsProps): React.ReactElement | null {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const [hasFocus, setHasFocus] = React.useState(false)

  React.useEffect(() => {
    if (!hasFocus) return
    refs.current[activeIndex]?.focus()
  }, [activeIndex, hasFocus])

  if (assets.length === 0) return null

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>): void => {
    const last = assets.length - 1
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        onSelect(activeIndex === last ? 0 : activeIndex + 1)
        return
      case 'ArrowLeft':
        event.preventDefault()
        onSelect(activeIndex === 0 ? last : activeIndex - 1)
        return
      case 'Home':
        event.preventDefault()
        onSelect(0)
        return
      case 'End':
        event.preventDefault()
        onSelect(last)
        return
      default:
        return
    }
  }

  return (
    <ul
      // A list of controls, named so a screen reader announces what the strip is before its items.
      aria-label={label}
      data-gallery-thumbnails=""
      className="flex flex-wrap gap-2"
      onKeyDown={onKeyDown}
      onFocus={() => {
        setHasFocus(true)
      }}
      onBlur={(event) => {
        // Only when focus leaves the strip entirely, or moving between thumbnails would clear it.
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false)
      }}
    >
      {assets.map((asset, index) => (
        <li key={asset.id}>
          <button
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            // The roving part: exactly one thumbnail is reachable by Tab.
            tabIndex={index === activeIndex ? 0 : -1}
            aria-current={index === activeIndex ? 'true' : undefined}
            data-gallery-thumbnail={index === activeIndex ? 'active' : ''}
            className="block w-20 rv-hit-44"
            onClick={() => {
              onSelect(index)
              onActivate?.(index)
            }}
          >
            <MediaImage
              media={mediaRefOf(asset)}
              alt={asset.alt_text}
              cloudName={cloudName}
              preset="thumb"
              sizes="80px"
            />
          </button>
        </li>
      ))}
    </ul>
  )
}
