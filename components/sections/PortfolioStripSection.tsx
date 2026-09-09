import * as React from 'react'

import { EditorialFallback } from '@/components/patterns/EditorialFallback'
import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'

import { ReferenceCards } from './ReferenceCards'
import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import { parseBlockPayload } from '@/lib/cms/registry'
import { portfolioStripBlock } from '@/content/blocks/portfolio-strip'
import type { SectionRenderProps } from './types'

/**
 * Delivered projects, when there are any.
 *
 * `portfolio_projects` DOES NOT EXIST UNTIL PHASE 17, so the selector answers `NOT_YET_BUILT` and
 * this band renders its copy, its backdrop and the seeded `EMPTY_STATE.portfolio` sentence. After
 * Phase 17 creates the table it will answer `EMPTY` until real delivered work is published, and
 * the page will look exactly the same — which is what makes the empty state trustworthy rather
 * than a branch that only ever ran in development.
 *
 * THE BACKDROP IS ATMOSPHERE AND IS NEVER A PROJECT. It carries no caption, no credit and no
 * heading of its own, and it is one wide picture rather than a row of them: a photograph laid out
 * beside the word "projects" reads as a project whatever its alt text says, and Rivya has not
 * confirmed a single delivered one. That restraint is the section's whole design, not a
 * placeholder for a gallery to be added later.
 */
const FALLBACK_KEY = 'EMPTY_STATE.portfolio'

export function PortfolioStripSection({
  section,
  media,
  strings,
  cloudName,
  reference,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const cards = reference?.result.cards ?? []
  // `?? true` preserves what every row written before this key existed already did.
  const showEmptyState =
    parseBlockPayload(portfolioStripBlock, section.payload).show_empty_state ?? true

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={10}>
        <SectionCopy section={section} />
        {media.desktop === null && media.mobile === null ? null : (
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
        )}
        {cards.length === 0 ? (
          /*
           * `show_empty_state` false means a neighbour already says it. `/portfolio` carries the
           * seeded `empty-state` block with the same content key, and two identical sentences
           * stacked on one page reads as a bug rather than as emphasis.
           */
          reference === undefined || showEmptyState === false ? null : (
            <EditorialFallback
              strings={strings}
              contentKey={FALLBACK_KEY}
              reason={reference.result.reason}
            />
          )
        ) : (
          <ReferenceCards
            cards={cards}
            assets={reference?.assets ?? new Map()}
            marker="data-project-card"
            ratio="3:2"
            mobileRatio="4:5"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            strings={strings}
            cloudName={cloudName}
          />
        )}
        <SectionActions section={section} livePaths={livePaths} />
      </Stack>
    </SectionShell>
  )
}
