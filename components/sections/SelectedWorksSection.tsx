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
 *
 * PHASE 22 TAUGHT THIS RENDERER THE THREE FALLBACK MODES, AND NOTHING ELSE. The selector swap
 * itself changed no line here — the seam held. What changed afterwards is what an EMPTY answer
 * looks like when a merchandising slot gave it: `HIDE_SECTION` renders nothing at all, heading
 * included, because a heading over nothing is a promise the page cannot keep; `EDITORIAL_BLOCK`
 * renders the seeded sentence AND the tiles `lib/cms/references.ts` built from the fallback section;
 * `SHOW_EMPTY_STATE` renders the sentence alone, which is what Phase 11 always did. Provenance
 * travels as `data-provenance` so a reader of the page can tell CURATED from RULE_FILLED without
 * opening the Studio.
 */
const FALLBACK_KEY = 'EMPTY_STATE.collection'

export function SelectedWorksSection({
  section,
  media,
  strings,
  cloudName,
  reference,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  /*
   * THE PAYLOAD IS NOT PARSED HERE, and its absence is the seam working rather than an omission.
   * `lib/cms/references.ts` read `limit`, `selection` and `category_slug` before render, asked the
   * selector, and what arrived is the answer. Re-parsing to display nothing from it would be the
   * beginning of a second opinion about how many cards to show.
   */
  const cards = reference?.result.cards ?? []
  const outcome = reference?.result.merchandising
  const mode = cards.length === 0 ? (outcome?.fallback?.mode ?? null) : null
  if (mode === 'HIDE_SECTION') return null

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={10} data-provenance={outcome?.provenance} data-slot={outcome?.slotKey}>
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
              tiles={mode === 'EDITORIAL_BLOCK' ? (reference.tiles ?? []) : []}
              cloudName={cloudName}
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
        <SectionActions section={section} livePaths={livePaths} />
      </Stack>
    </SectionShell>
  )
}
