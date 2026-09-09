import * as React from 'react'

import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { processStepsBlock } from '@/content/blocks/process-steps'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { BlockImage } from '@/components/patterns/MediaSlot'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Ordered stages.
 *
 * THE ARRAY ORDER IS THE CONTENT. Nothing here sorts: the numbers rendered beside each step are
 * derived from the payload's own order, so "01" is whatever the editor put first. A sort by title
 * or by media would silently renumber the process.
 *
 * `<ol>` RATHER THAN A SEQUENCE OF `<div>`s WHEN NUMBERED. The order is meaning, not decoration,
 * and a screen reader announcing "list, 4 items" carries that meaning where a visual number
 * cannot. When `numbered` is off the order is presentational and a plain stack is honest.
 */
export function ProcessStepsSection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(processStepsBlock, section.payload)
  /*
   * WITHHELD STEPS ARE REMOVED BEFORE NUMBERING, and the order of those two operations is the
   * whole decision. Five of the homepage's process statements claim capabilities nobody has
   * confirmed; numbering first and hiding second would leave the visible steps reading 01, 03, 06 —
   * which tells a visitor that something is missing and invites them to wonder what. Hiding first
   * renumbers what remains into a complete sequence, which is true: these are the steps Rivya has
   * confirmed it performs.
   */
  const steps = visibleEntries(payload.steps).filter((step) => step.title.trim() !== '')
  /*
   * A SECTION WITH COPY AND NO STEPS STILL RENDERS, and at launch that is exactly the homepage's
   * process band: SEED §10-10 flags all five statements, so nothing survives the filter while the
   * eyebrow, the heading and the link to `/process` claim nothing and are true. Returning null
   * here would delete a real invitation in order to withhold five unconfirmed sentences.
   *
   * NOTHING AT ALL RENDERS WHEN THERE IS NOTHING TO SAY. No copy and no steps is a block an editor
   * added and has not filled in, and a scheme band with an empty list inside it reads as a
   * rendering fault rather than as absent content.
   */
  if (steps.length === 0 && !hasSectionCopy(section)) return null

  const assets = media.slot('steps')
  const alternating = (section.layout_variant ?? 'alternating') === 'alternating'

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={12}>
        <SectionCopy section={section} />
        {steps.length === 0 ? null : (
          <Stack as={payload.numbered ? 'ol' : 'div'} gap={12}>
            {steps.map((step, index) => {
              const asset = step.media_index === null ? null : (assets[step.media_index] ?? null)
              const reversed = alternating && index % 2 === 1

              return (
                <Stack
                  as={payload.numbered ? 'li' : 'div'}
                  key={`${step.title}-${index}`}
                  data-entry-key={step.key ?? step.title}
                  gap={6}
                  className={`md:grid md:grid-cols-2 md:items-center md:gap-10 ${
                    reversed ? '[&>*:first-child]:md:order-2' : ''
                  }`}
                >
                  <BlockImage
                    asset={asset}
                    ratio="4:3"
                    mobileRatio="4:5"
                    preset="grid"
                    sizes="(min-width: 768px) 50vw, 100vw"
                    strings={strings}
                    cloudName={cloudName}
                  />
                  <Stack gap={3}>
                    {payload.numbered ? (
                      <Eyebrow tone="accent">{String(index + 1).padStart(2, '0')}</Eyebrow>
                    ) : null}
                    <Heading level={3} size="display-sm">
                      {step.title}
                    </Heading>
                    {step.body.trim() === '' ? null : (
                      <Text size="base" tone="secondary">
                        {step.body}
                      </Text>
                    )}
                  </Stack>
                </Stack>
              )
            })}
          </Stack>
        )}
        <SectionActions section={section} />
      </Stack>
    </SectionShell>
  )
}
