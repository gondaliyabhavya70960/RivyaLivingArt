import * as React from 'react'

import { MediaFrame } from '@/components/primitives/MediaFrame'
import { MediaImage } from '@/components/patterns/MediaImage'
import { MediaVideo } from '@/components/patterns/MediaVideo'
import type { AspectRatio } from '@/components/primitives/AspectBox'
import { altTextOf, mediaRefOf } from '@/lib/cms/media'
import { siteStringOrEmpty, type SiteStrings } from '@/lib/cms/strings'
import type { PresetName } from '@/lib/media/transform'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The two ways a section shows an asset: one picture, or a desktop/mobile pair.
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

const FALLBACK_KEY = 'error.media_unavailable.label'
const PLAY_KEY = 'media.play.label'

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
  return (
    <MediaFrame
      ratio={ratio}
      mobileRatio={mobileRatio}
      fallbackLabel={siteStringOrEmpty(strings, FALLBACK_KEY)}
      veil={veil && asset !== null}
      overlay={overlay}
      className={className}
    >
      {asset === null ? null : (
        <MediaImage
          cloudName={cloudName}
          media={mediaRefOf(asset)}
          preset={preset}
          sizes={sizes}
          alt={altTextOf(asset, altOverride)}
          ratio={ratio}
          loading={eager ? 'eager' : 'lazy'}
        />
      )}
    </MediaFrame>
  )
}

export type BlockVideoProps = {
  readonly asset: MediaAsset
  readonly poster: MediaAsset | null
  readonly altOverride?: string | null
  readonly strings: SiteStrings
  readonly cloudName: string
  readonly loop?: boolean
  readonly className?: string
}

/**
 * A video, with its poster.
 *
 * THE POSTER IS THE VIDEO'S OWN FRAME OR NOTHING. `posterPublicId` falls back to the asset's
 * `poster_public_id` — the still Cloudinary derived from this video — and never to a related
 * photograph: under reduced motion the poster IS the experience, and showing a different picture
 * there means the visitor who cannot see the video sees something the video never contained.
 */
export function BlockVideo({
  asset,
  poster,
  altOverride = null,
  strings,
  cloudName,
  loop = true,
  className,
}: BlockVideoProps): React.ReactElement {
  return (
    <MediaVideo
      cloudName={cloudName}
      media={mediaRefOf(asset)}
      posterPublicId={poster?.public_id ?? asset.poster_public_id}
      durationSeconds={asset.duration_s}
      alt={altTextOf(asset, altOverride)}
      playLabel={siteStringOrEmpty(strings, PLAY_KEY)}
      loop={loop}
      className={className}
    />
  )
}

export type ResponsiveMediaProps = {
  readonly desktop: MediaAsset | null
  readonly mobile: MediaAsset | null
  readonly desktopRatio: AspectRatio
  readonly mobileRatio: AspectRatio
  readonly preset: PresetName
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
  altOverride = null,
  strings,
  cloudName,
  eager = false,
  veil = false,
  overlay,
}: ResponsiveMediaProps): React.ReactElement {
  const shared = { preset, altOverride, strings, cloudName, eager, veil, overlay } as const

  if (desktop !== null && mobile !== null && desktop.id !== mobile.id) {
    return (
      <>
        <BlockImage
          {...shared}
          asset={mobile}
          ratio={mobileRatio}
          sizes="100vw"
          className="md:hidden"
        />
        <BlockImage
          {...shared}
          asset={desktop}
          ratio={desktopRatio}
          sizes="100vw"
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
      sizes="100vw"
    />
  )
}
