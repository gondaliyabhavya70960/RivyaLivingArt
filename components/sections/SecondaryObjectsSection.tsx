import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { secondaryObjectsBlock } from '@/content/blocks/secondary-objects'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionCopy, cardHeadingLevel } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The smaller work — preservation, décor, gifts.
 *
 * IT SHOWS A NAME, A PICTURE AND A DESTINATION, AND NOTHING ELSE. There is no price here because
 * there is no price field: SEED §10-11 and §32 forbid presenting these as buyable inventory, and
 * `content/blocks/secondary-objects.ts` has no `price` or `dimensions` key for a future editor to
 * fill in "just for this one card". A unit test asserts that absence, so adding one is a visible
 * decision rather than a quiet one.
 *
 * ONE OF THE FOUR IS WITHHELD. "Personalised Pieces" is a personalisation capability claim and
 * carries `OWNER_VERIFICATION_REQUIRED`, so the published band shows three cards. Like the
 * material palette, the layout follows what survived the filter rather than reserving a hole where
 * the fourth would have gone.
 */
/** Indexed by how many cards there are; literals, because Tailwind's scanner reads source text. */
const COLUMN_CLASS = [
  '',
  'lg:grid-cols-1',
  'lg:grid-cols-2',
  'lg:grid-cols-3',
  'lg:grid-cols-4',
] as const

export function SecondaryObjectsSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(secondaryObjectsBlock, section.payload)
  const cards = visibleEntries(payload.cards).filter((card) => card.title.trim() !== '')
  if (cards.length === 0) return null

  const assets = media.slot('cards')
  const columns = COLUMN_CLASS[Math.min(cards.length, 4)] ?? ''

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={10}>
        <SectionCopy section={section} />
        <Grid gap={6} className={`grid-cols-1 sm:grid-cols-2 ${columns}`}>
          {cards.map((card) => {
            const index = card.media_index ?? null
            const description = card.description ?? ''
            const body = (
              <Stack gap={3}>
                <BlockImage
                  asset={index === null ? null : (assets[index] ?? null)}
                  ratio="3:4"
                  mobileRatio="4:5"
                  preset="card"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  strings={strings}
                  cloudName={cloudName}
                />
                <Heading level={cardHeadingLevel(section)} size="display-xs">
                  {card.title}
                </Heading>
                {description.trim() === '' ? null : (
                  <Text size="base" tone="secondary">
                    {description}
                  </Text>
                )}
              </Stack>
            )

            // The whole card is the link when there is a destination, and nothing is a link when
            // there is not — the same rule as the category grid, and for the same reason: a
            // "read more" affordance under an unlinked card is a control that does nothing.
            return card.href.trim() === '' ? (
              <div key={card.key} data-entry-key={card.key}>
                {body}
              </div>
            ) : (
              <a
                key={card.key}
                data-entry-key={card.key}
                href={card.href}
                className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--rv-ink-accent)"
              >
                {body}
              </a>
            )
          })}
        </Grid>
      </Stack>
    </SectionShell>
  )
}
