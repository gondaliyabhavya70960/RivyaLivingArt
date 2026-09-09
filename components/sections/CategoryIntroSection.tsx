import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'

import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The paragraph that introduces a page's categories. SEED §12-02.
 *
 * IT SITS TIGHT TO WHAT FOLLOWS, which is the only thing separating it from `statement`. A
 * category introduction is not a band in its own right — it is the sentence above a list, and the
 * space beneath it belongs to the list. `spacing="md"` and no bottom emphasis; `StatementSection`
 * takes the full rhythm because nothing is depending on it.
 *
 * NO CALL TO ACTION, and the block declares none. The destination is the list underneath.
 */
export function CategoryIntroSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const hasMedia = media.desktop !== null || media.mobile !== null
  if (!hasSectionCopy(section) && !hasMedia) return null

  const centred = section.layout_variant === 'centred'

  return (
    <SectionShell section={section} spacing="md" container={centred ? 'prose' : 'default'}>
      <Stack gap={8}>
        <SectionCopy
          section={section}
          size="display-lg"
          align={centred ? 'centre' : 'start'}
          maxWidth="prose"
        />
        {hasMedia ? (
          <ResponsiveMedia
            desktop={media.desktop}
            mobile={media.mobile}
            desktopRatio="16:9"
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
