import * as React from 'react'

import { ArticleCardGrid } from '@/components/patterns/ArticleCard'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { relatedForArticle } from '@/lib/cms/related'
import { interpolate, siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { JOURNAL_KEYS, articleCardCopy } from '@/lib/journal/labels'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { listArticlesByIds, listCategories } from '@/lib/supabase/repositories/journal'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import type { JournalArticle } from '@/lib/supabase/schemas'
import { Container } from '@/components/primitives/Container'

/**
 * What sits at the end of an article.
 *
 * TWO HEADINGS, NEVER ONE BLENDED LIST, because the two groups are different claims.
 * `journal.related.curated` heads the links an editor made by hand — a person decided these belong
 * together. `journal.related.same_category` heads the fill, and it states a fact rather than
 * implying a judgement: *More in Materials*, because that is all that is true of them.
 *
 * `lib/cms/related.ts` OWNS THE DECISION AND THIS FILE OWNS THE DRAWING. The rule — curated first,
 * then one stated fallback — lives there with the test that holds it; here it is only laid out.
 *
 * ONLY THE ARTICLE HALF OF THE CURATED EDGES IS RENDERED TODAY, and the reason is worth stating
 * rather than leaving as a silence. `entity_relations` lets an editor link an article to a product,
 * a project or a collection as well, and those are real edges the Studio can already create — but
 * `products` and `portfolio_projects` both hold zero published rows, so a strip that resolved them
 * would render an empty heading on every article. When there is published work to point at, this
 * component grows a reader for each type; until then it draws what exists.
 */
export async function ArticleRelated({
  article,
}: {
  readonly article: JournalArticle
}): Promise<React.ReactElement | null> {
  const client = createPublicClient()
  const related = await relatedForArticle(client, article)

  const { strings } = await getSiteChrome()
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')?.trim() ?? ''

  const [categories, curatedArticles] = await Promise.all([
    listCategories(client),
    resolveCuratedArticles(client, related.curated),
  ])

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
  const groups: { key: string; heading: string; articles: readonly JournalArticle[] }[] = []

  const curatedHeading = siteString(strings, JOURNAL_KEYS.relatedCurated)
  if (curatedArticles.length > 0 && curatedHeading !== null) {
    groups.push({ key: 'curated', heading: curatedHeading, articles: curatedArticles })
  }

  const sameHeading = siteString(strings, JOURNAL_KEYS.relatedSameCategory)
  const sameName =
    related.sameCategoryId === null ? null : (categoryNames.get(related.sameCategoryId) ?? null)
  if (related.sameCategory.length > 0 && sameHeading !== null && sameName !== null) {
    groups.push({
      key: 'same-category',
      heading: interpolate(sameHeading, { category: sameName }),
      articles: related.sameCategory,
    })
  }

  if (groups.length === 0) return null

  const covers = await listMediaAssetsByIds(client, [
    ...new Set(
      groups
        .flatMap((group) => group.articles)
        .flatMap((entry) => (entry.cover_media_id === null ? [] : [entry.cover_media_id])),
    ),
  ])

  /*
   * `rv-container` WAS NOT A CLASS — Phase 45, found by the token-usage audit. It looked like a
   * utility, matched nothing in the `@theme` bridge and produced NO CSS, so this surface rendered
   * full-bleed with no gutter and no measure at every width. `check-utilities.mjs` catches a
   * Tailwind candidate that resolves to nothing; a bare class name is not a candidate, so nothing
   * caught it. §5.3 keeps the measure and the gutter in `Container`, and this asks for them there.
   */
  return (
    <Container>
      <Stack gap={12} className="pb-24" data-article-related="">
        {groups.map((group) => (
          <Stack key={group.key} gap={6} data-related-group={group.key}>
            <Heading level={2} size="display-xs">
              {group.heading}
            </Heading>
            <ArticleCardGrid
              articles={group.articles}
              covers={covers}
              categoryNames={categoryNames}
              strings={strings}
              cloudName={cloudName}
              copy={articleCardCopy(strings)}
            />
          </Stack>
        ))}
      </Stack>
    </Container>
  )
}

/**
 * The curated edges that point at articles, as rows, in the editor's order.
 *
 * ONE QUERY, AND RLS DECIDES WHAT COMES BACK. An edge pointing at a draft article resolves to
 * nothing for a visitor, so the strip silently drops it — which is right: the edge is an editorial
 * intention, and the article is not readable yet.
 */
async function resolveCuratedArticles(
  client: ReturnType<typeof createPublicClient>,
  curated: Awaited<ReturnType<typeof relatedForArticle>>['curated'],
): Promise<readonly JournalArticle[]> {
  const ids = curated
    .filter((edge) => edge.target_type === 'JOURNAL_ARTICLE')
    .map((edge) => edge.target_id)
  if (ids.length === 0) return []

  // A read that throws here would take the whole article page down for the sake of a strip beneath
  // it. An unreachable database means no curated articles, which is what the empty state is for.
  const rows = await listArticlesByIds(client, ids).catch(() => [])

  const byId = new Map(rows.map((row) => [row.id, row]))
  // The editor's order, not the database's: `in (…)` returns rows in whatever order it likes.
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row === undefined ? [] : [row]
  })
}
