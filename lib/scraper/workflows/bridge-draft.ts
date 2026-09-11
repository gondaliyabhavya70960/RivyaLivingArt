import type { TablesInsert } from '@/lib/supabase/database.types'

/**
 * The bridge's insert, as a pure function — Phase 35.
 *
 * **FIVE FIELDS, AND THE SLUG IS THE ONLY INPUT TEXT.** `startProductFromConfirmation` calls this
 * with the slug a person typed and the category they picked; it produces `slug`, `title` (the
 * slug's title case, a placeholder the owner replaces), `category_id`, `status = 'DRAFT'` and
 * `price_state = 'PRICE_ON_REQUEST'`, and nothing else. No competitor field is in scope here to
 * copy — the function does not know a research row exists — and
 * `tests/unit/confirmation-no-import.test.ts` asserts the key set is exactly this and that no
 * sentinel from a research row survives into it.
 */

/** Lower-case words joined by single hyphens; the same shape every catalogue slug has. */
export const BRIDGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

export const BRIDGE_FIELDS = ['slug', 'title', 'category_id', 'status', 'price_state'] as const

export function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function emptyDraftForBridge(input: {
  readonly slug: string
  readonly categoryId: string
}): Pick<TablesInsert<'products'>, (typeof BRIDGE_FIELDS)[number]> {
  if (!BRIDGE_SLUG.test(input.slug)) throw new Error('The slug is not a slug.')
  return {
    slug: input.slug,
    title: titleCaseSlug(input.slug),
    category_id: input.categoryId,
    status: 'DRAFT',
    price_state: 'PRICE_ON_REQUEST',
  }
}
