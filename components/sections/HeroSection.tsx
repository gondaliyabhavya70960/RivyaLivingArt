import dynamic from 'next/dynamic'
import * as React from 'react'

import { ResponsiveMedia } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'
import { heroBlock } from '@/content/blocks/hero'
import { altTextOf, mediaRefOf } from '@/lib/cms/media'
import { parseBlockPayload } from '@/lib/cms/registry'
import { MEDIA_PLAY_LABEL_KEY, siteStringOrEmpty } from '@/lib/cms/strings'

import { SectionActions } from './SectionActions'
import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * LOADED ON DEMAND, FOR THE REASON `ProcessStepsSection` LOADS `ChapterMedia` ON DEMAND.
 *
 * `components/sections/registry.ts` imports every renderer, so a static import here put the hero's
 * motion island in the INITIAL JAVASCRIPT OF ALL SIXTEEN CMS ROUTES — `/privacy` and `/terms`
 * included, neither of which has ever rendered a hero, let alone a moving one. Two of the seven
 * islands the homepage was budgeted for were this one and `MaterialSequence`, and no route chose
 * either.
 *
 * A dynamic import leaves a stub in the graph and fetches the module only when a hero is actually
 * marked as a moving piece AND allowed to start by itself. `HeroMotion` then applies its own five
 * technical gates on top and renders nothing if any refuses — so on most loads the module is never
 * fetched at all.
 *
 * `ssr` IS LEFT ALONE. A Server Component may not pass `ssr: false`, and it does not need to:
 * `HeroMotion` renders null until after the first paint, so its server output is empty anyway.
 */
const HeroMotion = dynamic(() =>
  import('@/components/patterns/HeroMotion').then((module) => module.HeroMotion),
)

/**
 * The page opener.
 *
 * THE STILL IS THE HERO AND THE VIDEO IS A LAYER OVER IT. Phase 11 states the rule as a budget —
 * the Largest Contentful Paint element must be the image, never the clip — and the shape of this
 * file is the rule made structural: there is exactly one media path, `ResponsiveMedia`, and the
 * motion layer is an overlay that may never mount. Until Phase 11 a hero marked `is_video`
 * rendered a `<video>` INSTEAD of the still, which made the largest element on the page a media
 * element that most visitors are never allowed to play.
 *
 * IT IS THE ONLY SECTION ALLOWED TO LOAD MEDIA EAGERLY, and only when it is the first on the
 * page. `isFirst` comes from the list, not from a guess about the block type: a hero placed
 * halfway down a page is below the fold, and marking it eager would put it in competition with
 * whatever is actually above the fold for the same connection.
 *
 * THE COPY OVERLAYS THE MEDIA on `full-bleed`, and sits beneath it on `contained`. That is the
 * only difference between the two variants, and it is why the veil is tied to the variant rather
 * than to an editor toggle: overlay ink over a photograph needs the §2.5 gradient to hold its
 * contrast ratio, and ink on the page ground does not.
 *
 * BOTH EDITORIAL SWITCHES MUST BE ON FOR THE CLIP TO MOUNT. `is_video` says this hero is a moving
 * piece; `autoplay` says it may start by itself. With `autoplay` off the still stands alone rather
 * than growing a play control — an overlay button in the hero would sit on top of the section's
 * own calls to action, offering a third and louder one. `HeroMotion` then applies the five
 * technical gates on top, and renders nothing if any of them refuses.
 */
export function HeroSection({
  section,
  media,
  strings,
  cloudName,
  isFirst,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(heroBlock, section.payload)
  const variant = section.layout_variant ?? 'full-bleed'
  const overlaid = variant === 'full-bleed'
  /*
   * THE THIRD VARIANT, DECLARED IN PHASE 08 AND BRANCHED ON NEVER. `hero` names `full-bleed`,
   * `contained` and `split`, and until Phase 45 `contained` and `split` produced byte-identical
   * output — an editor could pick either and watch nothing happen.
   *
   * `split` IS A DIFFERENT SHAPE, NOT A DIFFERENT SKIN: the copy sits BESIDE the picture from the
   * `lg` breakpoint rather than beneath it, which is what makes a page open with an asymmetry
   * instead of a banner. Below `lg` it is `contained` — a two-column hero on a 390px phone is two
   * things too narrow to read, and the copy must come first either way.
   *
   * THE RATIO CHANGES WITH THE COLUMN. A 21:9 still at half the width is a letterbox about eighty
   * pixels tall; 4:5 is what a picture standing beside a paragraph wants, and it is the ratio
   * `ManifestoSection` uses for exactly the same arrangement.
   *
   * THE §5.1 FLOOR SURVIVES IT. FEAT §49 question 2 asks the opening hero's media to hold at least
   * 70% of the viewport height, and a portrait column can do that at half the width — so
   * `minBlockSize` is passed here too rather than being quietly dropped with the ratio.
   */
  const split = variant === 'split'

  const still = media.desktop ?? media.mobile
  const [poster] = media.slot('poster')
  const [motion] = media.slot('motion-desktop')

  const copy = (
    <Stack gap={6} className={overlaid ? 'items-start' : ''}>
      <SectionCopy section={section} level={isFirst ? 1 : 2} size="display-xl" />
      <SectionActions section={section} livePaths={livePaths} />
    </Stack>
  )

  return (
    <SectionShell
      section={section}
      /*
       * THE VARIANT DECIDES, WHICH IS WHY THIS OVERRIDES `SECTION_RHYTHM`. A full-bleed hero is
       * meant to meet the header — a band of padding above the opening image is the site clearing
       * its throat, and it costs the hero exactly the height the §5.1 floor just gave it. A
       * contained hero is a picture on the page and takes the ordinary working rhythm.
       */
      spacing={overlaid ? 'sm' : 'lg'}
      container={overlaid ? 'none' : 'default'}
    >
      {/*
        THE GRID IS INSIDE THE CONTAINER, NOT ON THE SECTION. `SectionShell` puts `className` on
        the `<Section>` and wraps the children in a `<Container>`, so grid classes up there would
        make the container the only grid item and the two columns would never be siblings. A
        fragment when there is no split, so `contained` and `full-bleed` keep the markup they had.
      */}
      <SplitFrame split={split}>
        <div className="relative">
          <ResponsiveMedia
            desktop={media.desktop}
            mobile={media.mobile}
            desktopRatio={split ? '4:5' : '21:9'}
            mobileRatio={split ? '4:5' : '9:16'}
            preset="hero"
            altOverride={section.media_alt_override}
            strings={strings}
            cloudName={cloudName}
            eager={isFirst}
            // Phase 40: the first section of a page owns the route's one LCP hint.
            priority={isFirst}
            veil={overlaid}
            /*
             * THE FLOOR APPLIES TO THE OPENING HERO AND TO NO OTHER, which is why it reads `isFirst`
             * rather than the block type. A hero at the top of a page is the first thing anyone sees
             * and FEAT §49 question 2 asks it to hold the screen; a hero placed halfway down is a
             * band among bands, and giving that one three quarters of the viewport would push the
             * section above it off the screen to no purpose.
             */
            minBlockSize={isFirst ? 'var(--rv-hero-min-h)' : undefined}
          />
          {payload.is_video && payload.autoplay && motion != null ? (
            <HeroMotion
              cloudName={cloudName}
              media={mediaRefOf(motion)}
              /*
               * The poster is an editor's chosen opening frame if there is one and the STILL
               * otherwise — never a frame of the clip. Phase 11's binding table says why: the
               * desktop still is 21:9 and the only desktop clip in the library is 16:9, so a poster
               * taken from the clip would paint a differently-framed picture over the one the
               * visitor is already looking at.
               */
              posterPublicId={(poster ?? still)?.public_id ?? null}
              durationSeconds={motion.duration_s}
              alt={altTextOf(motion, section.media_alt_override)}
              playLabel={siteStringOrEmpty(strings, MEDIA_PLAY_LABEL_KEY)}
            />
          ) : null}
          {overlaid ? (
            <div className="absolute inset-x-0 bottom-0 p-(--rv-gutter)">{copy}</div>
          ) : null}
        </div>
        {overlaid ? null : (
          /*
           * `lg:order-first` PUTS THE COPY ON THE LEFT WITHOUT MOVING IT IN THE DOM. The picture is
           * first in source because it is first in the markup above; a screen reader and a keyboard
           * meet the words first at every width, which is the rule `ManifestoSection` and
           * `MediaSplitSection` both state — visual arrangement is art direction, reading order is
           * meaning. In the stacked case it is simply the margin.
           */
          <div className={split ? 'mt-8 lg:order-first lg:mt-0' : 'mt-8'}>{copy}</div>
        )}
      </SplitFrame>
    </SectionShell>
  )
}

/** The two-column frame a `split` hero needs, and nothing at all for the other two variants. */
function SplitFrame({
  split,
  children,
}: {
  readonly split: boolean
  readonly children: React.ReactNode
}): React.ReactElement {
  if (!split) return <>{children}</>
  return <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">{children}</div>
}
