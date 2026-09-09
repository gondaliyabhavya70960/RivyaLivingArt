import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The closing conversion band.
 *
 * ITS SECOND BUTTON IS NOT A WHATSAPP LINK, and that is D1 rather than a design preference. A chat
 * opened from here would carry no enquiry, so it would have to use `buildDirectContactUrl` —
 * which `scripts/site/check-whatsapp-usage.mjs` permits only in the announcement bar, the footer
 * and `/contact`. `SectionActions` renders whatever `cta_secondary_url` holds; SEED §10-13 leaves
 * that destination empty on purpose, because the real number is a business fact nobody has given
 * us, and Phase 20 resolves the button against `NEXT_PUBLIC_WHATSAPP_NUMBER`. Until then the
 * label exists and the destination is honestly absent, so the button does not render at all.
 *
 * THE COPY OVERLAYS THE PICTURE ON `banded` AND SITS BENEATH IT ON `centred`, which is the same
 * arrangement the hero uses and the same reason: overlay ink over a photograph needs the §2.5
 * veil to hold its contrast ratio, and ink on the page ground does not. `veil` is therefore tied
 * to the variant rather than to an editor toggle.
 */
export function FinalCtaSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  if (!hasSectionCopy(section)) return null

  const centred = (section.layout_variant ?? 'banded') === 'centred'
  const hasMedia = media.desktop !== null || media.mobile !== null

  const copy = (
    <Stack gap={6} className={centred ? 'items-center' : 'items-start'}>
      <SectionCopy
        section={section}
        size="display-lg"
        align={centred ? 'centre' : 'start'}
        maxWidth="prose"
      />
      <SectionActions section={section} align={centred ? 'centre' : 'start'} />
    </Stack>
  )

  if (centred || !hasMedia) {
    return (
      <SectionShell section={section} spacing="lg" container="prose">
        <Stack gap={10}>
          {copy}
          {hasMedia ? (
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
          ) : null}
        </Stack>
      </SectionShell>
    )
  }

  return (
    <SectionShell section={section} spacing="lg" container="none">
      <div className="relative">
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
          veil
        />
        <div className="absolute inset-x-0 bottom-0 p-(--rv-gutter)">{copy}</div>
      </div>
    </SectionShell>
  )
}
