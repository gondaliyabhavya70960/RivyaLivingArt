import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { heroBlock } from '@/content/blocks/hero'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { BlockVideo, ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The page opener.
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
 */
export function HeroSection({
  section,
  media,
  strings,
  cloudName,
  isFirst,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(heroBlock, section.payload)
  const variant = section.layout_variant ?? 'full-bleed'
  const overlaid = variant === 'full-bleed'

  const asset = media.desktop ?? media.mobile
  const isVideo = payload.is_video && asset !== null && asset.resource_type === 'video'
  const [poster] = media.slot('poster')

  const copy = (
    <Stack gap={6} className={overlaid ? 'items-start' : ''}>
      <SectionCopy section={section} level={isFirst ? 1 : 2} size="display-xl" />
      <SectionActions section={section} />
    </Stack>
  )

  if (isVideo && asset !== null) {
    return (
      <SectionShell section={section} spacing="lg" container={overlaid ? 'none' : 'default'}>
        <div className="relative">
          <BlockVideo
            asset={asset}
            poster={poster ?? null}
            altOverride={section.media_alt_override}
            strings={strings}
            cloudName={cloudName}
          />
          {overlaid ? (
            <div className="absolute inset-x-0 bottom-0 p-(--rv-gutter)">{copy}</div>
          ) : null}
        </div>
        {overlaid ? null : <div className="mt-8">{copy}</div>}
      </SectionShell>
    )
  }

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
          veil={overlaid}
        />
        {overlaid ? (
          <div className="absolute inset-x-0 bottom-0 p-(--rv-gutter)">{copy}</div>
        ) : null}
      </div>
      {overlaid ? null : <div className="mt-8">{copy}</div>}
    </SectionShell>
  )
}
