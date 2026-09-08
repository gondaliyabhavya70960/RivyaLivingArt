import * as React from 'react'

import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { processStepsBlock } from '@/content/blocks/process-steps'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionCopy } from './SectionCopy'
import { BlockImage } from './SectionMedia'
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
  const steps = payload.steps.filter((step) => step.title.trim() !== '')
  if (steps.length === 0) return null

  const assets = media.slot('steps')
  const alternating = (section.layout_variant ?? 'alternating') === 'alternating'

  return (
    <SectionShell section={section} spacing="lg">
      <Stack gap={12}>
        <SectionCopy section={section} />
        <Stack as={payload.numbered ? 'ol' : 'div'} gap={12}>
          {steps.map((step, index) => {
            const asset = step.media_index === null ? null : (assets[step.media_index] ?? null)
            const reversed = alternating && index % 2 === 1

            return (
              <Stack
                as={payload.numbered ? 'li' : 'div'}
                key={`${step.title}-${index}`}
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
      </Stack>
    </SectionShell>
  )
}
