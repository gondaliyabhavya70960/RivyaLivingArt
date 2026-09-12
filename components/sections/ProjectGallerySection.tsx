import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'
import { siteString } from '@/lib/cms/strings'

import { SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * The photographs of a delivered project.
 *
 * IT DRAWS NOTHING WHEN THERE IS NOTHING, and today that is always: `portfolio_projects` holds zero
 * rows, so no page carries this band and no gallery has pictures. Not a skeleton and not an empty
 * frame — an empty frame on a project page reads as a photograph that failed to load, which is a
 * worse thing to show than nothing at all.
 *
 * THE CAPTION UNDER EACH PICTURE IS THE EDITOR'S, and the alt text is theirs too when they wrote
 * one. `alt_override` says what the picture is doing HERE, which is a different sentence from what
 * the picture is of — the same distinction `altTextOf` draws for a CMS section, applied per row of
 * the gallery table.
 *
 * THE BAND'S OWN CAPTION IS A SEEDED SENTENCE, not a literal: "Photographs of the finished
 * project." It is safe to say because `reject_concept_project_media` (0150) refuses a concept render
 * on this join outright, so the claim cannot be made false by an editor attaching a mood image.
 * Without the seeded row the sentence is simply absent, as every seeded string is.
 */

const REGION_KEY = 'UI_LABEL.project.gallery.heading'
const CAPTION_KEY = 'UI_LABEL.project.gallery.caption'

export function ProjectGallerySection({
  section,
  strings,
  cloudName,
  reference,
}: SectionRenderProps): React.ReactElement | null {
  const media = reference?.media ?? []
  // Nothing resolved means nothing to show. `reference` is undefined outside a page render (a
  // Studio preview built without the reference pass), and empty when the project has no pictures
  // in the roles this band asked for; both end here, because both mean "no photographs".
  if (media.length === 0) return null

  const regionName = siteString(strings, REGION_KEY)
  const bandCaption = siteString(strings, CAPTION_KEY)
  /*
   * `grid` IS TWO-UP AND `stacked` IS ONE PHOTOGRAPH PER ROW AT FULL WIDTH, which is the shape a
   * gallery of INTERIORS wants: a 4:5 crop at half the column is a picture of a corner, and a room
   * needs the width to read as a room. The block declared both from Phase 17 and branched on
   * neither. `grid` is the first declared variant, so an unknown value falls through to it.
   *
   * THE RATIO CHANGES WITH THE COLUMN, not just the number of columns. A full-width 4:5 is a tower;
   * 3:2 is what a photograph of a space is usually taken at, and it is what `PortfolioCard` already
   * holds at every width for the same reason.
   */
  const stacked = section.layout_variant === 'stacked'

  return (
    <SectionShell section={section}>
      <Stack gap={6}>
        <SectionCopy section={section} />

        <section
          data-project-gallery=""
          {...(regionName === null ? {} : { 'aria-label': regionName })}
        >
          <Stack gap={4}>
            {regionName === null ? null : <VisuallyHidden>{regionName}</VisuallyHidden>}

            <ul
              role="list"
              className={stacked ? 'grid list-none gap-8' : 'grid gap-4 sm:grid-cols-2'}
              data-project-gallery-items=""
            >
              {media.map((item) => (
                <li key={item.asset.id}>
                  <figure className="m-0">
                    <BlockImage
                      asset={item.asset}
                      ratio={stacked ? '3:2' : '4:5'}
                      preset="hero"
                      sizes={stacked ? '100vw' : '(min-width: 430px) 50vw, 100vw'}
                      altOverride={item.altOverride}
                      strings={strings}
                      cloudName={cloudName}
                    />
                    {item.caption === null ? null : (
                      <figcaption
                        data-project-gallery-caption=""
                        className="text-ink-secondary mt-2 text-sm"
                      >
                        {item.caption}
                      </figcaption>
                    )}
                  </figure>
                </li>
              ))}
            </ul>

            {bandCaption === null ? null : (
              <Text size="sm" tone="secondary" data-project-gallery-note="">
                {bandCaption}
              </Text>
            )}
          </Stack>
        </section>
      </Stack>
    </SectionShell>
  )
}
