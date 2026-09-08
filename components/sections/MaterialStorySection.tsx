import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'
import { materialStoryBlock } from '@/content/blocks/material-story'
import { parseBlockPayload } from '@/lib/cms/registry'

import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The progression from liquid to object: the headline sequence, and one picture per stage.
 *
 * THE FOUR WORDS ARE THE HEADING AND NOT THE STAGES. SEED §10-05 seeds `LIQUID. FORM. CRAFT.
 * OBJECT.` as four lines of `heading`, and `SectionCopy` now keeps those breaks; a stage carries a
 * `key` and a picture and no words at all. Labelling the stages here would put the same copy in
 * two places, and the day an editor reworded the heading the stages would still say the old thing.
 *
 * EVERY STAGE IS VISIBLE, ALWAYS. This is the static composition the phase requires under reduced
 * motion and with no JavaScript: four stages, four pictures, all rendered, reachable by `Tab`
 * through the ordinary document order. `components/patterns/MaterialSequence.tsx` (Phase 11's
 * second island) wraps this list to HIGHLIGHT whichever stage is in view — it observes scroll and
 * never captures it, so removing the island removes an effect and not a single word or picture.
 *
 * AN `<ol>` BECAUSE THE ORDER IS THE ARGUMENT. Liquid before form before craft before object is
 * the sentence the section is making; a stack of divs would leave a screen reader with four
 * unrelated images.
 */
export function MaterialStorySection({
  section,
  media,
  strings,
  cloudName,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(materialStoryBlock, section.payload)
  const assets = media.slot('stages')
  const stages = payload.stages

  return (
    <SectionShell section={section} spacing="lg">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
        <Stack gap={6} className="lg:sticky lg:top-24">
          <SectionCopy section={section} size="display-lg" />
          <SectionActions section={section} />
        </Stack>
        {stages.length === 0 ? null : (
          <Stack as="ol" gap={6}>
            {stages.map((stage) => (
              <li key={stage.key} data-entry-key={stage.key}>
                <BlockImage
                  asset={stage.media_index === null ? null : (assets[stage.media_index] ?? null)}
                  ratio="1:1"
                  preset="grid"
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  strings={strings}
                  cloudName={cloudName}
                />
              </li>
            ))}
          </Stack>
        )}
      </div>
    </SectionShell>
  )
}
