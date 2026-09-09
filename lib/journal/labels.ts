import { siteString, type SiteStrings } from '@/lib/cms/strings'

/**
 * The `global_content` keys the journal's own controls read.
 *
 * ONE PLACE, SO A TYPO IS A COMPILE ERROR RATHER THAN A BLANK CHIP. `siteString` returns null for a
 * key it does not have and every caller drops the null — which is the right behaviour and also means
 * a mistyped key is invisible: the control simply does not render. Naming them here makes the set
 * greppable and lets `content/seed/journal-ui.ts` be checked against it.
 */
const UI = 'UI_LABEL'

export const JOURNAL_KEYS = {
  categories: `${UI}.journal.categories`,
  categoriesAll: `${UI}.journal.categories.all`,
  readingTime: `${UI}.journal.reading_time`,
  byline: `${UI}.journal.byline`,
  relatedCurated: `${UI}.journal.related.curated`,
  relatedSameCategory: `${UI}.journal.related.same_category`,
  results: `${UI}.journal.results`,
  pagination: `${UI}.journal.pagination`,
  paginationPosition: `${UI}.journal.pagination.position`,
} as const

/** The two strings a card needs, resolved once by the route rather than per card. */
export function articleCardCopy(strings: SiteStrings): { readonly readingTime: string | null } {
  return { readingTime: siteString(strings, JOURNAL_KEYS.readingTime) }
}
