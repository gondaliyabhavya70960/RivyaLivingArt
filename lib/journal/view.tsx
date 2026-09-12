import 'server-only'

import type { Route } from 'next'
import Link from 'next/link'
import * as React from 'react'

import { ArticleCardGrid } from '@/components/patterns/ArticleCard'
import { Pagination } from '@/components/patterns/Pagination'
import { Container } from '@/components/primitives/Container'
import { Stack } from '@/components/primitives/Stack'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'
import { CATALOG_ACTION_KEYS } from '@/lib/catalog/labels'
import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { getSiteChrome } from '@/lib/site/chrome'

import { articleCardCopy, JOURNAL_KEYS } from './labels'
import { journalUrl, type JournalListing } from './listing'

/**
 * The list of articles, under whatever CMS bands the route already rendered.
 *
 * IT RENDERS NOTHING WHEN THERE ARE NO ARTICLES, and that is not an oversight. `/journal` carries a
 * seeded `empty-state` block holding SEED §29's sentence — *More from the studio soon.* — so an
 * empty listing that also drew its own message would say the same thing twice. The band above is
 * the empty state; this is the list, and a list of nothing is nothing.
 *
 * THE CATEGORY CHIPS ARE LINKS, NOT A FORM. Each is an address a visitor can bookmark, share and
 * come back to, and the row works with JavaScript disabled because there is no JavaScript in it.
 * The current one is marked `aria-current="page"` rather than merely styled, so a screen-reader user
 * knows which filter is on without seeing the colour.
 *
 * `All writing` IS FIRST AND IS AN ADDRESS TOO — `/journal` itself. A chip row where clearing the
 * filter needs the back button is a filter a visitor gets stuck in.
 */

export async function JournalListingView({
  listing,
  basePath,
  activeCategorySlug,
}: {
  readonly listing: JournalListing
  /** `/journal`, or `/journal/category/<slug>`. Pagination links are built from it. */
  readonly basePath: string
  /** The category this page is filtered to, if any. Marks the chip. */
  readonly activeCategorySlug: string | null
}): Promise<React.ReactElement | null> {
  const { strings } = await getSiteChrome()
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')?.trim() ?? ''

  const regionName = siteString(strings, JOURNAL_KEYS.results)
  const chipsName = siteString(strings, JOURNAL_KEYS.categories)
  const allLabel = siteString(strings, JOURNAL_KEYS.categoriesAll)

  /*
   * `rv-container` WAS NOT A CLASS — Phase 45, found by the token-usage audit. It looked like a
   * utility, matched nothing in the `@theme` bridge and produced NO CSS, so this surface rendered
   * full-bleed with no gutter and no measure at every width. `check-utilities.mjs` catches a
   * Tailwind candidate that resolves to nothing; a bare class name is not a candidate, so nothing
   * caught it. §5.3 keeps the measure and the gutter in `Container`, and this asks for them there.
   */
  return (
    <Container>
      <Stack gap={10} className="py-16" data-journal-listing="">
        {/*
            The chips render even with nothing published: the categories exist, and a reader arriving at
            an empty journal still learns what the studio intends to write about. What they must not do
            is render unnamed — an unlabelled row of links is a row a screen reader cannot explain.
          */}
        {chipsName === null || listing.categories.length === 0 ? null : (
          <nav aria-label={chipsName} data-journal-categories="">
            <ul role="list" className="flex flex-wrap gap-2">
              {allLabel === null ? null : (
                <li>
                  <Link
                    href={'/journal' as Route}
                    aria-current={activeCategorySlug === null ? 'page' : undefined}
                    className="rv-hit-44 inline-flex min-h-11 items-center rounded-full border border-line px-4 py-2 text-sm aria-[current]:border-transparent aria-[current]:bg-surface-accent aria-[current]:text-ink-on-accent"
                  >
                    {allLabel}
                  </Link>
                </li>
              )}
              {listing.categories.map((category) => {
                const slug = category.slug.toLowerCase()
                return (
                  <li key={category.id}>
                    <Link
                      href={`/journal/category/${slug}` as Route}
                      aria-current={activeCategorySlug === slug ? 'page' : undefined}
                      data-category-chip={slug}
                      className="rv-hit-44 inline-flex min-h-11 items-center rounded-full border border-line px-4 py-2 text-sm aria-[current]:border-transparent aria-[current]:bg-surface-accent aria-[current]:text-ink-on-accent"
                    >
                      {category.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}

        {listing.articles.length === 0 ? null : (
          <section aria-label={regionName ?? undefined}>
            {regionName === null ? null : <VisuallyHidden>{regionName}</VisuallyHidden>}
            {/*
             * LEVEL 2, BECAUSE THIS GRID IS THE PAGE. `/journal` has one `h1` and this region below
             * it; a card title at level 3 would sit under nothing. Phase 42's heading spec found it.
             */}
            <ArticleCardGrid
              headingLevel={2}
              articles={listing.articles}
              covers={listing.covers}
              categoryNames={listing.categoryNames}
              strings={strings}
              cloudName={cloudName}
              copy={articleCardCopy(strings)}
            />
          </section>
        )}

        {/*
            THE REGION AND POSITION STRINGS ARE THE JOURNAL'S; PREVIOUS AND NEXT ARE NOT. A screen-reader
            user paging through the journal must hear which listing they are in, so those two rows are
            the journal's own. "Previous" and "Next" are one word each and mean the same thing in both
            listings — seeding a second pair would give the owner two rows to keep in step for no gain,
            and one of them would drift.
          */}
        <Pagination
          hrefFor={(n) => journalUrl(basePath, n)}
          page={listing.page}
          pageCount={listing.pageCount}
          labels={{
            region: siteString(strings, JOURNAL_KEYS.pagination),
            previous: siteString(strings, CATALOG_ACTION_KEYS.previous),
            next: siteString(strings, CATALOG_ACTION_KEYS.next),
            position: siteString(strings, JOURNAL_KEYS.paginationPosition),
          }}
        />
      </Stack>
    </Container>
  )
}
