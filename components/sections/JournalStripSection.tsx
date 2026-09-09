import * as React from 'react'

import { EditorialFallback } from '@/components/patterns/EditorialFallback'
import { Stack } from '@/components/primitives/Stack'

import { ReferenceCards } from './ReferenceCards'
import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
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
}: SectionRenderProps): React.ReactElement | null {
  const cards = reference?.result.cards ?? []

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={10}>
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
            cards={cards}
            assets={reference?.assets ?? new Map()}
            marker="data-article-card"
            ratio="16:9"
            mobileRatio="4:5"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            strings={strings}
            cloudName={cloudName}
          />
        )}
        <SectionActions section={section} />
      </Stack>
    </SectionShell>
  )
}
