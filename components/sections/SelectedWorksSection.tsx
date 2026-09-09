import * as React from 'react'

import { EditorialFallback } from '@/components/patterns/EditorialFallback'
import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'

import { ReferenceCards } from './ReferenceCards'
import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Products, when there are any.
 *
 * TODAY THERE ARE NONE, AND THE BAND STILL PUBLISHES. `products` has zero published rows and
 * Phases 14 and 15 seed none, so `selectProducts` answers `EMPTY` and what renders is the
 * section's own copy, its backdrop and the seeded `EMPTY_STATE.collection` sentence. Not a
 * skeleton, which would claim something is loading, and not a placeholder product, which would be
 * the fabrication D10 forbids in its plainest form — `EditorialFallback` states the argument in
 * full.
 *
 * THE PAYLOAD ASKS A QUESTION AND THIS RENDERER DOES NOT ANSWER IT. `limit`, `selection` and
 * `category_slug` were read in `lib/cms/references.ts` before render and handed to the selector;
 * the answer arrives as `props.reference`. Phase 22 replaces the selector with real merchandising
 * and this file does not change, which is the whole reason for the seam.
 *
 * `reference` IS OPTIONAL ON THE PROPS AND REQUIRED HERE. It is `undefined` only for a block that
 * is not a reference block — or for a Studio preview that rendered a section list without loading
 * references — and in both cases the honest output is the copy with neither cards nor an empty
 * state, because nothing has been asked and so nothing is known.
 */
const FALLBACK_KEY = 'EMPTY_STATE.collection'

export function SelectedWorksSection({
  section,
  media,
  strings,
  cloudName,
  reference,
}: SectionRenderProps): React.ReactElement | null {
  /*
   * THE PAYLOAD IS NOT PARSED HERE, and its absence is the seam working rather than an omission.
   * `lib/cms/references.ts` read `limit`, `selection` and `category_slug` before render, asked the
   * selector, and what arrived is the answer. Re-parsing to display nothing from it would be the
   * beginning of a second opinion about how many cards to show.
   */
  const cards = reference?.result.cards ?? []

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={10}>
        <SectionCopy section={section} />
        {media.desktop === null && media.mobile === null ? null : (
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
        )}
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
            marker="data-product-card"
            ratio="4:5"
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
