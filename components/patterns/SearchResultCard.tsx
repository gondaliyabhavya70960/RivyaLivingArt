import * as React from 'react'

import { BlockImage } from '@/components/patterns/MediaSlot'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import type { SiteStrings } from '@/lib/cms/strings'
import type { SearchHit } from '@/lib/supabase/repositories/search'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * One search result. Server-rendered, no client JavaScript.
 *
 * WHAT IT MAY SAY IS WHAT THE INDEX HOLDS, AND NOT ONE FIELD MORE. A title, a subtitle, a picture
 * if the source row has a real one bound, and a link. NOT a price — `presentPrice` needs the
 * product row and a search result is not a product card; showing a price here would mean
 * denormalising commercial state into an index that a trigger rewrites, and a stale price is a
 * business fact this repository must never fabricate (D10).
 *
 * IT IS A LINK, unlike Phase 14's `ProductCard`, and it may be: `/product/[slug]` shipped in
 * Phase 15, so every `url_path` in the public index resolves. A document with no `url_path` — the
 * two Studio-only types — never reaches this component, because the public page never asks for them.
 *
 * NO SNIPPET, NO HIGHLIGHTING, NO "DID YOU MEAN". Highlighting the matched term means re-tokenising
 * the query in the renderer and marking up whatever it happens to find, which goes wrong on the
 * exact queries — accents, hyphenated names — that the unaccenting in SQL was added to get right.
 * The subtitle the index already carries is a sentence somebody wrote; a snippet would be one
 * nobody did.
 *
 * A RESULT WITH NO PICTURE RENDERS AS TEXT, never as a placeholder tile. That is the same rule the
 * mega-menu applies to the two unbound categories, and it is D6: borrowing an image to fill a slot
 * is a claim about work that does not exist.
 */

export function SearchResultCard({
  hit,
  asset,
  strings,
  cloudName,
}: {
  readonly hit: SearchHit
  readonly asset: MediaAsset | null
  readonly strings: SiteStrings
  readonly cloudName: string
}): React.ReactElement | null {
  // Defensive rather than decorative: the public page only ever passes documents with a path, and
  // a result with nowhere to go should be absent rather than be a heading that does nothing.
  if (hit.url_path === null) return null

  return (
    <article data-search-result data-entity-type={hit.entity_type} className="group">
      <a
        href={hit.url_path}
        className="block focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Stack gap={2}>
          {asset === null ? null : (
            <BlockImage
              asset={asset}
              ratio="4:3"
              preset="card"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              strings={strings}
              cloudName={cloudName}
            />
          )}
          {/*
           * `level={3}`: the page's h1 names the page, each group's heading is an h2, and a result
           * sits inside a group. A card that chose its own level would break the outline on the
           * one view — a single-type search — where there is no group heading above it, so the
           * level is fixed here and the single-type view renders its group heading regardless.
           */}
          <Heading level={3} size="display-xs" className="underline-offset-4 group-hover:underline">
            {hit.title}
          </Heading>
          {hit.subtitle === null ? null : (
            <Text tone="secondary" size="sm">
              {hit.subtitle}
            </Text>
          )}
        </Stack>
      </a>
    </article>
  )
}
