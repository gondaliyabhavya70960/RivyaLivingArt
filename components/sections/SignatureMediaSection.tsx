import dynamic from 'next/dynamic'
import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'
import { parseBlockPayload } from '@/lib/cms/registry'

import { signatureMediaBlock } from '@/content/blocks/signature-media'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * One piece of media across the full width, with its caption. FEAT §8 elements 3 and 6.
 *
 * THE STILL IS ALWAYS RENDERED AND THE FILM SITS OVER IT. Element 3 is a still and element 6 is a
 * film, and they are the same band because that is the only arrangement in which the film is
 * optional at every level: not bound, not permitted to play, or declined by the visitor's own
 * settings all end at the same picture rather than at an empty box.
 *
 * IT USES `BlockVideo`, NOT `HeroMotion`, AND THE DIFFERENCE IS THE PLAY CONTROL. `HeroMotion` is
 * an ambient layer that renders nothing at all when it may not autoplay — right for a clip behind
 * hero copy, where a play button would sit on top of the section's calls to action offering a
 * third. This band IS the film; a visitor who has reduced motion on, or who is on Data Saver, must
 * still be able to choose to watch it, and `BlockVideo`'s poster-with-a-control is exactly that.
 */

/**
 * LOADED ON DEMAND, FOR THE REASON `ProcessStepsSection` STATES ABOUT `ChapterMedia`.
 *
 * `BlockVideo` is a Server Component that imports `MediaVideo`, which is a Client Component — so a
 * static import here would make `MediaVideo` an island of every route that can render any section,
 * the homepage included, whether or not a film is ever on it. `scripts/site/check-island-budget.mjs`
 * counts precisely that, names the five it allows, and would fail on the sixth. A dynamic import
 * leaves a stub in the graph and fetches the module only where a band actually has a film bound.
 */
const BlockVideo = dynamic(() =>
  import('@/components/patterns/BlockVideo').then((module) => module.BlockVideo),
)

export function SignatureMediaSection({
  section,
  media,
  strings,
  cloudName,
  isFirst,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(signatureMediaBlock, section.payload)
  const [film] = media.slot('video')
  const still = media.desktop ?? media.mobile

  /*
   * NOTHING AT ALL WITHOUT A STILL, INCLUDING WHEN A FILM IS BOUND. The still is the poster, the
   * reduced-motion experience and the thing that paints first; a band that rendered a lone
   * `<video>` would make the largest element on the page a media element that may never be allowed
   * to play, which is the exact defect Phase 11 removed from the hero. A band with a caption and
   * no picture is not a signature — it is a stray sentence — so this returns null rather than
   * rendering the copy alone.
   */
  if (still === null) return null

  const inset = section.layout_variant === 'inset'
  const caption = payload.caption?.trim() ?? ''

  return (
    <SectionShell section={section} spacing="lg" container={inset ? 'default' : 'none'}>
      <Stack gap={6}>
        <SectionCopy section={section} level={isFirst ? 1 : 2} />
        <figure className="m-0">
          <div className="relative">
            <ResponsiveMedia
              desktop={media.desktop}
              mobile={media.mobile}
              desktopRatio="16:9"
              mobileRatio="4:5"
              preset="hero"
              sizes="100vw"
              altOverride={section.media_alt_override}
              strings={strings}
              cloudName={cloudName}
              eager={isFirst}
            />
            {payload.is_video && film != null ? (
              <div className="absolute inset-0">
                <BlockVideo
                  asset={film}
                  poster={still}
                  altOverride={section.media_alt_override}
                  strings={strings}
                  cloudName={cloudName}
                  loop={payload.autoplay}
                  className="h-full w-full"
                />
              </div>
            ) : null}
          </div>
          {/*
            The caption is DATA, from `payload.caption` — never a literal, which
            `scripts/cms/check-section-copy.ts` would fail the build on. It renders only when an
            editor wrote one: an empty `<figcaption>` is an announced element with nothing in it.
          */}
          {caption === '' ? null : (
            <figcaption
              data-signature-caption=""
              className="text-ink-secondary mt-3 text-sm text-balance"
            >
              {caption}
            </figcaption>
          )}
        </figure>
      </Stack>
    </SectionShell>
  )
}
