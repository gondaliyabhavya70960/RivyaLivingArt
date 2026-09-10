import type { Metadata } from 'next'
import type * as React from 'react'

import { SearchResultCard } from '@/components/patterns/SearchResultCard'
import { Container } from '@/components/primitives/Container'
import { Heading } from '@/components/primitives/Heading'
import { Section } from '@/components/primitives/Section'
import { Text } from '@/components/primitives/Text'
import { interpolate, siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { groupResults } from '@/lib/search/group'
import { recordPublicSearch } from '@/lib/search/log'
import {
  GROUP_SIZE,
  PAGE_SIZE,
  canonicalSearchUrl,
  isSearchable,
  parseSearchQuery,
  searchUrl,
} from '@/lib/search/query'
import { createClient } from '@/lib/supabase/server'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import {
  countSearchDocuments,
  searchDocuments,
  type SearchHit,
} from '@/lib/supabase/repositories/search'
import { PUBLIC_ENTITY_TYPES, type MediaAsset, type PublicEntityType } from '@/lib/supabase/schemas'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getSiteChrome } from '@/lib/site/chrome'

/**
 * /search — the results page.
 *
 * THE ONE STATIC ROUTE THAT IS NOT A `renderCmsPage` DELEGATE, for the reason Phase 09 recorded and
 * Phase 23 has not changed: `/search` has no `pages` row because it composes nothing an editor
 * arranges. What Phase 23 changes is only what happens BELOW the form. The form itself, its label,
 * its placeholder, its button and SEED §26's no-results copy are the same rows as before, rendered
 * the same way — because the previous version's promise was that it would say plainly when nothing
 * matched, and that sentence is now true rather than merely honest.
 *
 * IT STILL RENDERS NO COPY OF ITS OWN. Group headings, the count sentence, the near-match band and
 * the empty state are all `global_content`. A heading with no seeded row is not rendered.
 *
 * IT IS `noindex`, AND THAT IS UNCHANGED BY HAVING RESULTS. A search-results URL is exactly what a
 * crawler should not index: it is an infinite space of near-duplicate pages built from a query
 * string a stranger controls.
 *
 * WHY THE ADMIN CLIENT APPEARS ON A PUBLIC PAGE. `search_queries` has no session write policy at
 * all — a public search has no session, and an anon insert policy would be an endpoint a stranger
 * could fill with arbitrary text (0212). The log is written with the service role, AFTER the
 * results are in hand, and a failure to write it is swallowed: the visitor came to find a table.
 */
const PATH = '/search'

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({ path: PATH, liveSectionCount: 0 })
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.ReactElement> {
  const { strings } = await getSiteChrome()
  const query = parseSearchQuery(await searchParams)
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') ?? ''

  const pageHeading = siteString(strings, 'UI_LABEL.search.heading')
  const label = siteString(strings, 'UI_LABEL.search.label')
  const placeholder = siteString(strings, 'FORM_COPY.search.placeholder')
  const submit = siteString(strings, 'ACTION_LABEL.search.submit')
  const emptyHeading = siteString(strings, 'EMPTY_STATE.search.heading')
  const emptyBody = siteString(strings, 'EMPTY_STATE.search.body')
  const similarHeading = siteString(strings, 'UI_LABEL.search.similar.heading')
  const similarBody = siteString(strings, 'UI_LABEL.search.similar.body')
  const seeMore = siteString(strings, 'ACTION_LABEL.search.see_more_in_group')

  const client = await createClient()

  /**
   * TWO SHAPES OF QUERY, AND THE PAGE PICKS ONE.
   *
   * The landing view asks each of the five types for its own ten, so a query matching forty
   * products still shows a collection. One flat query capped at fifty would let the largest group
   * crowd out the rest, which is the failure mode of every "grouped" search that is really one list
   * with subheadings.
   *
   * The single-type view is one query, paginated. The near-match fallback belongs only to the
   * landing view: a fallback long enough to paginate has stopped being a fallback.
   */
  const searchable = isSearchable(query)

  let hits: SearchHit[] = []
  let totals: Partial<Record<PublicEntityType, number>> = {}
  let pageTotal = 0

  if (searchable) {
    if (query.type === null) {
      const perType = await Promise.all(
        PUBLIC_ENTITY_TYPES.map(async (entityType) => {
          const [rows, count] = await Promise.all([
            searchDocuments(client, query.q, {
              scope: 'PUBLIC',
              types: [entityType],
              limit: GROUP_SIZE,
            }),
            countSearchDocuments(client, query.q, { scope: 'PUBLIC', types: [entityType] }),
          ])
          return { entityType, rows, count }
        }),
      )
      hits = perType.flatMap((entry) => entry.rows)
      totals = Object.fromEntries(perType.map((entry) => [entry.entityType, entry.count]))
      pageTotal = perType.reduce((sum, entry) => sum + entry.count, 0)
    } else {
      const [rows, count] = await Promise.all([
        searchDocuments(client, query.q, {
          scope: 'PUBLIC',
          types: [query.type],
          category: query.category,
          limit: PAGE_SIZE,
          offset: (query.page - 1) * PAGE_SIZE,
        }),
        countSearchDocuments(client, query.q, {
          scope: 'PUBLIC',
          types: [query.type],
          category: query.category,
        }),
      ])
      hits = rows
      totals = { [query.type]: count }
      pageTotal = count
    }
  }

  const grouped = groupResults(hits, totals, query.type === null ? GROUP_SIZE : PAGE_SIZE)

  // Every hero the visible cards need, in one read. A card whose asset is missing renders as text.
  const assetIds = [...new Set(hits.map((hit) => hit.image_media_id).filter(isPresent))]
  // A failed media read costs pictures, not results. The cards fall back to text, which is the
  // same branch a category with no bound hero already takes in the mega menu.
  const assetById: ReadonlyMap<string, MediaAsset> =
    assetIds.length === 0
      ? new Map()
      : await listMediaAssetsByIds(client, assetIds).catch(() => new Map<string, MediaAsset>())

  if (searchable) {
    // AFTER the results, never before: the log records what a search FOUND, and a row written
    // first would have to guess. `recordPublicSearch` holds the service role so this page does
    // not — see its header — and it cannot throw.
    await recordPublicSearch(query.q, pageTotal)
  }

  const countKey =
    pageTotal === 0
      ? 'UI_LABEL.search.count.none'
      : pageTotal === 1
        ? 'UI_LABEL.search.count.one'
        : 'UI_LABEL.search.count'
  const countTemplate = siteString(strings, countKey)
  const countSentence =
    countTemplate === null
      ? null
      : interpolate(countTemplate, { count: String(pageTotal), query: query.q })

  const totalPages = query.type === null ? 1 : Math.max(1, Math.ceil(pageTotal / PAGE_SIZE))

  return (
    <Section>
      <Container size="default">
        {pageHeading === null ? null : (
          <Heading level={1} size="display-md" className="mb-8">
            {pageHeading}
          </Heading>
        )}

        {/* Unchanged from Phase 10: a GET form, so a search is a URL a visitor can bookmark,
            share and reload — and so it works with no JavaScript. Not a client island. */}
        <form method="get" action={PATH} role="search" className="flex items-end gap-3">
          <div className="flex-1">
            {label === null ? null : (
              <label htmlFor="site-search" className="sr-only">
                {label}
              </label>
            )}
            <input
              id="site-search"
              type="search"
              name="q"
              defaultValue={query.q}
              className="w-full border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-secondary"
              {...(placeholder === null ? {} : { placeholder })}
            />
          </div>
          {submit === null ? null : (
            <button
              type="submit"
              className="border border-line px-4 py-2 text-sm uppercase tracking-technical text-ink"
            >
              {submit}
            </button>
          )}
        </form>

        <div aria-live="polite" className="mt-10">
          {!searchable ? null : (
            <>
              {countSentence === null ? null : (
                <Text tone="secondary" className="mb-8">
                  {countSentence}
                </Text>
              )}

              {grouped.groups.length === 0 && grouped.similar.length === 0 ? (
                <>
                  {/* SEED §26, unchanged and unembellished. No "did you mean", ever: a suggestion
                      the site generates is a product name nobody at Rivya wrote (D10). */}
                  {emptyHeading === null ? null : (
                    <Heading level={2} size="display-sm">
                      {emptyHeading}
                    </Heading>
                  )}
                  {emptyBody === null ? null : (
                    <Text tone="secondary" className="mt-3">
                      {emptyBody}
                    </Text>
                  )}
                </>
              ) : null}

              {grouped.groups.map((group) => {
                const heading = siteString(strings, `UI_LABEL.${group.headingKey}`)
                const more = group.total > group.hits.length
                return (
                  <section
                    key={group.entityType}
                    className="mb-12"
                    data-search-group={group.entityType}
                  >
                    {heading === null ? null : (
                      <Heading level={2} size="display-sm" className="mb-4">
                        {heading}
                      </Heading>
                    )}
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                      {group.hits.map((hit) => (
                        <SearchResultCard
                          key={hit.id}
                          hit={hit}
                          asset={
                            hit.image_media_id === null
                              ? null
                              : (assetById.get(hit.image_media_id) ?? null)
                          }
                          strings={strings}
                          cloudName={cloudName}
                        />
                      ))}
                    </div>
                    {more && seeMore !== null && heading !== null ? (
                      <a
                        href={searchUrl(query, { type: group.entityType })}
                        className="mt-4 inline-block text-sm underline underline-offset-4"
                      >
                        {interpolate(seeMore, { count: String(group.total), group: heading })}
                      </a>
                    ) : null}
                  </section>
                )
              })}

              {grouped.similar.length === 0 ? null : (
                <section className="mt-12 border-t border-line pt-8" data-search-group="similar">
                  {similarHeading === null ? null : (
                    <Heading level={2} size="display-sm" className="mb-2">
                      {similarHeading}
                    </Heading>
                  )}
                  {similarBody === null ? null : (
                    <Text tone="secondary" className="mb-4">
                      {similarBody}
                    </Text>
                  )}
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {grouped.similar.map((hit) => (
                      <SearchResultCard
                        key={hit.id}
                        hit={hit}
                        asset={
                          hit.image_media_id === null
                            ? null
                            : (assetById.get(hit.image_media_id) ?? null)
                        }
                        strings={strings}
                        cloudName={cloudName}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Pagination exists only on the single-type view; the landing view links into it
                  instead. Plain links, so the whole page works without JavaScript. */}
              {query.type !== null && totalPages > 1 ? (
                <nav className="mt-10 flex gap-4 text-sm">
                  {query.page > 1 ? (
                    <a
                      rel="prev"
                      href={searchUrl(query, { page: query.page - 1 })}
                      className="underline underline-offset-4"
                    >
                      {query.page - 1}
                    </a>
                  ) : null}
                  {query.page < totalPages ? (
                    <a
                      rel="next"
                      href={searchUrl(query, { page: query.page + 1 })}
                      className="underline underline-offset-4"
                    >
                      {query.page + 1}
                    </a>
                  ) : null}
                </nav>
              ) : null}

              {/* The address this exact result set lives at. Rendered as a link relation rather
                  than a visible control: it is for a machine, and the page is noindex anyway. */}
              <link rel="canonical" href={canonicalSearchUrl(query)} />
            </>
          )}
        </div>
      </Container>
    </Section>
  )
}

function isPresent(value: string | null): value is string {
  return value !== null
}
