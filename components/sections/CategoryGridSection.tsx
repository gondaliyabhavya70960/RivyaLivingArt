import * as React from 'react'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { categoryGridBlock, type CategoryGridPayload } from '@/content/blocks/category-grid'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'

import { CardLayout, cardLayoutOf } from './CardLayout'

import { hasSectionCopy, SectionCopy, cardHeadingLevel } from './SectionCopy'
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
 *
 * SO IS A CARD AWAITING OWNER VERIFICATION, and that is the second withholding mechanism rather
 * than a variation on the first. The section itself publishes — three of the homepage's five
 * families are confirmed — while "3D + Resin" and "Architectural Pieces" claim capabilities nobody
 * has signed off. Withholding the section would take the confirmed three with it; withholding
 * nothing would put an unverified claim on the front page. `visibleEntries` is the single place
 * that decides, and `data-entry-key` is what lets a test address the withheld card by name rather
 * than by a position that shifts when an editor reorders the grid.
 *
 * THE GRID MUST THEREFORE LOOK RIGHT AT THREE CARDS AS WELL AS FIVE. `COLUMN_CLASS` is the
 * editor's choice of maximum, not a promise about how many arrive.
 */
/** Keyed by the payload's own `2 | 3 | 4` union, so the lookup is total and needs no fallback. */
const COLUMN_CLASS: Record<CategoryGridPayload['columns'], string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

const CARD_SIZES: Record<CategoryGridPayload['columns'], string> = {
  2: '(min-width: 430px) 50vw, 100vw',
  3: '(min-width: 1024px) 33vw, (min-width: 430px) 50vw, 100vw',
  4: '(min-width: 1024px) 25vw, (min-width: 430px) 50vw, 100vw',
}

export function CategoryGridSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(categoryGridBlock, section.payload)
  const cards = visibleEntries(payload.cards).filter((card) => card.title.trim() !== '')
  /*
   * COPY WITHOUT CARDS STILL RENDERS, on the same rule `ProcessStepsSection` states: a heading
   * that claims nothing is still something the editor wrote, and deleting it to withhold the cards
   * beneath it withholds more than was flagged. Only a block with neither copy nor a visible card
   * renders nothing, because that is an unfilled block rather than a withheld one.
   */
  if (cards.length === 0 && !hasSectionCopy(section)) return null

  const assets = media.slot('cards')
  const columns = payload.columns
  /*
   * `carousel` IS THE SECOND DECLARED VARIANT AND `grid` THE FIRST, so an unknown value from the
   * database falls through to the grid — as `schemeOf` does for an unknown theme. The block
   * declared both from Phase 08 and branched on neither until Phase 45, which is why five seeded
   * bands and a Studio picker all pointed at one arrangement.
   */
  const layout = cardLayoutOf(section, 'grid')

  const rendered = cards.map((card, index) => {
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
        <Heading level={cardHeadingLevel(section)} size="display-xs">
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
    // The card's own name when it has one, its title otherwise — never the index, which
    // moves. A test addresses `[data-entry-key="..."]` and stays correct after a reorder.
    const entryKey = card.key ?? card.title

    return card.href.trim() === '' ? (
      <div key={`${card.title}-${index}`} data-entry-key={entryKey}>
        {body}
      </div>
    ) : (
      <a
        key={`${card.title}-${index}`}
        data-entry-key={entryKey}
        href={card.href}
        className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--rv-ink-accent)"
      >
        {body}
      </a>
    )
  })

  return (
    <SectionShell section={section}>
      <Stack gap={10}>
        <SectionCopy section={section} />
        {cards.length === 0 ? null : (
          <CardLayout
            layout={layout}
            gridClassName={COLUMN_CLASS[columns]}
            strings={strings}
            label={section.heading}
          >
            {rendered}
          </CardLayout>
        )}
      </Stack>
    </SectionShell>
  )
}
