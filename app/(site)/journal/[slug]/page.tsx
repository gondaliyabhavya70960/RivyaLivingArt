import type { Metadata } from 'next'
import * as React from 'react'

import { JsonLd } from '@/components/patterns/JsonLd'
import { mediaRefOf } from '@/lib/cms/media'
import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { resolveSpec } from '@/lib/media/transform'
import { imageUrl } from '@/lib/media/url'
import { entityBreadcrumbs } from '@/lib/seo/breadcrumbs'
import { siteOrigin } from '@/lib/seo/canonical'
import { articleJsonLd, graphOf } from '@/lib/seo/jsonld'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { getArticleBySlug, listArticles, listCategories } from '@/lib/supabase/repositories/journal'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import type { JournalArticle } from '@/lib/supabase/schemas'

import { ArticleRelated } from './related'
import { prerenderParams } from '@/lib/site/prerender'

/**
 * `/journal/[slug]` — one article.
 *
 * A CMS PAGE, exactly as `/collections/[slug]` and `/portfolio/[slug]` are. The body is an ordered
 * block list on the `pages` row `journal_articles.page_id` names, rendered by the same
 * `renderCmsPage` that serves `/about`. This route contributes three things the CMS cannot: the
 * structured data, the related strip, and the fact that the path exists.
 *
 * IT 404s FOR EVERY SLUG TODAY, and that is the phase's exit criterion rather than a gap. Ten
 * articles exist as ideas — a title and an angle — and all ten are DRAFT, because SEED §20 says in
 * capitals not to publish them automatically. An article becomes readable when somebody writes it
 * and publishes it, which is a Studio act.
 *
 * ONE GATE, AND IT IS THE PAGE'S. `renderCmsPage` answers an unpublished page, or one with no live
 * sections, with a 404. The article row's own rules — `published_at <= now()` in the RLS policy, and
 * `enforce_article_has_body` refusing a publish with nothing written — mean the two cannot disagree
 * in the dangerous direction: a page cannot be live for an article that is not.
 *
 * THE PATH IS DERIVED, NOT STORED TWICE. `sync_article_page_path` (`0160`) writes
 * `'/journal/' || lower(slug)` onto the page whenever the slug or the link changes.
 *
 * NO `opengraph-image.tsx` BESIDE THIS FILE, for the reason `/collections/[slug]` records at
 * length: file-based metadata takes precedence over the `metadata` export, so it would silently
 * override the social image an editor chose in Studio.
 */

type Params = { readonly slug: string }
type Props = { readonly params: Promise<Params> }

const pathFor = (slug: string) => `/journal/${slug.toLowerCase()}`

/** Published articles only — the anonymous client is the filter, as everywhere else. */
export async function generateStaticParams(): Promise<Params[]> {
  return prerenderParams('/journal/[slug]', async () => {
    // A ceiling rather than a promise: pre-rendering the most recent hundred is generous for a
    // studio journal, and anything beyond it renders on demand rather than at build time.
    const articles = await listArticles(createPublicClient(), { limit: 100 })
    return articles.map((article) => ({ slug: article.slug.toLowerCase() }))
  })
}

async function articleFor(slug: string): Promise<JournalArticle | null> {
  return getArticleBySlug(createPublicClient(), slug).catch(() => null)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await articleFor(slug)
  return cmsPageMetadata(pathFor(slug), {
    // The ENTITY rung (a `seo_entries` ENTITY row, read inside) with the cover as the social
    // image; the article page's own blocks are the DERIVED rung.
    ...(article === null
      ? {}
      : {
          entity: {
            type: 'journal_articles',
            id: article.id,
            description: article.excerpt,
            ogMediaId: article.cover_media_id,
          },
        }),
  })
}

export default async function JournalArticlePage({ params }: Props): Promise<React.ReactElement> {
  const { slug } = await params
  const path = pathFor(slug)

  const article = await articleFor(slug)
  const graph = article === null ? null : await jsonLdFor(article, path)

  return (
    <>
      <JsonLd graph={graph} />
      {await renderCmsPage(path)}
      {article === null ? null : <ArticleRelated article={article} />}
    </>
  )
}

/** The `Article` node, or null when there is nothing true to put in one. */
async function jsonLdFor(article: JournalArticle, path: string) {
  const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')?.trim() ?? ''
  // A relative `url` in structured data is not a URL. With no origin configured there is nothing
  // valid to emit, which is the honest answer in development rather than a half-formed graph.
  if (origin === null) return null

  const chrome = await getSiteChrome()
  const organisationName =
    siteString(chrome.strings, 'BRAND.brand.name') ??
    siteString(chrome.strings, 'SEO_DEFAULT.site_name') ??
    ''

  const client = createPublicClient()
  const [assets, categories] = await Promise.all([
    article.cover_media_id === null
      ? Promise.resolve(new Map())
      : listMediaAssetsByIds(client, [article.cover_media_id]),
    listCategories(client),
  ])

  const asset =
    article.cover_media_id === null ? null : (assets.get(article.cover_media_id) ?? null)
  const category =
    article.primary_category_id === null
      ? null
      : (categories.find((entry) => entry.id === article.primary_category_id) ?? null)

  const node = articleJsonLd(article, {
    url: new URL(path, origin).toString(),
    organisationName,
    imageUrl:
      asset === null || cloudName === ''
        ? null
        : imageUrl(cloudName, mediaRefOf(asset), resolveSpec('og')),
    categoryName: category?.name ?? null,
  })
  // Home → the journal listing (only while it is live) → this article.
  const trail = await entityBreadcrumbs({
    listingPath: '/journal',
    entityName: article.title,
    entityPath: path,
  })
  return graphOf([node, trail])
}
