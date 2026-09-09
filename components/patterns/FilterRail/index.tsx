import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Stack } from '@/components/primitives/Stack'
import { TextLink } from '@/components/primitives/TextLink'
import { CATALOG_ACTION_KEYS, CATALOG_UI_KEYS } from '@/lib/catalog/labels'
import type { FilterGroup } from '@/lib/catalog/rail'
import { DEFAULT_SORT, hasActiveFilters, type CatalogQuery } from '@/lib/catalog/query'
import { siteString, type SiteStrings } from '@/lib/cms/strings'

/**
 * RC-235. The filter rail: a `<form method="get">` and nothing else.
 *
 * THIS IS THE WHOLE PROGRESSIVE-ENHANCEMENT STORY. There is no client state, no fetch, no
 * `useSearchParams`, no router push — the form's action is the listing's own path, the checkboxes
 * are named after the query parameters, and pressing the submit button navigates to a URL the
 * server renders from scratch. With JavaScript disabled it behaves identically, because there is
 * nothing to disable. A rail built the other way would lose linkability, the back button, crawler
 * access and every visitor whose script did not load, in exchange for avoiding a page load.
 *
 * THE SUBMIT BUTTON IS NOT OPTIONAL AND IS NEVER HIDDEN. A pattern that auto-submits on change
 * needs JavaScript; a pattern that hides the button until JavaScript is absent needs JavaScript to
 * decide. The button is always there, which is also the more predictable interaction on a phone:
 * tick three boxes, then apply, rather than three page loads.
 *
 * `page` IS DELIBERATELY ABSENT FROM THIS FORM. A GET form submits exactly the fields it contains,
 * so leaving the current page number out is what returns a new filter to page 1 — where its
 * results actually are.
 *
 * `sort` IS A HIDDEN FIELD when it is not the default, because the same rule would otherwise
 * silently discard a visitor's sort the moment they touched a filter.
 *
 * EVERY WORD COMES FROM `global_content`. The group names, the two buttons and every option label
 * are rows; a group whose legend has no row does not render at all rather than appearing
 * unlabelled — `lib/catalog/rail.ts` drops it before this component ever sees it.
 */

export interface FilterRailProps {
  /** Where the form submits: the listing's own path, without a query string. */
  readonly basePath: string
  readonly query: CatalogQuery
  readonly groups: readonly FilterGroup[]
  readonly strings: SiteStrings
  /** Rendered when anything is filtering. Usually `basePath` itself. */
  readonly clearHref: string
}

export function FilterRail({
  basePath,
  query,
  groups,
  strings,
  clearHref,
}: FilterRailProps): React.ReactElement | null {
  const heading = siteString(strings, CATALOG_UI_KEYS.filters)
  const apply = siteString(strings, CATALOG_ACTION_KEYS.apply)
  const clear = siteString(strings, CATALOG_ACTION_KEYS.clear)

  // No groups means nothing to filter — an empty catalogue, or one where every facet is empty.
  // A rail with a heading, a button and no controls is furniture, so it does not render.
  if (groups.length === 0 || heading === null || apply === null) return null

  return (
    <form
      method="get"
      action={basePath}
      aria-labelledby="catalog-filters-heading"
      data-filter-rail=""
    >
      <Stack gap={6}>
        <h2
          id="catalog-filters-heading"
          className="font-display text-display-xs text-ink leading-heading"
        >
          {heading}
        </h2>

        {query.sort === DEFAULT_SORT ? null : (
          <input type="hidden" name="sort" value={query.sort} />
        )}

        {groups.map((group) => (
          <fieldset key={group.param} data-facet={group.param} className="border-0 p-0">
            <legend className="text-ink-secondary text-sm tracking-wide uppercase">
              {group.legend}
            </legend>
            <Stack gap={2} className="mt-3">
              {group.options.map((option) => (
                <Checkbox
                  key={option.value}
                  name={group.param}
                  value={option.value}
                  defaultChecked={option.checked}
                  data-facet-value={option.value}
                  label={
                    <span>
                      {option.label}
                      {/*
                       * The count is data, not copy, and it is inside the label so a screen
                       * reader announces "Oak, 4" rather than leaving the number orphaned beside
                       * a checkbox it is not associated with.
                       */}
                      <span data-facet-count="" className="text-ink-secondary ml-2 text-sm">
                        {option.count}
                      </span>
                    </span>
                  }
                />
              ))}
            </Stack>
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="secondary" size="sm">
            {apply}
          </Button>
          {hasActiveFilters(query) && clear !== null ? (
            <TextLink href={clearHref} data-clear-filters="">
              {clear}
            </TextLink>
          ) : null}
        </div>
      </Stack>
    </form>
  )
}
