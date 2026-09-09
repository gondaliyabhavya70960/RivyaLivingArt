import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The statement about scale, over one wide picture. SEED §11-03.
 *
 * 21:9 ON DESKTOP AND 4:5 ON MOBILE, FROM TWO DIFFERENT ASSETS. This is the site's one editorial
 * use of a 21:9 crop and the only place the pair matters this much: 21:9 squeezed into a phone is
 * a letterbox forty pixels tall, so the mobile half is a frame of its own rather than a CSS crop
 * of the wide one. `ResponsiveMedia` emits both and hides one per breakpoint, which keeps each
 * asset's own alt text — a `<picture>` would have one `alt` for both.
 *
 * THE COPY IS NEVER OVER THE PICTURE. Every other wide band on the site can overlay its heading
 * behind a veil; this one does not, because the section's whole subject is the PICTURE's scale and
 * ink across it competes with the thing it is describing. `image-above` and `image-below` move the
 * band, and neither overlays.
 *
 * AS SEEDED IT IS WITHHELD WHOLE, so this renders on no public page at launch. §11 flags it and
 * the phase document agrees — the body claims what the studio's primary direction is and what else
 * it makes, which is capability. The owner clearing that flag is one field in Studio.
 */
export function ScaleStatementSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const hasMedia = media.desktop !== null || media.mobile !== null
  if (!hasSectionCopy(section) && !hasMedia) return null

  const below = (section.layout_variant ?? 'image-above') === 'image-below'

  const picture = hasMedia ? (
    <ResponsiveMedia
      desktop={media.desktop}
      mobile={media.mobile}
      desktopRatio="21:9"
      mobileRatio="4:5"
      preset="hero"
      sizes="100vw"
      altOverride={section.media_alt_override}
      strings={strings}
      cloudName={cloudName}
    />
  ) : null

  const copy = (
    <Stack gap={6}>
      <SectionCopy section={section} size="display-lg" />
      <SectionActions section={section} />
    </Stack>
  )

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={10}>
        {below ? null : picture}
        {copy}
        {below ? picture : null}
      </Stack>
    </SectionShell>
  )
}
