import * as React from 'react'

import { CATALOG_ACTION_KEYS, CATALOG_UI_KEYS } from '@/lib/catalog/labels'
import { catalogUrl, type CatalogQuery } from '@/lib/catalog/query'
import { interpolate, siteString, type SiteStrings } from '@/lib/cms/strings'

/**
 * RC-234. Page-number pagination, as real links.
 *
 * NEVER INFINITE SCROLL. A scroll-triggered fetch has no address, so page 4 cannot be linked,
 * bookmarked, shared or crawled; it also breaks the back button and makes the footer unreachable.
 * The registry records this as a decision that needs a documented reversal, not a preference.
 *
 * EVERY CONTROL IS AN `<a href>`, so the listing paginates with JavaScript disabled and a crawler
 * follows it without executing anything. `rel="prev"` and `rel="next"` are on the anchors AND in
 * the document head (via each route's `generateMetadata`), because the two serve different
 * readers: the anchor tells a browser what it is following, the head tells a crawler how the
 * sequence is shaped.
 *
 * THE ENDS ARE DISABLED, NOT REMOVED. On page 1 "Previous" renders as a non-link with
 * `aria-disabled`; the control set therefore keeps its shape as a visitor moves through the pages,
 * rather than shifting sideways under the pointer at the boundaries.
 *
 * BELOW 430px THE NUMBER STRIP IS DROPPED, not scrolled sideways: eleven page numbers in a
 * horizontal scroller on a phone is a control nobody can hit. What remains is Previous, Next and
 * the position string — which is why that string exists as a seeded sentence with `{{page}}` and
 * `{{pages}}` in it rather than as three nodes glued together in JSX.
 */

export interface PaginationProps {
  readonly basePath: string
  readonly query: CatalogQuery
  readonly page: number
  readonly pageCount: number
  readonly strings: SiteStrings
}

/** How many numbered links to show around the current page before eliding. */
const WINDOW = 2

/** The pages worth linking: the first, the last, and a window around the current one. */
function pageNumbers(page: number, pageCount: number): readonly number[] {
  const wanted = new Set<number>([1, pageCount])
  for (let n = page - WINDOW; n <= page + WINDOW; n += 1) {
    if (n >= 1 && n <= pageCount) wanted.add(n)
  }
  return [...wanted].sort((a, b) => a - b)
}

export function Pagination({
  basePath,
  query,
  page,
  pageCount,
  strings,
}: PaginationProps): React.ReactElement | null {
  const regionName = siteString(strings, CATALOG_UI_KEYS.pagination)
  const previous = siteString(strings, CATALOG_ACTION_KEYS.previous)
  const next = siteString(strings, CATALOG_ACTION_KEYS.next)
  const position = siteString(strings, CATALOG_UI_KEYS.paginationPosition)

  // One page is not a sequence. Rendering a disabled Previous and Next beside a single "1" tells a
  // visitor there is more when there is not.
  if (pageCount <= 1 || regionName === null) return null

  const numbers = pageNumbers(page, pageCount)
  const step = 'inline-flex min-w-11 items-center justify-center px-3 py-2 rv-hit-44'
  const link = `${step} text-ink underline-offset-4 hover:underline`
  const disabled = `${step} text-ink-muted`

  return (
    <nav aria-label={regionName} data-pagination="" className="mt-12">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 && previous !== null ? (
            <a rel="prev" href={catalogUrl(basePath, query, { page: page - 1 })} className={link}>
              {previous}
            </a>
          ) : previous === null ? null : (
            <span aria-disabled="true" className={disabled}>
              {previous}
            </span>
          )}
        </li>

        {/* The number strip: hidden below 430px, where the position string carries the same fact. */}
        {numbers.map((n, index) => {
          const gap = index > 0 && n - (numbers[index - 1] ?? 0) > 1
          return (
            <React.Fragment key={n}>
              {gap ? (
                <li aria-hidden="true" className="text-ink-muted hidden min-[430px]:block">
                  …
                </li>
              ) : null}
              <li className="hidden min-[430px]:block">
                {n === page ? (
                  <span aria-current="page" data-current-page="" className={`${step} text-ink font-medium`}>
                    {n}
                  </span>
                ) : (
                  <a href={catalogUrl(basePath, query, { page: n })} className={link}>
                    {n}
                  </a>
                )}
              </li>
            </React.Fragment>
          )
        })}

        {position === null ? null : (
          <li data-pagination-position="" className="text-ink-secondary px-3 text-sm min-[430px]:hidden">
            {interpolate(position, { page: String(page), pages: String(pageCount) })}
          </li>
        )}

        <li>
          {page < pageCount && next !== null ? (
            <a rel="next" href={catalogUrl(basePath, query, { page: page + 1 })} className={link}>
              {next}
            </a>
          ) : next === null ? null : (
            <span aria-disabled="true" className={disabled}>
              {next}
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
