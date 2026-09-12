import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * An image beside copy, either way round. The general case of the shape `manifesto` uses once.
 *
 * THE VARIANT MOVES THE PICTURE, NOT THE ORDER OF THE MARKUP. `image-left` reorders the two columns
 * with `order-2` at the grid breakpoint and leaves the DOM alone, so a screen reader and a keyboard
 * both meet the copy first at every width — the visual arrangement is art direction and the reading
 * order is meaning. `ManifestoSection` states the same rule; this is the same decision, not a
 * coincidence.
 *
 * AN ABSENT ASSET DOES NOT STOP IT RENDERING AND ABSENT COPY DOES. `ResponsiveMedia` draws its
 * reserved box with the seeded fallback label when nothing resolves — the layout was sized for it —
 * but a split with no words is a picture with a column of nothing beside it.
 *
 * 4:3 AND 4:5, NOT THE MANIFESTO'S 4:5 PAIR. A general-purpose band sits beside a paragraph rather
 * than a manifesto, and a portrait at that width leaves a column of copy floating against a tall
 * image. The mobile ratio stays portrait because a single-column phone layout has the height for it
 * and a landscape crop at 390px is a letterbox.
 */
export function MediaSplitSection({
  section,
  media,
  strings,
  cloudName,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  if (!hasSectionCopy(section)) return null

  const imageLeft = (section.layout_variant ?? 'image-right') === 'image-left'

  return (
    <SectionShell section={section}>
      <div
        className={`grid gap-8 md:grid-cols-2 md:items-center md:gap-12 ${
          imageLeft ? '[&>*:first-child]:md:order-2' : ''
        }`}
      >
        <Stack gap={6}>
          <SectionCopy section={section} />
          <SectionActions section={section} livePaths={livePaths} />
        </Stack>
        <ResponsiveMedia
          desktop={media.desktop}
          mobile={media.mobile}
          desktopRatio="4:3"
          mobileRatio="4:5"
          preset="grid"
          sizes="(min-width: 768px) 50vw, 100vw"
          altOverride={section.media_alt_override}
          strings={strings}
          cloudName={cloudName}
        />
      </div>
    </SectionShell>
  )
}
