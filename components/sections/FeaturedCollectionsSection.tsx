import * as React from 'react'

import { EditorialFallback } from '@/components/patterns/EditorialFallback'
import { Stack } from '@/components/primitives/Stack'

import { ReferenceCards } from './ReferenceCards'
import { SectionActions } from './SectionActions'
import { SectionCopy, cardHeadingLevel } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Featured collections and categories, chosen in Studio → Merchandising → Featured. Phase 22.
 *
 * THE FOURTH REFERENCE BLOCK, AND THE ONLY ONE WITH NO QUERY OF ITS OWN. `selectFeatured` answers
 * from `HOMEPAGE_FEATURED_COLLECTIONS` and from nothing else: which collections are featured is the
 * owner's decision or nobody's, so a page with no slot gets EMPTY rather than "the newest three".
 * The slot's fallback is HIDE_SECTION — below three the band is absent, heading included — which is
 * why this renderer can return null before drawing anything.
 *
 * A CONCEPT CANNOT REACH THIS BAND. `guard_merchandising_entry()` refuses an entry naming a
 * collection whose `concept_state` is not OWNER_CONFIRMED, and the resolver re-checks every target
 * is PUBLISHED on every read; a card here is a collection the owner has confirmed exists and an
 * editor has published. The cards themselves are `ReferenceCards`: a name, a line and a picture.
 */
const FALLBACK_KEY = 'EMPTY_STATE.collection'

export function FeaturedCollectionsSection({
  section,
  strings,
  cloudName,
  reference,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const cards = reference?.result.cards ?? []
  const outcome = reference?.result.merchandising
  const mode = cards.length === 0 ? (outcome?.fallback?.mode ?? null) : null
  if (mode === 'HIDE_SECTION') return null

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
            cards={cards}
            assets={reference?.assets ?? new Map()}
            marker="data-collection-card"
            ratio="4:5"
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
