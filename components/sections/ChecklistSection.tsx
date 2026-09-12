import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { checklistBlock } from '@/content/blocks/checklist'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * A list of points, each with a mark.
 *
 * THE MARK IS DECORATIVE AND SAYS SO. `aria-hidden` on the glyph, because the `<ul>` already tells
 * a screen reader that this is a list and the tick adds nothing a second time — announced, it
 * becomes "graphic, tick" before every line. It is `currentColor` at stroke 1.5 like every other
 * icon in §7.2, so it inherits the scheme rather than carrying a colour of its own.
 *
 * EVERY POINT CAN BE WITHHELD SEPARATELY, and on this block that matters more than most: a list of
 * what a studio includes is a list of capability claims, one per line. The section-level flag would
 * withhold all of them to withhold one. `visibleEntries` filters before anything is drawn, so a
 * withheld point leaves no gap, no marker and no clue that it was ever there.
 *
 * A SECTION WITH COPY AND NO POINTS STILL RENDERS — the heading is true whether or not anybody has
 * confirmed the list beneath it. Neither copy nor points renders nothing at all.
 *
 * THE TWO-COLUMN VARIANT IS CSS COLUMNS, NOT A GRID, so a long list flows down the first column and
 * continues in the second — reading order down then across, which is how a list reads. A grid would
 * put item two beside item one, and a reader scanning the left column would skip every other point.
 */
function Tick(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-1 size-5 shrink-0 text-ink-accent"
    >
      <path d="M4 10.5 8 14.5 16 6" />
    </svg>
  )
}

export function ChecklistSection({
  section,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(checklistBlock, section.payload)
  const items = visibleEntries(payload.items).filter((item) => item.text.trim() !== '')

  if (items.length === 0 && !hasSectionCopy(section)) return null

  const twoColumn = (section.layout_variant ?? 'single-column') === 'two-column'

  return (
    <SectionShell section={section}>
      <Stack gap={8}>
        <SectionCopy section={section} />
        {items.length === 0 ? null : (
          <ul className={twoColumn ? 'list-none gap-0 md:columns-2 md:gap-12' : 'list-none'}>
            {items.map((item, index) => (
              <li
                key={item.key ?? `${item.text}-${index}`}
                data-entry-key={item.key ?? item.text}
                className="mb-4 flex gap-3 break-inside-avoid"
              >
                <Tick />
                <span>
                  <Text as="span" size="base" className="block">
                    {item.text}
                  </Text>
                  {item.detail.trim() === '' ? null : (
                    <Text as="span" size="sm" tone="tertiary" className="block">
                      {item.detail}
                    </Text>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <SectionActions section={section} livePaths={livePaths} />
      </Stack>
    </SectionShell>
  )
}
