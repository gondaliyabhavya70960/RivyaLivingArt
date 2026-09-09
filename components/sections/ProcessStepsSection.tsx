import * as React from 'react'

import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { processStepsBlock } from '@/content/blocks/process-steps'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'

import dynamic from 'next/dynamic'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { altTextOf, mediaRefOf } from '@/lib/cms/media'
import { MEDIA_PLAY_LABEL_KEY, siteStringOrEmpty } from '@/lib/cms/strings'

import { SectionActions } from './SectionActions'
import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { BlockImage } from '@/components/patterns/MediaSlot'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * LOADED ON DEMAND, AND THAT IS A BUNDLE DECISION RATHER THAN A STYLE ONE.
 *
 * `ChapterMedia` is a Client Component, and this renderer is imported by every page with a process
 * band — the homepage among them. A static import would put the chapter island in the initial
 * JavaScript of a route that never renders a chapter: `scripts/site/check-island-budget.mjs`
 * measured exactly that and failed, which is what the gate is for. A dynamic import leaves a stub
 * in the graph and fetches the module only when a chapter actually has a clip to play — which is
 * no chapter today, and at most one at a time afterwards.
 *
 * `ssr` IS LEFT ALONE. A Server Component may not pass `ssr: false`, and it does not need to:
 * `ChapterMedia` renders null until after the first paint, so its server output is empty anyway.
 */
const ChapterMedia = dynamic(() =>
  import('@/components/patterns/ChapterMedia').then((module) => module.ChapterMedia),
)

/**
 * TWO SHAPES, ONE BLOCK. `alternating` and `stacked` lay out a LIST of stages inside one section —
 * the homepage's process band is one section holding five. `chapter` is one section that IS one
 * stage: `/process` is seven of them, each with its own position, its own media and its own
 * verification flag, so the owner can confirm one stage without confirming the rest.
 *
 * A CHAPTER'S NUMBER IS ITS POSITION AMONG THE CHAPTERS THAT RENDERED, never a number in the copy.
 * All seven are `OWNER_VERIFICATION_REQUIRED`; with three verified, a seeded "04" would appear
 * beside the second visible chapter. `ordinal` comes from `SectionList`, which is the only thing
 * that can see the page, and the bands invert on it too — so three chapters alternate correctly
 * rather than inheriting the parity of the seven that were authored.
 *
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
  ordinal,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(processStepsBlock, section.payload)

  if ((section.layout_variant ?? 'alternating') === 'chapter') {
    return (
      <ProcessChapter
        section={section}
        media={media}
        strings={strings}
        cloudName={cloudName}
        ordinal={ordinal}
      />
    )
  }

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

/**
 * One chapter of `/process`: a number, the section's own copy, and one picture beside them.
 *
 * THE PICTURE IS THE SECTION'S, NOT A STEP'S. A chapter has no `steps` in its payload — its words
 * are the section's heading and body, and duplicating them into a step is what made the page
 * render every sentence twice before Phase 12.
 *
 * THE MOTION LAYER IS OPTIONAL AND SHARED. `ChapterMedia` mounts a clip only while this chapter is
 * crossing the viewport, and only one chapter on the page may hold that slot at a time. With no
 * clip bound — which is every chapter today — it renders nothing and the still is the chapter.
 */
function ProcessChapter({
  section,
  media,
  strings,
  cloudName,
  ordinal,
}: Pick<
  SectionRenderProps,
  'section' | 'media' | 'strings' | 'cloudName' | 'ordinal'
>): React.ReactElement | null {
  if (!hasSectionCopy(section)) return null

  const reversed = ordinal % 2 === 0
  const still = media.desktop ?? media.mobile
  const motion = still !== null && still.resource_type === 'video' ? still : null

  return (
    <SectionShell section={section} spacing="lg">
      <div
        className={`grid gap-8 md:grid-cols-2 md:items-center md:gap-12 ${
          reversed ? '[&>*:first-child]:md:order-2' : ''
        }`}
      >
        <Stack gap={4}>
          {/* The number is generated, so it is the one string in this file that is not CMS copy —
              and it is a numeral rather than a word, which no editor would want to translate. */}
          <Eyebrow tone="accent">{String(ordinal).padStart(2, '0')}</Eyebrow>
          <SectionCopy section={section} size="display-md" />
          <SectionActions section={section} />
        </Stack>
        <div className="relative">
          <ResponsiveMedia
            desktop={media.desktop}
            mobile={media.mobile}
            desktopRatio="4:3"
            mobileRatio="4:5"
            preset="grid"
            sizes="(min-width: 768px) 50vw, 100vw"
            altOverride={section.media_alt_override}
            strings={strings}
            cloudName={cloudName}
          />
          {motion === null ? null : (
            <ChapterMedia
              chapterId={section.id}
              cloudName={cloudName}
              media={mediaRefOf(motion)}
              posterPublicId={motion.poster_public_id}
              durationSeconds={motion.duration_s}
              alt={altTextOf(motion, section.media_alt_override)}
              playLabel={siteStringOrEmpty(strings, MEDIA_PLAY_LABEL_KEY)}
            />
          )}
        </div>
      </div>
    </SectionShell>
  )
}
