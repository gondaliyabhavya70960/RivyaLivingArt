import * as React from 'react'

import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { categoryGridBlock, type CategoryGridPayload } from '@/content/blocks/category-grid'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionCopy } from './SectionCopy'
import { BlockImage } from '@/components/patterns/MediaSlot'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Cards with their own pictures — the block that exercises the repeating-media contract.
 *
 * `media_index` INDEXES THE SLOT ARRAY, WHICH IS POSITION-STABLE. `media.slot('cards')` returns
 * one entry per payload reference IN ORDER, with `null` where an asset did not resolve; it never
 * compacts. A card holding index 2 therefore always means the third reference the editor made,
 * even when the first is hidden from this visitor by RLS. Compacting would silently draw a
 * different picture for some visitors and not others — the worst kind of bug to be told about.
 *
 * A CARD WITH NO TITLE IS SKIPPED ENTIRELY. An untitled card is an editor mid-edit, and rendering
 * an anonymous tile that links somewhere is worse than rendering three cards where four were
 * planned.
 */
/** Keyed by the payload's own `2 | 3 | 4` union, so the lookup is total and needs no fallback. */
const COLUMN_CLASS: Record<CategoryGridPayload['columns'], string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

const CARD_SIZES: Record<CategoryGridPayload['columns'], string> = {
  2: '(min-width: 640px) 50vw, 100vw',
  3: '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  4: '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
}

export function CategoryGridSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(categoryGridBlock, section.payload)
  const cards = payload.cards.filter((card) => card.title.trim() !== '')
  if (cards.length === 0) return null

  const assets = media.slot('cards')
  const columns = payload.columns

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={10}>
        <SectionCopy section={section} />
        <Grid gap={6} className={COLUMN_CLASS[columns]}>
          {cards.map((card, index) => {
            const asset = card.media_index === null ? null : (assets[card.media_index] ?? null)
            const body = (
              <Stack gap={3}>
                <BlockImage
                  asset={asset}
                  ratio="4:5"
                  preset="card"
                  sizes={CARD_SIZES[columns]}
                  strings={strings}
                  cloudName={cloudName}
                />
                <Heading level={3} size="display-xs">
                  {card.title}
                </Heading>
                {card.description.trim() === '' ? null : (
                  <Text size="base" tone="secondary">
                    {card.description}
                  </Text>
                )}
              </Stack>
            )

            /**
             * The whole card is the link when there is a destination, and nothing is a link when
             * there is not. A "read more" affordance under an unlinked card would be a control
             * that does nothing — and the label for it would have to be invented here, in JSX.
             */
            return card.href.trim() === '' ? (
              <div key={`${card.title}-${index}`}>{body}</div>
            ) : (
              <a
                key={`${card.title}-${index}`}
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
