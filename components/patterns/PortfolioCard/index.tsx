import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import type { EntityCard } from '@/lib/cms/selectors'
import type { SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * RC-219. One delivered project, as a card.
 *
 * 3:2 AT EVERY WIDTH, INCLUDING MOBILE, AND THAT IS THE WHOLE DIFFERENCE FROM A PRODUCT CARD. A
 * product is photographed as an object and reads well in a portrait crop; a project is a room, a
 * wall or an installation, and cropping it to 4:5 on a phone cuts away the space that makes it a
 * project rather than a piece of furniture. The registry row states the reason in one line —
 * "landscape reads as a documented project rather than a catalogue item" — and this component is
 * the only place in the codebase where that ratio is not negotiable per breakpoint.
 *
 * THE PROJECT TYPE IS AN EYEBROW OF TEXT, NEVER A COLOURED CHIP. A chip encodes the type in a
 * colour, which is invisible to a colourblind visitor and to a screen reader alike, and it invites a
 * fixed taxonomy nobody has agreed. `project_type` is a free text column the owner fills in; it
 * reads as the words they typed, above the title, or it is absent.
 *
 * IT RENDERS NO DATE, NO CLIENT AND NO LOCATION. Every one of those is a business fact and two of
 * them belong to somebody else: a client's name may appear only where their consent is recorded as
 * granted, and the card has no way to know that. `EntityCard` does not carry them, which is D10
 * enforced by the shape of the data rather than by the discipline of whoever writes the next band.
 *
 * ZERO KILOBYTES. A Server Component with no state and no handler — the card is a link.
 */

export type PortfolioCardProps = {
  readonly card: EntityCard
  readonly asset: MediaAsset | null
  readonly sizes: string
  readonly strings: SiteStrings
  readonly cloudName: string
}

export function PortfolioCard({
  card,
  asset,
  sizes,
  strings,
  cloudName,
}: PortfolioCardProps): React.ReactElement {
  return (
    <a
      href={card.href}
      data-entry-key={card.key}
      data-project-card=""
      className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--rv-ink-accent)"
    >
      <Stack gap={3}>
        <BlockImage
          asset={asset}
          // No `mobileRatio`: see the header. The single ratio is the point of this component.
          ratio="3:2"
          preset="card"
          sizes={sizes}
          strings={strings}
          cloudName={cloudName}
        />
        {card.eyebrow === null || card.eyebrow === undefined ? null : (
          <Eyebrow>{card.eyebrow}</Eyebrow>
        )}
        <Heading level={3} size="display-xs">
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
}

/**
 * The grid `portfolio-strip` draws.
 *
 * IT LIVES BESIDE THE CARD RATHER THAN IN THE SECTION because the column rhythm is part of what a
 * project card is: three across at desktop, two at tablet, one on a phone, with the landscape crop
 * holding at every one of them. A section that laid these out itself would be free to put four
 * across, and four landscape cards in a row are thumbnails.
 */
export function PortfolioCardGrid({
  cards,
  assets,
  sizes,
  strings,
  cloudName,
}: {
  readonly cards: readonly EntityCard[]
  readonly assets: ReadonlyMap<string, MediaAsset>
  readonly sizes: string
  readonly strings: SiteStrings
  readonly cloudName: string
}): React.ReactElement | null {
  if (cards.length === 0) return null

  return (
    <Grid gap={6} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <PortfolioCard
          key={card.id}
          card={card}
          asset={card.mediaId === null ? null : (assets.get(card.mediaId) ?? null)}
          sizes={sizes}
          strings={strings}
          cloudName={cloudName}
        />
      ))}
    </Grid>
  )
}
