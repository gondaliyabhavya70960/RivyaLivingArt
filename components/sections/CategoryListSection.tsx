import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { categoryListBlock } from '@/content/blocks/category-list'
import { visibleEntries } from '@/lib/cms/entry-visibility'
import { parseBlockPayload } from '@/lib/cms/registry'
import { resolveInternalTarget } from '@/lib/site/resolve-target'

import { hasSectionCopy, SectionCopy } from './SectionCopy'
import { SectionShell } from './SectionShell'
import type { SectionRenderProps } from './types'

/**
 * Editorial groupings as cards. SEED §12-03.
 *
 * THE TEXT-ONLY CARD IS A DESIGNED LAYOUT, NOT A DEGRADED ONE. Of the six groupings on
 * `/large-format`, one has no photograph in the library at all — Conference & Commercial Tables,
 * recorded as a gap rather than filled — and two have a single asset each. A card with no picture
 * therefore renders as a card with no picture: no reserved grey box, no borrowed image from a
 * neighbouring family, no "coming soon". The grid is built to hold a mix, because a mix is what
 * the library actually contains.
 *
 * A CARD IS A LINK ONLY WHEN ITS DESTINATION IS LIVE. An entry's `href` is a database value typed
 * in Studio, so `typedRoutes` cannot see it and a path whose page has no published sections looks
 * exactly like one that has. `resolveInternalTarget` answers with the paths that actually render;
 * anything else renders as text. That is deliberately not the same as hiding the card — the words
 * the editor wrote are still true, and only the destination is unavailable.
 *
 * A NON-INTERACTIVE CARD IS NOT FOCUSABLE, and that is the accessibility half of the same
 * decision. An `<a>` with no href is announced as a link and reached by Tab; a `<div>` is
 * announced as the text it contains, which is what it is.
 *
 * THREE OF THE SIX ARE WITHHELD AT LAUNCH — §12 marks two outright and leaves the third
 * conditional on production nobody has confirmed — so `visibleEntries` filters before the grid is
 * laid out, and the launch composition is three cards rather than six with gaps.
 */
export function CategoryListSection({
  section,
  media,
  strings,
  cloudName,
  livePaths,
}: SectionRenderProps): React.ReactElement | null {
  const payload = parseBlockPayload(categoryListBlock, section.payload)
  const entries = visibleEntries(payload.entries).filter((entry) => entry.title.trim() !== '')
  if (entries.length === 0 && !hasSectionCopy(section)) return null

  const assets = media.slot('entries')
  const rows = (section.layout_variant ?? 'grid') === 'rows'

  return (
    <SectionShell section={section} spacing="lg" container="wide">
      <Stack gap={10}>
        <SectionCopy section={section} size="display-lg" />
        {entries.length === 0 ? null : (
          <Grid
            gap={8}
            className={rows ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}
          >
            {entries.map((entry) => {
              const index = entry.media_index ?? null
              const asset = index === null ? null : (assets[index] ?? null)
              const target = resolveInternalTarget(entry.href, livePaths)

              const body = (
                <Stack gap={3}>
                  {/* No frame at all when there is no asset: a reserved box with a fallback label
                      is the right answer when a picture was BOUND and did not resolve, and the
                      wrong one when the library has no picture to bind. */}
                  {asset === null ? null : (
                    <BlockImage
                      asset={asset}
                      ratio="16:9"
                      mobileRatio="4:5"
                      preset="grid"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      strings={strings}
                      cloudName={cloudName}
                    />
                  )}
                  <Heading level={3} size="display-sm">
                    {entry.title}
                  </Heading>
                  {entry.description.trim() === '' ? null : (
                    <Text size="base" tone="secondary">
                      {entry.description}
                    </Text>
                  )}
                </Stack>
              )

              return target === null ? (
                <div key={entry.key} data-entry-key={entry.key}>
                  {body}
                </div>
              ) : (
                <a
                  key={entry.key}
                  data-entry-key={entry.key}
                  href={target}
                  className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--rv-ink-accent)"
                >
                  {body}
                </a>
              )
            })}
          </Grid>
        )}
      </Stack>
    </SectionShell>
  )
}
