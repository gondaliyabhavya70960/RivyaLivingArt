import * as React from 'react'

import { EditorialFallback } from '@/components/patterns/EditorialFallback'
import { Stack } from '@/components/primitives/Stack'

import { cardLayoutOf } from './CardLayout'
import { ReferenceCards } from './ReferenceCards'
import { SectionActions } from './SectionActions'
import { SectionCopy, cardHeadingLevel } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Journal articles, when there are any.
 *
 * THE THIRD REFERENCE BLOCK, AND THE ONE WITH CONTENT ALREADY WRITTEN. Phase 09 authored nineteen
 * articles and deferred every one of them, because `journal_articles` is not created until Phase
 * 18 — so the selector answers `NOT_YET_BUILT`, this renders `EMPTY_STATE.journal`, and it will
 * keep rendering it after the table arrives until an article is published. Same code path, two
 * different reasons, one honest page.
 *
 * IT HAS NO MEDIA OF ITS OWN. The block declares no slots: an article's picture belongs to the
 * article, and a decorative band above a list of nothing would be a picture standing in for
 * writing that has not been published. The copy and the CTA carry the section until it fills.
 */
const FALLBACK_KEY = 'EMPTY_STATE.journal'

export function JournalStripSection({
  section,
  strings,
  cloudName,
  reference,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const cards = reference?.result.cards ?? []
  /*
   * Phase 22: on the homepage this band is answered by `HOMEPAGE_JOURNAL_STRIP`, whose fallback is
   * HIDE_SECTION — below three articles the band is absent rather than a heading over a sentence.
   * On any other page the selector runs its own query and no mode arrives, so the seeded
   * `EMPTY_STATE.journal` still renders exactly as Phase 11 wrote it.
   */
  const outcome = reference?.result.merchandising
  if (cards.length === 0 && outcome?.fallback?.mode === 'HIDE_SECTION') return null

  return (
    <SectionShell section={section}>
      <Stack gap={10} data-provenance={outcome?.provenance} data-slot={outcome?.slotKey}>
        <SectionCopy section={section} />
        {cards.length === 0 ? (
          reference === undefined ? null : (
            <EditorialFallback
              strings={strings}
              contentKey={FALLBACK_KEY}
              reason={reference.result.reason}
            />
          )
        ) : (
          <ReferenceCards
            headingLevel={cardHeadingLevel(section)}
            layout={cardLayoutOf(section, 'strip')}
            label={section.heading}
            cards={cards}
            assets={reference?.assets ?? new Map()}
            marker="data-article-card"
            ratio="16:9"
            mobileRatio="4:5"
            sizes="(min-width: 1024px) 33vw, (min-width: 430px) 50vw, 100vw"
            strings={strings}
            cloudName={cloudName}
          />
        )}
        <SectionActions section={section} livePaths={livePaths} />
      </Stack>
    </SectionShell>
  )
}
