import * as React from 'react'

import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { numberedStepsBlock } from '@/content/blocks/numbered-steps'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionActions } from './SectionActions'
import { cardHeadingLevel, hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Ordered steps with no media — the lighter sibling of `ProcessStepsSection`.
 *
 * `<ol>` ALWAYS, NEVER A STACK OF DIVS. This block has no `numbered` switch to turn off, because a
 * block called "numbered steps" whose order did not matter would be `checklist`. A screen reader
 * announcing "list, 4 items" carries the meaning a visual numeral cannot, and the numeral itself is
 * `Eyebrow`-scale rather than a display glyph: it is a marker, not the content.
 *
 * WITHHELD STEPS ARE REMOVED BEFORE NUMBERING, and the order of those two operations is the whole
 * decision — the same one `ProcessStepsSection` states at length. Numbering first and hiding second
 * leaves the visible steps reading 01, 03, 06, which tells a visitor something is missing and
 * invites them to wonder what. Hiding first renumbers what remains into a complete sequence, which
 * is true: these are the steps somebody has confirmed.
 *
 * A SECTION WITH COPY AND NO STEPS STILL RENDERS. A heading and a link to the long version claim
 * nothing and are true; returning null would delete a real invitation in order to withhold
 * unconfirmed sentences. Nothing at all renders when there is neither, because an empty scheme band
 * reads as a rendering fault rather than as absent content.
 */
export function NumberedStepsSection({
  section,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(numberedStepsBlock, section.payload)
  const steps = visibleEntries(payload.steps).filter((step) => step.title.trim() !== '')

  if (steps.length === 0 && !hasSectionCopy(section)) return null

  const grid = (section.layout_variant ?? 'stacked') === 'grid'

  return (
    <SectionShell section={section}>
      <Stack gap={10}>
        <SectionCopy section={section} />
        {steps.length === 0 ? null : (
          <ol
            className={
              grid ? 'grid list-none gap-8 sm:grid-cols-2 lg:grid-cols-3' : 'grid list-none gap-8'
            }
          >
            {steps.map((step, index) => (
              <Stack
                as="li"
                key={step.key ?? `${step.title}-${index}`}
                data-entry-key={step.key ?? step.title}
                gap={3}
              >
                <Eyebrow tone="accent">{String(index + 1).padStart(2, '0')}</Eyebrow>
                <Heading level={cardHeadingLevel(section)} size="display-xs">
                  {step.title}
                </Heading>
                {step.body.trim() === '' ? null : (
                  <Text size="base" tone="secondary" className="whitespace-pre-line">
                    {step.body}
                  </Text>
                )}
              </Stack>
            ))}
          </ol>
        )}
        <SectionActions section={section} livePaths={livePaths} />
      </Stack>
    </SectionShell>
  )
}
