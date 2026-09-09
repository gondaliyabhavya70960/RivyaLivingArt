import 'server-only'

import { createPublicClient } from '@/lib/supabase/public'
import {
  countArticles,
  listArticles,
  listArticlesByCategory,
  listCategories,
} from '@/lib/supabase/repositories/journal'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import type { JournalArticle, JournalCategory, MediaAsset } from '@/lib/supabase/schemas'

/**
 * One page of the journal, and everything it needs to render.
 *
 * TWELVE PER PAGE, AS THE PHASE DOCUMENT SETS. Written here rather than at the two call sites so
 * `/journal` and `/journal/category/<slug>` cannot drift into paginating differently — a reader who
 * filters by category and finds the page size changed underneath them is being told the filter did
 * something it did not.
 *
 * PAGE NUMBERS ARE REAL LINKS AND `?page=` IS THE WHOLE QUERY. The journal has no facets, no sort
 * and no free-text search, so its URL shape is one parameter — which is why this module builds its
 * own URLs rather than borrowing the catalogue's serialiser. Coupling them would mean a change to
 * how the catalogue encodes `sort` silently changed the journal's page addresses.
 *
 * AN OUT-OF-RANGE PAGE IS CLAMPED, NOT 404'D. `?page=99` on a two-page journal is a stale link or a
 * crawler guessing, and the useful answer is the last page rather than an error — the canonical URL
 * in the metadata already tells a crawler which address is the real one. `?page=abc` is treated as
 * page 1 for the same reason.
 *
 * THE COVERS ARE FETCHED IN ONE QUERY, not one per card. The listing knows every article before the
 * first card renders, so every media id is knowable up front; a card that fetched its own asset
 * would be an async component doing a round trip inside the render.
 */

export const PER_PAGE = 12

export type JournalListing = {
  readonly articles: readonly JournalArticle[]
  readonly covers: ReadonlyMap<string, MediaAsset>
  readonly categories: readonly JournalCategory[]
  readonly categoryNames: ReadonlyMap<string, string>
  readonly page: number
  readonly pageCount: number
  readonly total: number
}

/** `?page=n`, and nothing else. Page 1 has no parameter, so the canonical URL is the bare path. */
export function journalUrl(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`
}

/** A page number from a raw search param. Anything unreadable is page 1. */
export function pageFrom(raw: string | string[] | undefined): number {
  const first = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number.parseInt(first ?? '', 10)
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
}

export async function loadJournalListing(options: {
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>
  /** When set, only this category's articles. The category page passes it; `/journal` does not. */
  readonly categoryId?: string
}): Promise<JournalListing> {
  const client = createPublicClient()
  const requested = pageFrom(options.searchParams.page)

  const [total, categories] = await Promise.all([
    countArticles(
      client,
      options.categoryId === undefined ? {} : { categoryId: options.categoryId },
    ),
    listCategories(client),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE))
  const page = Math.min(requested, pageCount)
  const offset = (page - 1) * PER_PAGE

  const articles =
    options.categoryId === undefined
      ? await listArticles(client, { limit: PER_PAGE, offset })
      : await listArticlesByCategory(client, options.categoryId, { limit: PER_PAGE, offset })

  const coverIds = [
    ...new Set(
      articles.flatMap((article) =>
        article.cover_media_id === null ? [] : [article.cover_media_id],
      ),
    ),
  ]
  const covers = await listMediaAssetsByIds(client, coverIds)

  return {
    articles,
    covers,
    categories,
    categoryNames: new Map(categories.map((category) => [category.id, category.name])),
    page,
    pageCount,
    total,
  }
}
