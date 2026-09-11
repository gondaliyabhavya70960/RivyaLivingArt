import * as React from 'react'

import { HeroMotion } from '@/components/patterns/HeroMotion'
import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'
import { heroBlock } from '@/content/blocks/hero'
import { altTextOf, mediaRefOf } from '@/lib/cms/media'
import { parseBlockPayload } from '@/lib/cms/registry'
import { MEDIA_PLAY_LABEL_KEY, siteStringOrEmpty } from '@/lib/cms/strings'

import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The page opener.
 *
 * THE STILL IS THE HERO AND THE VIDEO IS A LAYER OVER IT. Phase 11 states the rule as a budget —
 * the Largest Contentful Paint element must be the image, never the clip — and the shape of this
 * file is the rule made structural: there is exactly one media path, `ResponsiveMedia`, and the
 * motion layer is an overlay that may never mount. Until Phase 11 a hero marked `is_video`
 * rendered a `<video>` INSTEAD of the still, which made the largest element on the page a media
 * element that most visitors are never allowed to play.
 *
 * IT IS THE ONLY SECTION ALLOWED TO LOAD MEDIA EAGERLY, and only when it is the first on the
 * page. `isFirst` comes from the list, not from a guess about the block type: a hero placed
 * halfway down a page is below the fold, and marking it eager would put it in competition with
 * whatever is actually above the fold for the same connection.
 *
 * THE COPY OVERLAYS THE MEDIA on `full-bleed`, and sits beneath it on `contained`. That is the
 * only difference between the two variants, and it is why the veil is tied to the variant rather
 * than to an editor toggle: overlay ink over a photograph needs the §2.5 gradient to hold its
 * contrast ratio, and ink on the page ground does not.
 *
 * BOTH EDITORIAL SWITCHES MUST BE ON FOR THE CLIP TO MOUNT. `is_video` says this hero is a moving
 * piece; `autoplay` says it may start by itself. With `autoplay` off the still stands alone rather
 * than growing a play control — an overlay button in the hero would sit on top of the section's
 * own calls to action, offering a third and louder one. `HeroMotion` then applies the five
 * technical gates on top, and renders nothing if any of them refuses.
 */
export function HeroSection({
  section,
  media,
  strings,
  cloudName,
  isFirst,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(heroBlock, section.payload)
  const variant = section.layout_variant ?? 'full-bleed'
  const overlaid = variant === 'full-bleed'

  const still = media.desktop ?? media.mobile
  const [poster] = media.slot('poster')
  const [motion] = media.slot('motion-desktop')

  const copy = (
    <Stack gap={6} className={overlaid ? 'items-start' : ''}>
      <SectionCopy section={section} level={isFirst ? 1 : 2} size="display-xl" />
      <SectionActions section={section} livePaths={livePaths} />
    </Stack>
  )

  return (
    <SectionShell section={section} spacing="lg" container={overlaid ? 'none' : 'default'}>
      <div className="relative">
        <ResponsiveMedia
          desktop={media.desktop}
          mobile={media.mobile}
          desktopRatio="21:9"
          mobileRatio="9:16"
          preset="hero"
          altOverride={section.media_alt_override}
          strings={strings}
          cloudName={cloudName}
          eager={isFirst}
          // Phase 40: the first section of a page owns the route's one LCP hint.
          priority={isFirst}
          veil={overlaid}
        />
        {payload.is_video && payload.autoplay && motion != null ? (
          <HeroMotion
            cloudName={cloudName}
            media={mediaRefOf(motion)}
            /*
             * The poster is an editor's chosen opening frame if there is one and the STILL
             * otherwise — never a frame of the clip. Phase 11's binding table says why: the
             * desktop still is 21:9 and the only desktop clip in the library is 16:9, so a poster
             * taken from the clip would paint a differently-framed picture over the one the
             * visitor is already looking at.
             */
            posterPublicId={(poster ?? still)?.public_id ?? null}
            durationSeconds={motion.duration_s}
            alt={altTextOf(motion, section.media_alt_override)}
            playLabel={siteStringOrEmpty(strings, MEDIA_PLAY_LABEL_KEY)}
          />
        ) : null}
        {overlaid ? (
          <div className="absolute inset-x-0 bottom-0 p-(--rv-gutter)">{copy}</div>
        ) : null}
      </div>
      {overlaid ? null : <div className="mt-8">{copy}</div>}
    </SectionShell>
  )
}
