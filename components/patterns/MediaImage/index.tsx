import * as React from 'react'

import { cn } from '@/lib/ui/cn'
import { type PresetName, resolveSpec, srcSet } from '@/lib/media/transform'
import type { AspectRatio, MediaRef, TransformSpec } from '@/lib/media/types'
import { imageUrl } from '@/lib/media/url'

/**
 * MediaImage (RC-232) is one of the two components in the product permitted to emit an `<img>`
 * (DESIGN_SYSTEM §10.1). It is a Server Component: it computes URLs and emits markup, and has no
 * state, no effect and no event handler.
 *
 * IT DOES NOT RESERVE ITS OWN BOX. `MediaFrame` does that, from the CMS ratio, before this
 * component's asset is known — which is the whole of the CLS argument in `MediaFrame`'s header.
 * MediaImage fills the frame it is placed in (`absolute inset-0 h-full w-full`), so a slow image,
 * a fast one and a 404 all occupy exactly the same space.
 *
 * `sizes` IS REQUIRED, AND THE REASON IS NOT PEDANTRY. A `srcset` without `sizes` makes the
 * browser assume the image is the full viewport width, so a 300px card in a three-column grid
 * downloads the 1920px rung. The image looks correct and the page is three times heavier than it
 * reads. Nothing about that failure is visible without opening the network panel, which is why
 * §10.1 requires the prop, why this component throws in development without it, and why
 * `scripts/perf/check-image-props.mjs` fails CI on a usage that omits it.
 *
 * IT THROWS IN DEVELOPMENT AND DEGRADES IN PRODUCTION. A missing `sizes` is a performance bug, not
 * a correctness one: taking a live page down over it would be a worse outcome than serving a
 * heavier image. Development throws so it is caught where it is cheap; production renders without
 * the attribute.
 *
 * `alt` IS REQUIRED AND MAY BE EMPTY ONLY DELIBERATELY. `alt_text` is `not null` and non-empty in
 * the database (0005, SEED §43), so the ordinary path always has one. `decorative` is the explicit
 * way to ask for `alt=""` — §10.1: "An empty alt is never produced by omission." The prop exists
 * ahead of `media_assets.is_decorative`, which Phase 41 adds (`0391_phase41_a11y.sql`).
 */

export interface MediaImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes' | 'alt'
> {
  /** The public cloud name. Public by definition — `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. */
  cloudName: string
  /** The asset, as the provider identifies it. */
  media: MediaRef
  /** Which named treatment. The width, crop, format and quality all follow from it. */
  preset: PresetName
  /**
   * The CSS width of the box at each breakpoint, e.g. `(min-width: 768px) 33vw, 100vw`.
   *
   * There is no default, and a default would be the bug: any value here that is wrong is wrong
   * silently, and "100vw" — the browser's own assumption — is precisely the wrong answer for every
   * card in a grid.
   */
  sizes: string
  /** From `media_assets.alt_text`. Ignored when `decorative` is set. */
  alt: string
  /**
   * Renders `alt=""`, hiding the image from assistive technology.
   *
   * Only for an image that carries no information the surrounding text does not already give. If
   * in doubt it is not decorative: a screen reader user skipping a described image loses nothing,
   * while one told nothing about an informative image cannot know it was there.
   */
  decorative?: boolean
  /** Crop to a D6 ratio. Usually the same ratio the enclosing `MediaFrame` reserved. */
  ratio?: AspectRatio
  /** Per-call overrides on top of the preset. Rare; the preset is the intended route. */
  spec?: TransformSpec
  /**
   * `lazy` everywhere except the one image above the fold.
   *
   * Eager is opt-in rather than the default because the cost is asymmetric: a lazy hero costs one
   * late paint on one image, while an eager grid costs every image on the page competing with the
   * hero for the same connection.
   */
  loading?: 'lazy' | 'eager'
  /**
   * THE LCP ELEMENT OF THIS ROUTE. At most one per page — Phase 40.
   *
   * It sets `loading="eager"` AND `fetchpriority="high"`, and the second half is the one that
   * matters. `loading="eager"` only stops the browser DEFERRING the request; the image still joins
   * the queue behind every stylesheet and script the parser has already found. `fetchpriority`
   * moves it to the front of that queue, which is the difference between a hero that paints with
   * the page and one that paints after it.
   *
   * PHASE 11'S RULE, GENERALISED: the largest contentful paint is always an image, never a video
   * and never a WebGL canvas, and it is chosen rather than whatever the browser happens to settle
   * on. `scripts/perf/check-priority-images.mjs` crawls the built site and fails on a route with
   * none or with two — because two high-priority images are the same as none, and the browser
   * resolves the tie by document order rather than by what matters.
   *
   * IT IS NOT SET AT CALL SITES BY HAND. The section renderers derive it from `isFirst`, which
   * `SectionList` computes, so "the first section's image" is true by construction rather than by
   * somebody remembering. A product page passes it to the gallery's first frame for the same
   * reason.
   */
  priority?: boolean
}

export function MediaImage({
  cloudName,
  media,
  preset,
  sizes,
  alt,
  decorative = false,
  ratio,
  spec,
  loading = 'lazy',
  priority = false,
  className,
  ...rest
}: MediaImageProps): React.ReactElement {
  if (process.env.NODE_ENV !== 'production' && (sizes === undefined || sizes === '')) {
    throw new Error(
      'MediaImage requires a `sizes` prop (DESIGN_SYSTEM §10.1). Without it the browser assumes ' +
        'the image is the full viewport width and downloads the largest rung in the srcset.',
    )
  }

  const resolved = resolveSpec(preset, { ...spec, ...(ratio === undefined ? {} : { ratio }) })
  const base = resolved.width ?? 0

  /**
   * A spec that fixes BOTH dimensions gets no srcset at all.
   *
   * `og` is 1200 x 630 by external specification. Generating rungs for it would either hold the
   * height at 630 while the width moved — which is a different crop at every candidate, so the
   * browser's choice would change what the picture shows — or drop the height and lose the fixed
   * size that is the whole point. A fixed-dimension image is one derivation.
   */
  const hasFixedDimensions = resolved.height !== undefined && resolved.ratio === undefined

  /**
   * Every rung is built through the SAME resolved spec with only the width replaced, so the crop,
   * gravity, format and quality cannot differ between candidates. A srcset whose entries are not
   * the same picture at different sizes is a layout that changes as the browser picks.
   *
   * `height` is deliberately dropped from the per-rung spec: with a ratio set, `imageUrl` derives
   * the height from the ratio AT THAT WIDTH, which is what keeps every candidate the same shape.
   * Carrying the base height through would letterbox every rung but one.
   */
  const candidates = hasFixedDimensions
    ? []
    : srcSet(base).map((width) => {
        const { height: _fixed, ...scalable } = resolved
        return `${imageUrl(cloudName, media, { ...scalable, width })} ${width}w`
      })

  return (
    // `next/image` is refused here deliberately, and the lint warning is wrong for this codebase:
    // it would put Next's own optimiser in front of Cloudinary — a second resize of an
    // already-resized image, billed twice — and bypass the preset table and width ladder entirely,
    // which are the mechanism D1 and PHASE-05-09.md §06 put the media policy behind. DESIGN_SYSTEM
    // §10.1 makes this one of exactly two components permitted to emit an `<img>`, for this reason.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // The `src` is the preset's own width, not the smallest rung: it is what a browser without
      // srcset support gets, and what the srcset falls back to.
      src={imageUrl(cloudName, media, resolved)}
      srcSet={candidates.length > 0 ? candidates.join(', ') : undefined}
      sizes={sizes === '' ? undefined : sizes}
      alt={decorative ? '' : alt}
      // `priority` implies eager: an LCP candidate the browser is told to fetch first must not
      // also be told it may wait.
      loading={priority ? 'eager' : loading}
      fetchPriority={priority ? 'high' : undefined}
      // Always async. Decoding a large image on the main thread blocks interaction, and there is
      // no case in this product where a synchronous decode is worth that.
      decoding="async"
      // `object-cover` matches the `c_fill` every preset asks for, so the CSS and the delivered
      // crop agree. Square corners on all media: --rv-radius-0, §6.1.
      className={cn('absolute inset-0 h-full w-full rounded-none object-cover', className)}
      {...rest}
    />
  )
}
