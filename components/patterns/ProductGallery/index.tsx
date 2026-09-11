import * as React from 'react'

import { GalleryViewer } from './Viewer'
import { BlockImage } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'
import { siteString, type SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The product gallery — server-rendered stills, with a client lightbox layered on top.
 *
 * EVERY IMAGE IS IN THE SERVER HTML. Not the hero with the rest behind a script, and not a carousel
 * that shows one at a time: the whole set, in order, each with its own `alt_text`. That is what
 * makes the gallery work with JavaScript disabled, and it is also what a crawler and a reader-mode
 * view get. The lightbox is an enhancement for looking closer at something already visible, which
 * is why losing it costs a visitor nothing they could not otherwise reach.
 *
 * THE ORDER IS THE OWNER'S. `product_media` is read by `role` then `sort_order` by the caller — hero,
 * gallery, detail, lifestyle, video, model (Phase 03) — and this component does not re-sort. An
 * ordering decided here would silently disagree with the order the Studio's Media tab shows.
 *
 * THE 3D SLOT RENDERS NOTHING UNTIL PHASE 21. `model_media_id` has no viewer yet, and a placeholder
 * saying one is coming is a promise about a feature that does not exist. The absence is deliberate:
 * not a teaser, not a disabled control, nothing at all.
 *
 * NO IMAGES MEANS NO GALLERY. A product whose media the owner has not attached renders no section
 * here rather than an empty frame — the page is complete without it, which is the sparse-product
 * case `product-minimal.spec.ts` exists to prove.
 */

export interface ProductGalleryProps {
  /** In render order, hero first. Already filtered to images by the caller. */
  readonly assets: readonly MediaAsset[]
  readonly strings: SiteStrings
  /** Empty string when the environment has no cloud name; the frames then carry the fallback. */
  readonly cloudName: string
}

export function ProductGallery({
  assets,
  strings,
  cloudName,
}: ProductGalleryProps): React.ReactElement | null {
  if (assets.length === 0) return null

  const regionName = siteString(strings, 'UI_LABEL.product.gallery.heading')

  return (
    <section data-product-gallery="" {...(regionName === null ? {} : { 'aria-label': regionName })}>
      <Stack gap={4}>
        {regionName === null ? null : <VisuallyHidden>{regionName}</VisuallyHidden>}

        <ul data-gallery-stills="">
          {assets.map((asset, position) => (
            <li key={asset.id}>
              <BlockImage
                asset={asset}
                ratio="4:5"
                preset="hero"
                sizes="(min-width: 1024px) 60vw, 100vw"
                strings={strings}
                cloudName={cloudName}
                // Only the first is eager: it is the largest thing above the fold on this route,
                // and making the rest eager would fight it for bandwidth on a phone.
                eager={position === 0}
                // Phase 40: the first frame is this route's LCP element.
                priority={position === 0}
              />
            </li>
          ))}
        </ul>

        <GalleryViewer assets={assets} cloudName={cloudName} strings={strings} />
      </Stack>
    </section>
  )
}
