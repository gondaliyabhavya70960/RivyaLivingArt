import * as React from 'react'

import { interpolate } from '@/lib/cms/strings'

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
 *
 * IT TAKES `hrefFor` AND ITS WORDS, NOT A CATALOGUE QUERY AND NOT CATALOGUE KEYS. This component
 * once took `basePath` plus a `CatalogQuery` and read `UI_LABEL.catalog.pagination` itself, which
 * tied a general navigation pattern to one listing twice over: a change to how the catalogue
 * encodes `sort` would have changed the journal's page URLs, and a screen-reader user paging
 * through the journal would have heard the region announced as the catalogue's.
 *
 * SO THE CALLER RESOLVES BOTH. It knows how its URLs are shaped and which rows name its own
 * controls; this component knows only that page 4 has an address and that its region has a name.
 * A null label means that piece does not render — the same rule `lib/cms/strings.ts` sets for every
 * public string, because an unnamed region is worse than an absent one.
 */

export interface PaginationLabels {
  /** Names the `<nav>`. Without it the whole component renders nothing: see the note above. */
  readonly region: string | null
  readonly previous: string | null
  readonly next: string | null
  /** `Page {{page}} of {{pages}}` — one sentence, because below 430px it is the only thing left. */
  readonly position: string | null
}

export interface PaginationProps {
  /** `page` → the URL for that page, in whatever shape the caller's route uses. */
  readonly hrefFor: (page: number) => string
  readonly page: number
  readonly pageCount: number
  readonly labels: PaginationLabels
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
  hrefFor,
  page,
  pageCount,
  labels,
}: PaginationProps): React.ReactElement | null {
  const { region: regionName, previous, next, position } = labels

  // One page is not a sequence. Rendering a disabled Previous and Next beside a single "1" tells a
  // visitor there is more when there is not.
  if (pageCount <= 1 || regionName === null) return null

  const numbers = pageNumbers(page, pageCount)
  const step = 'inline-flex min-w-11 items-center justify-center px-3 py-2 rv-hit-44'
  const link = `${step} text-ink underline-offset-4 hover:underline`
  // `text-ink-disabled`, not `text-ink-muted`: there is no --color-ink-muted token, so the class
  // generated no CSS and a disabled Previous rendered in full ink — a dead control that looked
  // live, which is the one thing a disabled control must not do.
  const disabled = `${step} text-ink-disabled`

  return (
    <nav aria-label={regionName} data-pagination="" className="mt-12">
      {/*
        `role="list"` is not redundant on a `ul` here. Tailwind's preflight sets `list-style: none`,
        and Safari drops list semantics from a list styled that way — so VoiceOver announces the
        page numbers as loose links and never says how many there are. `Breadcrumbs` and `Stack`
        both restore it for the same reason; this list was the one that did not.
      */}
      <ul role="list" className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 && previous !== null ? (
            <a rel="prev" href={hrefFor(page - 1)} className={link}>
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
                <li aria-hidden="true" className="hidden text-ink-tertiary min-[430px]:block">
                  …
                </li>
              ) : null}
              <li className="hidden min-[430px]:block">
                {n === page ? (
                  <span
                    aria-current="page"
                    data-current-page=""
                    className={`${step} text-ink font-medium`}
                  >
                    {n}
                  </span>
                ) : (
                  <a href={hrefFor(n)} className={link}>
                    {n}
                  </a>
                )}
              </li>
            </React.Fragment>
          )
        })}

        {position === null ? null : (
          <li
            data-pagination-position=""
            className="text-ink-secondary px-3 text-sm min-[430px]:hidden"
          >
            {interpolate(position, { page: String(page), pages: String(pageCount) })}
          </li>
        )}

        <li>
          {page < pageCount && next !== null ? (
            <a rel="next" href={hrefFor(page + 1)} className={link}>
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
