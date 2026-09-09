'use client'

import * as React from 'react'

import { Lightbox } from './Lightbox'
import { Thumbnails } from './Thumbnails'
import { interpolate, siteString, type SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The one client island on `/product/[slug]`, and it owns the whole gallery interaction.
 *
 * ONE ISLAND, NOT TWO. The thumbnails and the lightbox share a selected index — a thumbnail click
 * opens the lightbox at that image, and the lightbox's arrows move the strip's selection — so
 * splitting them would mean lifting that state into a third component and hydrating all three.
 * `site:check-islands` counts what ships; this keeps the count at one.
 *
 * IT ADDS, IT DOES NOT REPLACE. `ProductGallery` renders every still full size on the server, above
 * this. Without JavaScript that list is the gallery: every image, every alt text, in order. This
 * island's server output is the thumbnail strip, which degrades to a plain list of images. Nothing
 * a visitor can see depends on hydration; only the lightbox does, and a lightbox is a convenience
 * for looking closer at something already on the page.
 */

export interface GalleryViewerProps {
  readonly assets: readonly MediaAsset[]
  readonly cloudName: string
  readonly strings: SiteStrings
}

export function GalleryViewer({
  assets,
  cloudName,
  strings,
}: GalleryViewerProps): React.ReactElement | null {
  const [index, setIndex] = React.useState(0)
  const [open, setOpen] = React.useState(false)

  if (assets.length === 0) return null

  const stripLabel = siteString(strings, 'UI_LABEL.product.gallery.thumbnails')
  const title = siteString(strings, 'UI_LABEL.product.gallery.lightbox')
  const closeLabel = siteString(strings, 'ACTION_LABEL.close_menu')
  const positionTemplate = siteString(strings, 'UI_LABEL.product.gallery.position')

  // No strip name means no strip: an unnamed list of image buttons is announced as a wall of
  // graphics with no indication of what it is for.
  if (stripLabel === null) return null

  const canOpen = title !== null && closeLabel !== null

  return (
    <>
      <Thumbnails
        assets={assets}
        activeIndex={index}
        onSelect={setIndex}
        // Without a dialog name or a close-control name the lightbox would be unlabelled and its
        // close button unreachable by name, so the thumbnails select without opening anything.
        onActivate={
          canOpen
            ? () => {
                setOpen(true)
              }
            : undefined
        }
        cloudName={cloudName}
        label={stripLabel}
      />

      {canOpen ? (
        <Lightbox
          assets={assets}
          index={index}
          onIndexChange={setIndex}
          open={open}
          onClose={() => {
            setOpen(false)
          }}
          cloudName={cloudName}
          title={title}
          closeLabel={closeLabel}
          positionLabel={
            positionTemplate === null
              ? null
              : interpolate(positionTemplate, {
                  position: String(index + 1),
                  total: String(assets.length),
                })
          }
        />
      ) : null}
    </>
  )
}
