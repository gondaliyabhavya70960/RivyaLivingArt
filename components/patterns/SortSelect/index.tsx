import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Select } from '@/components/primitives/Select'
import { CATALOG_ACTION_KEYS, CATALOG_UI_KEYS, sortOptions } from '@/lib/catalog/labels'
import { catalogSearchParams, type CatalogQuery } from '@/lib/catalog/query'
import { siteString, type SiteStrings } from '@/lib/cms/strings'

/**
 * RC-236. The sort control: a second `<form method="get">`, for the same reason as the first.
 *
 * WHY IT IS A SEPARATE FORM RATHER THAN A FIELD IN THE RAIL. Sorting is not filtering. Changing
 * the order of a result set must not reset it to page 1 or re-submit whatever the visitor had
 * half-ticked in the rail, and a single form cannot do both — a GET form submits everything it
 * contains. Two forms keep the two actions independent, which is also what a visitor expects: the
 * sort control is beside the results, the filters are beside the page.
 *
 * IT CARRIES THE ACTIVE FILTERS AS HIDDEN FIELDS. Without them, sorting would silently clear every
 * filter — the classic broken listing. `page` is deliberately NOT carried: re-sorting changes what
 * is on page 3, so returning to page 1 is the honest answer rather than a stale offset.
 *
 * A REAL SUBMIT BUTTON, ALWAYS. `onChange`-submitting a `<select>` is a JavaScript behaviour, and
 * the phase requires the listing to sort with JavaScript disabled. The button is the only thing
 * that submits, in every browser, in every state.
 */

export interface SortSelectProps {
  readonly basePath: string
  readonly query: CatalogQuery
  readonly strings: SiteStrings
}

export function SortSelect({ basePath, query, strings }: SortSelectProps): React.ReactElement | null {
  const label = siteString(strings, CATALOG_UI_KEYS.sort)
  const apply = siteString(strings, CATALOG_ACTION_KEYS.apply)
  const options = sortOptions(strings)

  // One option is not a choice, and an unlabelled control is not a control.
  if (label === null || apply === null || options.length < 2) return null

  /*
   * The filters as hidden fields, built from the canonical parameters so the two can never
   * disagree: whatever `catalogSearchParams` would put in a URL is exactly what this form carries.
   * `sort` and `page` are dropped — the select supplies the first and the second must reset.
   */
  const carried = catalogSearchParams(query)
  carried.delete('sort')
  carried.delete('page')

  return (
    <form method="get" action={basePath} data-sort-form="" className="flex flex-wrap items-end gap-3">
      {[...carried.entries()].map(([name, value]) => (
        <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
      ))}

      <div className="flex flex-col gap-1">
        <label htmlFor="catalog-sort" className="text-ink-secondary text-sm">
          {label}
        </label>
        <Select id="catalog-sort" name="sort" defaultValue={query.sort}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" variant="secondary" size="sm">
        {apply}
      </Button>
    </form>
  )
}
