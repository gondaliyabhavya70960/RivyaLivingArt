import * as React from 'react'

import { MediaFrame } from '@/components/primitives/MediaFrame'
import { MediaImage } from '@/components/patterns/MediaImage'
import type { AspectRatio } from '@/components/primitives/AspectBox'
import { altTextOf, mediaRefOf } from '@/lib/cms/media'
import { MEDIA_FALLBACK_LABEL_KEY, siteStringOrEmpty, type SiteStrings } from '@/lib/cms/strings'
import type { PresetName } from '@/lib/media/transform'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * MediaSlot — the two ways any surface shows a CMS-bound asset: one picture, or a desktop/mobile
 * pair. It reserves the aspect box from the CMS ratio before the asset is known, so a slow image,
 * a missing one and a failed one all occupy the same space, and it paints the SEED §47 fallback
 * with its seeded label when nothing resolves.
 *
 * IT LIVED AT `components/sections/SectionMedia.tsx` UNTIL PHASE 10 and moved here unchanged. Not
 * a tidy-up: Phase 10's header needs exactly this behaviour for the mega menu's category cards,
 * and building a second component beside it — which is what the phase document's deliverable table
 * would otherwise have produced — is how two ratio-box implementations come to disagree about what
 * happens when an asset is null. `components/patterns/` is where a component used by more than one
 * kind of surface belongs; `components/sections/` is for the block renderers themselves.
 *
 *
 * THE PAIR IS TWO ELEMENTS, NOT ONE `<picture>` WITH TWO SOURCES. A `<picture>` would be smaller
 * markup and the wrong shape: the two assets are different crops of different subjects chosen by
 * an editor (`media_desktop_id`, `media_mobile_id` are separate columns for exactly that reason),
 * each carries its own `alt_text`, and `<picture>` has one `alt` for all its sources. Two frames,
 * each hidden at the other's breakpoint, keeps each asset's own description.
 *
 * The breakpoint is `md` (768px), matching `AspectBox`'s own desktop/mobile split so the reserved
 * box and the asset inside it change over at the same width.
 */

export type BlockImageProps = {
  readonly asset: MediaAsset | null
  readonly ratio: AspectRatio
  readonly mobileRatio?: AspectRatio
  readonly preset: PresetName
  readonly sizes: string
  readonly altOverride?: string | null
  readonly strings: SiteStrings
  readonly cloudName: string
  readonly eager?: boolean
  readonly veil?: boolean
  readonly overlay?: React.ReactNode
  readonly className?: string
}

/**
 * One asset in its reserved box.
 *
 * A NULL ASSET STILL RENDERS THE FRAME. The box was reserved from the CMS ratio before the asset
 * was known, so collapsing it now would move everything below — the exact layout shift the frame
 * exists to prevent. The well carries the fallback label instead.
 */
export function BlockImage({
  asset,
  ratio,
  mobileRatio,
  preset,
  sizes,
  altOverride = null,
  strings,
  cloudName,
  eager = false,
  veil = false,
  overlay,
  className,
}: BlockImageProps): React.ReactElement {
  /*
   * NO CLOUD NAME MEANS NO DELIVERABLE IMAGE, and that is a media failure rather than an error.
   * `imageUrl` would happily build `https://res.cloudinary.com//image/upload/...` from an empty
   * string — a URL that resolves to nothing, an `<img>` that 404s, and a broken-image glyph where
   * the design says a labelled well should be. Treated as "no asset", the frame renders the
   * reserved box and the seeded SEED §47 label, which is what the layout is already sized for.
   */
  const deliverable = cloudName === '' ? null : asset

  return (
    <MediaFrame
      ratio={ratio}
      mobileRatio={mobileRatio}
      fallbackLabel={siteStringOrEmpty(strings, MEDIA_FALLBACK_LABEL_KEY)}
      veil={veil && deliverable !== null}
      overlay={overlay}
      className={className}
    >
      {deliverable === null ? null : (
        <MediaImage
          cloudName={cloudName}
          media={mediaRefOf(deliverable)}
          preset={preset}
          sizes={sizes}
          alt={altTextOf(deliverable, altOverride)}
          ratio={ratio}
          loading={eager ? 'eager' : 'lazy'}
        />
      )}
    </MediaFrame>
  )
}

export type ResponsiveMediaProps = {
  readonly desktop: MediaAsset | null
  readonly mobile: MediaAsset | null
  readonly desktopRatio: AspectRatio
  readonly mobileRatio: AspectRatio
  readonly preset: PresetName
  /**
   * How wide the box is at each breakpoint, in `sizes` syntax.
   *
   * `100vw` IS THE DEFAULT BECAUSE THE PAIR IS USUALLY FULL-BLEED — a hero, a band — and it is
   * WRONG for a picture in a two-column section, which is why the prop exists: without it a
   * half-width portrait downloads the rung sized for the whole viewport, and the page looks
   * correct while weighing several times what it should.
   */
  readonly sizes?: string
  readonly altOverride?: string | null
  readonly strings: SiteStrings
  readonly cloudName: string
  readonly eager?: boolean
  readonly veil?: boolean
  readonly overlay?: React.ReactNode
}

/**
 * The desktop/mobile pair.
 *
 * WHEN ONLY ONE IS SET IT IS USED AT BOTH WIDTHS, and only one element is emitted — an editor who
 * chose a single picture gets that picture everywhere, not a hole below 768px. When both are set,
 * both are emitted and CSS hides one; the hidden one is still in the DOM, so `loading="lazy"`
 * keeps the browser from fetching it. `eager` is honoured only on the visible half at each width,
 * which is why it is passed to both: exactly one of them is displayed, so exactly one loads early.
 */
export function ResponsiveMedia({
  desktop,
  mobile,
  desktopRatio,
  mobileRatio,
  preset,
  sizes = '100vw',
  altOverride = null,
  strings,
  cloudName,
  eager = false,
  veil = false,
  overlay,
}: ResponsiveMediaProps): React.ReactElement {
  const shared = { preset, altOverride, strings, cloudName, eager, veil, overlay } as const

  // Same rule as BlockImage, applied before the pair is chosen: with no cloud name neither asset
  // is deliverable, so emit ONE frame carrying the fallback rather than two identical wells.
  if (cloudName !== '' && desktop !== null && mobile !== null && desktop.id !== mobile.id) {
    return (
      <>
        <BlockImage
          {...shared}
          asset={mobile}
          ratio={mobileRatio}
          sizes={sizes}
          className="md:hidden"
        />
        <BlockImage
          {...shared}
          asset={desktop}
          ratio={desktopRatio}
          sizes={sizes}
          className="hidden md:block"
        />
      </>
    )
  }

  return (
    <BlockImage
      {...shared}
      asset={desktop ?? mobile}
      ratio={desktopRatio}
      mobileRatio={mobileRatio}
      sizes={sizes}
    />
  )
}
