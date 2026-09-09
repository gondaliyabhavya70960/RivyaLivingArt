import * as React from 'react'

import { MediaVideo } from '@/components/patterns/MediaVideo'
import { altTextOf, mediaRefOf } from '@/lib/cms/media'
import { MEDIA_PLAY_LABEL_KEY, siteStringOrEmpty, type SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * A CMS-bound video in a section, with its poster.
 *
 * IT LIVED IN `MediaSlot` UNTIL PHASE 11 AND MOVED HERE FOR ONE MEASURED REASON. `MediaSlot` is a
 * Server Component that almost every section renderer imports, and it imported `MediaVideo`, which
 * is a Client Component — so every route with any section at all pulled the video island into its
 * client bundle whether or not a single video was rendered. Reachability in the module graph is
 * what ships JavaScript, not whether a branch runs. `scripts/site/check-island-budget.mjs` counts
 * exactly that, and with this import inside `MediaSlot` the homepage carried five islands where
 * Phase 11's budget names four.
 *
 * SO THE COST IS NOW PAID BY THE PAGES THAT ACTUALLY SHOW A VIDEO. A renderer that needs one
 * imports this module and takes the island with it; a renderer that does not, does not.
 *
 * THE POSTER IS THE VIDEO'S OWN FRAME OR NOTHING. `posterPublicId` falls back to the asset's
 * `poster_public_id` — the still Cloudinary derived from this video — and never to a related
 * photograph: under reduced motion the poster IS the experience, and showing a different picture
 * there means the visitor who cannot see the video sees something the video never contained.
 */

export type BlockVideoProps = {
  readonly asset: MediaAsset
  readonly poster: MediaAsset | null
  readonly altOverride?: string | null
  readonly strings: SiteStrings
  readonly cloudName: string
  readonly loop?: boolean
  readonly className?: string
}

export function BlockVideo({
  asset,
  poster,
  altOverride = null,
  strings,
  cloudName,
  loop = true,
  className,
}: BlockVideoProps): React.ReactElement | null {
  /*
   * NOTHING RATHER THAN A BROKEN PLAYER. With no cloud name `videoUrl` builds a source that
   * resolves to nothing and a poster that does the same, so the visitor gets a control that plays
   * an error. `BlockImage`'s well is the right answer for a still because the layout reserved a
   * box for it; a video the page cannot deliver has nothing to say in that box, and its caller —
   * `HeroSection` — already falls back to the image branch when there is no video.
   */
  if (cloudName === '') return null

  return (
    <MediaVideo
      cloudName={cloudName}
      media={mediaRefOf(asset)}
      posterPublicId={poster?.public_id ?? asset.poster_public_id}
      durationSeconds={asset.duration_s}
      alt={altTextOf(asset, altOverride)}
      playLabel={siteStringOrEmpty(strings, MEDIA_PLAY_LABEL_KEY)}
      loop={loop}
      className={className}
    />
  )
}
