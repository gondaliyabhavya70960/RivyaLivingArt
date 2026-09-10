import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Grid } from '@/components/primitives/Grid'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { TextLink } from '@/components/primitives/TextLink'
import type { EditorialTile } from '@/lib/cms/editorial-tile'
import { siteString, type SiteStrings } from '@/lib/cms/strings'
import type { SelectorResult } from '@/lib/cms/selectors'

export type { EditorialTile } from '@/lib/cms/editorial-tile'

/**
 * What a reference block shows when the thing it refers to does not exist.
 *
 * IT IS NOT A SKELETON AND NOT A PLACEHOLDER CARD, and both of those were the obvious answers.
 *
 *   * A SKELETON says "loading". Nothing is loading — there is nothing to load, and there will be
 *     nothing to load until a later phase creates the table or the owner publishes a product. A
 *     shimmer that never resolves is a lie told politely, and it is the kind that gets shipped
 *     because it looks considered.
 *   * A PLACEHOLDER CARD is a product, project or article that does not exist. That is the
 *     fabrication D10 forbids in its plainest form, and it is worse than an empty band because it
 *     looks finished — nobody files a bug against a page that looks right.
 *
 * SO IT IS A SENTENCE THE OWNER WROTE. `EMPTY_STATE.collection`, `.portfolio` and `.journal` are
 * SEED §27, §28 and §29 verbatim, seeded by Phase 09 and editable in Studio. When the string is
 * missing the component renders NOTHING — `lib/cms/strings.ts` ships no fallbacks for the public
 * site, and a default here would be a sentence nobody wrote appearing in the one place designed to
 * admit that there is nothing to say.
 *
 * PHASE 22 ADDED TILES, AND THEY ARE STRUCTURALLY INCAPABLE OF LOOKING LIKE INVENTORY. An
 * `EDITORIAL_BLOCK` fallback draws media and copy from a SECTION the owner named — by default the
 * page's own material story (SEED §10-05) — as tiles with a heading, a line and a picture. There
 * is no price element, no "Price on Request" label, no product link, no *View Product* control, no
 * SKU and no dimensions in this component, and there cannot be: `EditorialTile` has no field to
 * carry one. The only link a tile may carry targets `/large-format`, `/collection` or
 * `/custom-commissions` — `lib/cms/references.ts` drops any other destination before the tile is
 * built, and `tests/unit/merchandising-resolve.test.ts` asserts the rendered output contains no
 * product route and no price label.
 *
 * `data-empty-reason` CARRIES THE DISTINCTION THE PAGE DOES NOT. "The table does not exist yet" and
 * "the table is empty" look identical to a visitor and are different facts to whoever is deciding
 * whether the site is broken or merely young. It is an attribute rather than words, because the
 * visitor is not that reader.
 */

export type EditorialFallbackProps = {
  readonly strings: SiteStrings
  /** A dotted `global_content` key — `EMPTY_STATE.portfolio` and its two siblings. */
  readonly contentKey: string
  /** From the selector, so the page records why it is empty without saying so. */
  readonly reason: SelectorResult['reason']
  /** Phase 22: the EDITORIAL_BLOCK tiles, when a fallback section resolved. */
  readonly tiles?: readonly EditorialTile[]
  readonly cloudName?: string
}

export function EditorialFallback({
  strings,
  contentKey,
  reason,
  tiles = [],
  cloudName = '',
}: EditorialFallbackProps): React.ReactElement | null {
  const message = siteString(strings, contentKey)
  if (message === null && tiles.length === 0) return null

  return (
    <div data-empty-reason={reason}>
      <Stack gap={8}>
        {message === null ? null : (
          <div className="max-w-prose">
            <Text tone="secondary">{message}</Text>
          </div>
        )}
        {tiles.length === 0 ? null : (
          <Grid gap={6} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) => (
              <div key={tile.key} data-editorial-tile={tile.key}>
                <Stack gap={3}>
                  {tile.asset === null ? null : (
                    <BlockImage
                      asset={tile.asset}
                      ratio="4:5"
                      preset="card"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      altOverride={tile.altOverride}
                      strings={strings}
                      cloudName={cloudName}
                    />
                  )}
                  {tile.heading === null ? null : (
                    <Heading level={3} size="display-xs" className="whitespace-pre-line">
                      {tile.heading}
                    </Heading>
                  )}
                  {tile.body === null ? null : (
                    <Text size="base" tone="secondary" className="whitespace-pre-line">
                      {tile.body}
                    </Text>
                  )}
                  {tile.ctaLabel === null || tile.ctaHref === null ? null : (
                    <TextLink href={tile.ctaHref}>{tile.ctaLabel}</TextLink>
                  )}
                </Stack>
              </div>
            ))}
          </Grid>
        )}
      </Stack>
    </div>
  )
}
