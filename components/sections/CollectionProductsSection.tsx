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
 * The pieces in a collection. FEAT §8 element 4.
 *
 * IT LOOKS LIKE `SelectedWorksSection` AND ASKS A DIFFERENT QUESTION. That band shows what
 * merchandising chose across the whole catalogue; this one shows what a curator put in ONE
 * collection, in the order they arranged it. The resemblance is the point — a visitor should not
 * have to learn two card grids — and the difference is entirely upstream, in
 * `lib/cms/references.ts`, which resolved the collection from the page before render.
 *
 * NO BACKDROP, WHERE `selected-works` HAS ONE. The block declares no media at all: on a page about
 * one collection, an editor's picture sitting behind a row OF PRODUCTS is the single most likely
 * place for a stray image to be read as a piece that does not exist.
 *
 * EMPTY IS THE ORDINARY CASE TODAY AND THE BAND STILL PUBLISHES. All ten seeded concepts have no
 * products attached — attaching them is an owner act the phase deliberately leaves undone — so
 * what renders is the section's own copy and the seeded `EMPTY_STATE.collection` sentence, "This
 * collection is being prepared". Not a skeleton, which would claim something is loading, and not a
 * placeholder card, which would be a fabricated product (D10).
 */
const FALLBACK_KEY = 'EMPTY_STATE.collection'

export function CollectionProductsSection({
  section,
  strings,
  cloudName,
  reference,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  /*
   * `reference` IS UNDEFINED ONLY OUTSIDE A PAGE RENDER — a Studio preview that built a section
   * list without loading references. Rendering the empty state there would tell an editor their
   * collection is empty when nothing has been asked; rendering the copy alone is the honest
   * output, and matches what the other three reference bands do.
   */
  const cards = reference?.result.cards ?? []

  return (
    <SectionShell section={section}>
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
            headingLevel={cardHeadingLevel(section)}
            layout={cardLayoutOf(section, 'grid')}
            label={section.heading}
            cards={cards}
            assets={reference?.assets ?? new Map()}
            marker="data-product-card"
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
