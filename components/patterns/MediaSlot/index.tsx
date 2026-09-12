import * as React from 'react'

import { MediaFrame } from '@/components/primitives/MediaFrame'
import { MediaImage } from '@/components/patterns/MediaImage'
import type { AspectRatio } from '@/components/primitives/AspectBox'
import { cropFor, cropSegment } from '@/lib/media/crop'
import { altTextOf, mediaRefOf } from '@/lib/cms/media'
import { MEDIA_FALLBACK_LABEL_KEY, siteStringOrEmpty, type SiteStrings } from '@/lib/cms/strings'
import type { PresetName } from '@/lib/media/transform'
import type { BoundMediaAsset } from '@/lib/cms/media'

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
  readonly asset: BoundMediaAsset | null
  readonly ratio: AspectRatio
  readonly mobileRatio?: AspectRatio
  /** A floor on the frame's height, as a raw token value. See `AspectBoxProps.minBlockSize`. */
  readonly minBlockSize?: string
  readonly preset: PresetName
  readonly sizes: string
  readonly altOverride?: string | null
  readonly strings: SiteStrings
  readonly cloudName: string
  readonly eager?: boolean
  /**
   * THE ROUTE'S LCP ELEMENT — Phase 40. At most one per page.
   *
   * Distinct from `eager`, and the difference is the whole point. `eager` stops the browser
   * DEFERRING the request; `priority` additionally moves it to the front of the queue with
   * `fetchpriority="high"`. Before this phase every hero on the site was eager and none was
   * prioritised, so the largest image on the page was fetched behind every stylesheet and script
   * the parser had already found.
   */
  readonly priority?: boolean
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
  priority = false,
  veil = false,
  overlay,
  className,
  minBlockSize,
}: BlockImageProps): React.ReactElement {
  /*
   * NO CLOUD NAME MEANS NO DELIVERABLE IMAGE, and that is a media failure rather than an error.
   * `imageUrl` would happily build `https://res.cloudinary.com//image/upload/...` from an empty
   * string — a URL that resolves to nothing, an `<img>` that 404s, and a broken-image glyph where
   * the design says a labelled well should be. Treated as "no asset", the frame renders the
   * reserved box and the seeded SEED §47 label, which is what the layout is already sized for.
   */
  const deliverable = cloudName === '' ? null : asset

  /*
   * THE EDITOR'S FOCAL POINT, RESOLVED HERE BECAUSE HERE IS WHERE BOTH FACTS MEET.
   *
   * A crop belongs to an asset AND a ratio — `media_crops` is keyed on the pair — and this frame is
   * the first component that knows both: the asset arrives as a prop, the ratio is the box it is
   * about to reserve. Every layer above knows one or the other.
   *
   * `mobileRatio` GETS ITS OWN CROP, which is the half of §19.1 question 7 that was missing. The
   * Studio lets an editor set a 9:16 focal point precisely because a 21:9 crop of the same
   * photograph is a different picture, and until now neither reached a visitor.
   *
   * NULL IS THE HONEST ANSWER when no editor has chosen one: `imageUrl` then delivers the master
   * under the preset's own `g_auto`, exactly as it did before.
   */
  const crops = deliverable?.crops
  const cropAt = (at: AspectRatio): string | null => {
    if (crops === undefined) return null
    const crop = cropFor(crops, at)
    return crop === undefined ? null : cropSegment(crop)
  }

  return (
    <MediaFrame
      ratio={ratio}
      mobileRatio={mobileRatio}
      fallbackLabel={siteStringOrEmpty(strings, MEDIA_FALLBACK_LABEL_KEY)}
      veil={veil && deliverable !== null}
      overlay={overlay}
      className={className}
      minBlockSize={minBlockSize}
    >
      {deliverable === null ? null : (
        <MediaImage
          cloudName={cloudName}
          media={mediaRefOf(deliverable)}
          preset={preset}
          sizes={sizes}
          alt={altTextOf(deliverable, altOverride)}
          /*
           * PHASE 41: THE ROW DECIDES, NOT THE CALL SITE. `is_decorative` is the one honest way to
           * render `alt=""` — an image carrying nothing the surrounding text does not already give,
           * which a screen reader should skip rather than describe. An `altOverride` still wins,
           * because a caller supplying one is describing this particular use of the asset.
           */
          decorative={deliverable.is_decorative && altOverride === null}
          ratio={ratio}
          cropSegment={cropAt(ratio)}
          loading={eager ? 'eager' : 'lazy'}
          priority={priority}
        />
      )}
    </MediaFrame>
  )
}

export type ResponsiveMediaProps = {
  readonly desktop: BoundMediaAsset | null
  readonly mobile: BoundMediaAsset | null
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
  /** See `BlockImageProps.priority`. Applied to exactly one of the pair — see the note below. */
  readonly priority?: boolean
  readonly veil?: boolean
  readonly overlay?: React.ReactNode
  /**
   * A floor on the height of BOTH halves of the pair. See `AspectBoxProps.minBlockSize`.
   *
   * IT GOES ON THE SHARED PROPS, so the desktop and mobile elements agree. They must: only one is
   * ever visible, and a floor on one alone would make the hero a different height either side of
   * 768px for no reason an editor chose.
   */
  readonly minBlockSize?: string
}

/**
 * The desktop/mobile pair.
 *
 * WHEN ONLY ONE IS SET IT IS USED AT BOTH WIDTHS, and only one element is emitted — an editor who
 * chose a single picture gets that picture everywhere, not a hole below 768px. When both are set,
 * both are emitted and CSS hides one; the hidden one is still in the DOM, so `loading="lazy"`
 * keeps the browser from fetching it. `eager` is honoured only on the visible half at each width,
 * which is why it is passed to both: exactly one of them is displayed, so exactly one loads early.
 *
 * `priority` IS NOT PASSED TO BOTH, AND THAT IS A DELIBERATE ASYMMETRY — Phase 40.
 *
 * Two elements carrying `fetchpriority="high"` are worth about as much as none: the browser has a
 * finite number of connections and breaks the tie by document order, so the second demotes the
 * first. Since the server cannot know the viewport, one of the pair has to be chosen, and the
 * choice is the MOBILE half.
 *
 * WHY MOBILE. The budget this hint exists to serve is a Moto G4 on Slow 4G — the visitor for whom
 * the queue position of a 200 kB hero actually decides whether the page feels instant or broken. A
 * desktop visitor on a warm connection gets the same image `eager`, a few tens of milliseconds
 * later, and will not notice. Spending the one hint on the constrained device is the whole reason
 * to have a hint.
 *
 * When only one asset is set — the common case — there is no pair and the single element takes it.
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
  priority = false,
  veil = false,
  overlay,
  minBlockSize,
}: ResponsiveMediaProps): React.ReactElement {
  const shared = {
    preset,
    altOverride,
    strings,
    cloudName,
    eager,
    veil,
    overlay,
    minBlockSize,
  } as const

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
          priority={priority}
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
      priority={priority}
    />
  )
}
