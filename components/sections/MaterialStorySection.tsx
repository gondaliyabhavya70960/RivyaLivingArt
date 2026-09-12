import dynamic from 'next/dynamic'
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
 * LOADED ON DEMAND, FOR THE REASON `ProcessStepsSection` LOADS `ChapterMedia` ON DEMAND.
 *
 * `components/sections/registry.ts` imports every renderer, so a static import here put this
 * island in the INITIAL JAVASCRIPT OF ALL SIXTEEN CMS ROUTES, whether or not they hold a material
 * story. Together with the hero's motion layer that was two of the homepage's seven budgeted
 * islands spent by the registry rather than chosen by a route.
 *
 * NOTHING IS LOST BY DEFERRING IT, and that is a property of the component rather than a hope:
 * RC-215 server-renders every stage as `children` and the island only adds and removes a
 * `data-active` attribute. Absence of the attribute IS the static branch — the unenhanced page is
 * fully legible, which is exactly what makes the module safe to fetch late or never.
 *
 * `ssr` IS LEFT ALONE: a Server Component may not pass `ssr: false`, and the server output of the
 * stages is the list itself, which must be there.
 */
const MaterialSequence = dynamic(() =>
  import('@/components/patterns/MaterialSequence').then((module) => module.MaterialSequence),
)

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
 * through the ordinary document order. `MaterialSequence` (RC-215) wraps this list and HIGHLIGHTS
 * whichever stage is in view — it observes scroll and never captures it, so removing the island
 * removes an effect and not a single word or picture.
 *
 * THE DIMMING IS `data-[active=false]`, WHICH MATCHES NOTHING UNTIL THE ISLAND RUNS. The server
 * writes no `data-active` attribute, so an unenhanced page renders every stage at full strength;
 * the island writes `false` on the stages outside the viewport's middle band and `true` on the one
 * crossing it. Styling the other way round — dim by default, undim when active — would hide three
 * quarters of the section from anyone whose JavaScript never arrives.
 *
 * AN `<ol>` BECAUSE THE ORDER IS THE ARGUMENT. Liquid before form before craft before object is
 * the sentence the section is making; a stack of divs would leave a screen reader with four
 * unrelated images.
 *
 * THE DIM LANDS ON THE PHOTOGRAPH, NOT ON THE STAGE — Phase 42, found by the axe sweep.
 *
 * It used to be `opacity-40` on the `<li>`, and an ancestor's opacity composites EVERYTHING
 * beneath it, including `MediaFrame`'s fallback label in the slots whose media the owner has
 * not bound yet. At 40% over DEEP's ground that label measured 2.77:1 against its own well —
 * and no ink fixes it, because pure white through the same 40% only reaches 4.14:1. The dim
 * itself was the failure.
 *
 * `MediaFrame` already draws this exact distinction one layer down: it gates the veil on
 * `hasMedia` because "there is no photograph to protect the ink from, and the gradient would
 * only drag `fallbackLabel` under AA". This is the same rule stated at the stage level. A
 * stage recedes by dimming its picture; a stage with no picture has nothing to recede, and
 * its label stays at the 10.42:1 the frame's docstring claims for it.
 *
 * Visually identical wherever media exists — the image is `absolute inset-0` and covers the
 * well completely, so dimming the image and dimming the box paint the same pixels.
 */
export function MaterialStorySection({
  section,
  media,
  strings,
  cloudName,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(materialStoryBlock, section.payload)
  const assets = media.slot('stages')
  const stages = payload.stages
  /*
   * TWO SHAPES, AND `stacked` IS NOT A SIMPLER SKIN — IT IS A CHEAPER PAGE. `sequence` is the
   * sticky two-column reading experience: the copy holds still while the stages scroll past it, and
   * `MaterialSequence` is the island that marks which stage is level with the reader. `stacked` is
   * the same content with neither — copy, then the stages in order at full width — and it therefore
   * loads NO JAVASCRIPT AT ALL for this band. A page that wants the pictures without the mechanism
   * now has a way to say so, which is what the block declared from Phase 08 and branched on never.
   *
   * `sequence` is the first declared variant, so an unknown value falls through to it.
   */
  const stacked = section.layout_variant === 'stacked'

  const pictures = stages.map((stage) => (
    <BlockImage
      key={stage.key}
      asset={stage.media_index === null ? null : (assets[stage.media_index] ?? null)}
      ratio="1:1"
      preset="grid"
      sizes={stacked ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 1024px) 45vw, 100vw'}
      strings={strings}
      cloudName={cloudName}
    />
  ))

  const copy = (
    <Stack gap={6} className={stacked ? '' : 'lg:sticky lg:top-24'}>
      <SectionCopy section={section} size="display-lg" />
      <SectionActions section={section} livePaths={livePaths} />
    </Stack>
  )

  if (stacked) {
    return (
      <SectionShell section={section}>
        <Stack gap={10}>
          {copy}
          {stages.length === 0 ? null : (
            <ul className="rv-reveal-group grid list-none gap-6 sm:grid-cols-2">
              {stages.map((stage, index) => (
                <li key={stage.key} data-entry-key={stage.key}>
                  {pictures[index]}
                </li>
              ))}
            </ul>
          )}
        </Stack>
      </SectionShell>
    )
  }

  return (
    <SectionShell section={section}>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
        {copy}
        {stages.length === 0 ? null : (
          <MaterialSequence>
            {stages.map((stage, index) => (
              <li
                key={stage.key}
                data-entry-key={stage.key}
                className="[&_img]:transition-opacity [&_img]:duration-500 data-[active=false]:[&_img]:opacity-40 motion-reduce:[&_img]:transition-none"
              >
                {pictures[index]}
              </li>
            ))}
          </MaterialSequence>
        )}
      </div>
    </SectionShell>
  )
}
