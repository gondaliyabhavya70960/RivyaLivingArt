import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import type { AspectRatio } from '@/components/primitives/AspectBox'
import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import type { EntityCard } from '@/lib/cms/selectors'
import type { SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The cards a reference block draws when its selector found something.
 *
 * IT DRAWS NOTHING TODAY, and that is the state it was written for. `products` has no published
 * rows, `portfolio_projects` and `journal_articles` do not exist until Phases 17 and 18, so every
 * selector returns empty and each of the three blocks renders `EditorialFallback` instead. This
 * component exists so that the day one of them returns a row, the row appears — rather than a
 * phase discovering that the block it shipped could only ever render an empty state.
 *
 * IT IS DELIBERATELY MINIMAL, AND IT IS NOT `ProductCard`. The registry reserves RC-217
 * `ProductCard` for Phase 14, RC-219 `PortfolioCard` for Phase 17 and RC-220 `JournalCard` for
 * Phase 18 — each owned by the phase that has the entity's real data and knows what a card of it
 * should say. Building one of those here would be building three phases ahead on a table with no
 * rows in it, and the result would be replaced unread. So this lives in `components/sections/`
 * rather than `components/patterns/`: it is a shared piece of three renderers, not a registered
 * pattern, and the three phases above replace it entity by entity.
 *
 * A TITLE, A SUMMARY AND A PICTURE. No price, no dimensions, no availability, no lead time —
 * `EntityCard` does not carry them and this component could not render one if it did. That is D10
 * enforced by the shape of the data rather than by the discipline of whoever writes the next
 * reference block.
 *
 * `marker` IS A CLOSED UNION because the phase's own verification asserts over these three
 * attribute names — "zero elements matching `[data-product-card]`" and its two siblings. A
 * free-string prop would let a fourth block invent `data-work-card`, and the assertion that
 * proves nothing is fabricated would quietly stop covering it.
 */
export type ReferenceMarker =
  | 'data-product-card'
  | 'data-project-card'
  | 'data-article-card'
  /** Phase 22: a featured collection or category. Same shape, same restraint, its own assertion. */
  | 'data-collection-card'

export type ReferenceCardsProps = {
  readonly cards: readonly EntityCard[]
  /** Hero assets by `media_assets.id`, from the section's resolved reference. */
  readonly assets: ReadonlyMap<string, MediaAsset>
  readonly marker: ReferenceMarker
  readonly ratio: AspectRatio
  readonly mobileRatio?: AspectRatio
  readonly sizes: string
  readonly strings: SiteStrings
  readonly cloudName: string
  /**
   * The level the card titles take. Defaults to 3.
   *
   * `ReferenceCards` takes no section — it is a shared grid several sections render — so it cannot
   * call `cardHeadingLevel` itself. The caller passes what its own section resolves to.
   */
  readonly headingLevel?: 2 | 3
}

export function ReferenceCards({
  cards,
  assets,
  marker,
  ratio,
  mobileRatio,
  sizes,
  strings,
  cloudName,
  headingLevel = 3,
}: ReferenceCardsProps): React.ReactElement | null {
  if (cards.length === 0) return null

  return (
    <Grid gap={6} className="rv-reveal-group grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const asset = card.mediaId === null ? null : (assets.get(card.mediaId) ?? null)
        // The marker is a data attribute rather than a class: a class is styling and gets
        // renamed, and the assertion that no fabricated card renders must not depend on CSS.
        const markerAttribute: Record<string, string> = { [marker]: '' }

        return (
          <a
            key={card.id}
            href={card.href}
            data-entry-key={card.key}
            {...markerAttribute}
            className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--rv-ink-accent)"
          >
            <Stack gap={3}>
              <BlockImage
                asset={asset}
                ratio={ratio}
                mobileRatio={mobileRatio}
                preset="card"
                sizes={sizes}
                strings={strings}
                cloudName={cloudName}
              />
              <Heading level={headingLevel} size="display-xs">
                {card.title}
              </Heading>
              {card.summary === null ? null : (
                <Text size="base" tone="secondary">
                  {card.summary}
                </Text>
              )}
            </Stack>
          </a>
        )
      })}
    </Grid>
  )
}
