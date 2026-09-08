import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The brand statement band: a paragraph of position, beside a picture of the material.
 *
 * THE COPY IS THE SECTION AND THE PICTURE IS SUPPORT, which is why an absent asset does not stop
 * it rendering while absent copy does. `ResponsiveMedia` draws its reserved box with the seeded
 * fallback label when nothing resolves — the layout was sized for it — but a manifesto with no
 * words is a band of colour, and `StatementSection` states the same rule for the same reason.
 *
 * THE VARIANT MOVES THE PICTURE, NOT THE ORDER OF THE MARKUP. `image-left` reorders the two
 * columns with `order-2` at the grid breakpoint and leaves the DOM alone, so a screen reader and
 * a keyboard both meet the copy first at every width — the visual arrangement is art direction
 * and the reading order is meaning.
 *
 * AS SEEDED IT IS WITHHELD WHOLE. SEED §10-02's body asserts that Rivya combines resin with wood,
 * digitally developed structures and careful finishing; the claim is the paragraph rather than an
 * item inside it, so `page_sections.owner_verification` carries the flag and the Phase 08 publish
 * trigger refuses the row until the owner confirms. This renderer is what runs the moment they do.
 */
export function ManifestoSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  if (!hasSectionCopy(section)) return null

  const variant = section.layout_variant ?? 'image-right'
  const centred = variant === 'centred'

  const copy = (
    <Stack gap={6} className={centred ? 'items-center' : ''}>
      <SectionCopy section={section} size="display-lg" align={centred ? 'centre' : 'start'} />
      <SectionActions section={section} align={centred ? 'centre' : 'start'} />
    </Stack>
  )

  if (centred) {
    return (
      <SectionShell section={section} spacing="lg" container="prose">
        {copy}
      </SectionShell>
    )
  }

  return (
    <SectionShell section={section} spacing="lg">
      <div
        className={`grid gap-8 md:grid-cols-2 md:items-center md:gap-12 ${
          variant === 'image-left' ? '[&>*:first-child]:md:order-2' : ''
        }`}
      >
        {copy}
        <ResponsiveMedia
          desktop={media.desktop}
          mobile={media.mobile}
          desktopRatio="4:5"
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
