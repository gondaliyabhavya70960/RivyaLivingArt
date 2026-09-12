import * as React from 'react'

import { ReferenceCards, type ReferenceMarker } from '@/components/sections/ReferenceCards'
import type { AspectRatio } from '@/components/primitives/AspectBox'
import { Container } from '@/components/primitives/Container'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import type { ResolvedSlot } from '@/lib/cms/merchandising'
import type { SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * A merchandising slot rendered by a ROUTE rather than by a block. Phase 22, RC-243.
 *
 * TWO SLOTS HAVE NO BLOCK TO LIVE IN. `STORE_FEATURED_ROW` sits above the catalogue on
 * `/collection`, and the seven `CATEGORY_PINNED_*` slots sit above the grid on their category
 * pages — both regions the route appends beneath the page's CMS sections (`renderCmsPage`'s
 * `below`), because a listing is a query and not copy. This is the one component those routes
 * share, and it renders NOTHING when the slot resolved to nothing: the store row's fallback is
 * HIDE_SECTION, and a pinned slot's SHOW_EMPTY_STATE is already what the listing beneath it says
 * when a category holds no products at all, so a second sentence would be the same sentence twice.
 *
 * THE HEADING IS A `global_content` STRING resolved by the route, never a literal here; a row with
 * no heading string draws the cards alone. The cards are `ReferenceCards` — a name, a line and a
 * picture — for the reason that component states: a featured row that showed a price would be a
 * price the merchandiser did not set.
 */
export type MerchandisedRowProps = {
  readonly resolved: ResolvedSlot
  readonly assets: ReadonlyMap<string, MediaAsset>
  readonly heading: string | null
  readonly marker: ReferenceMarker
  readonly ratio: AspectRatio
  readonly strings: SiteStrings
  readonly cloudName: string
}

export function MerchandisedRow({
  resolved,
  assets,
  heading,
  marker,
  ratio,
  strings,
  cloudName,
}: MerchandisedRowProps): React.ReactElement | null {
  if (resolved.cards.length === 0) return null

  return (
    <Container>
      <Stack
        gap={6}
        className="py-12"
        data-merchandised-row={resolved.key}
        data-provenance={resolved.provenance}
      >
        {heading === null ? null : (
          <Heading level={2} size="display-sm">
            {heading}
          </Heading>
        )}
        <ReferenceCards
          cards={resolved.cards}
          assets={assets}
          marker={marker}
          ratio={ratio}
          sizes="(min-width: 1024px) 33vw, (min-width: 430px) 50vw, 100vw"
          strings={strings}
          cloudName={cloudName}
        />
      </Stack>
    </Container>
  )
}
