import type { Metadata } from 'next'
import * as React from 'react'

import { mediaRefOf } from '@/lib/cms/media'
import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { resolveSpec } from '@/lib/media/transform'
import { imageUrl } from '@/lib/media/url'
import { articleJsonLd } from '@/lib/seo/article-jsonld'
import { serialiseJsonLd } from '@/lib/seo/jsonld'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { getArticleBySlug, listArticles, listCategories } from '@/lib/supabase/repositories/journal'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'
import type { JournalArticle } from '@/lib/supabase/schemas'

import { ArticleRelated } from './related'

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

/**
 * PostgREST's codes for a relation that is not there, matched for the same reason
 * `/portfolio/[slug]` matches them: `generateStaticParams` runs at BUILD time, and a build against
 * an environment whose schema cache has not caught up with a migration would otherwise fail the
 * whole site's build rather than this one route. Seen once already, on Vercel, in Phase 17.
 */
function isMissingTable(error: unknown): boolean {
  const code = (error as { cause?: { code?: string } } | null)?.cause?.code
  return code === '42P01' || code === 'PGRST205'
}

/** Published articles only — the anonymous client is the filter, as everywhere else. */
export async function generateStaticParams(): Promise<Params[]> {
  try {
    // A ceiling rather than a promise: pre-rendering the most recent hundred is generous for a
    // studio journal, and anything beyond it renders on demand rather than at build time.
    const articles = await listArticles(createPublicClient(), { limit: 100 })
    return articles.map((article) => ({ slug: article.slug.toLowerCase() }))
  } catch (error) {
    if (isMissingTable(error)) return []
    throw error
  }
}

async function articleFor(slug: string): Promise<JournalArticle | null> {
  return getArticleBySlug(createPublicClient(), slug).catch(() => null)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return cmsPageMetadata(pathFor(slug))
}

export default async function JournalArticlePage({ params }: Props): Promise<React.ReactElement> {
  const { slug } = await params
  const path = pathFor(slug)

  const article = await articleFor(slug)
  const graph = article === null ? null : await jsonLdFor(article, path)

  return (
    <>
      {graph === null ? null : (
        <script
          type="application/ld+json"
          // The value is escaped by `serialiseJsonLd`; `<` cannot close the element.
          dangerouslySetInnerHTML={{ __html: serialiseJsonLd(graph) }}
        />
      )}
      {await renderCmsPage(path)}
      {article === null ? null : <ArticleRelated article={article} />}
    </>
  )
}

/** The `Article` node, or null when there is nothing true to put in one. */
async function jsonLdFor(article: JournalArticle, path: string) {
  const origin = optionalEnv('NEXT_PUBLIC_SITE_URL')?.trim() ?? ''
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')?.trim() ?? ''
  // A relative `url` in structured data is not a URL. With no origin configured there is nothing
  // valid to emit, which is the honest answer in development rather than a half-formed graph.
  if (origin === '') return null

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

  return articleJsonLd(article, {
    url: new URL(path, origin).toString(),
    organisationName,
    imageUrl:
      asset === null || cloudName === ''
        ? null
        : imageUrl(cloudName, mediaRefOf(asset), resolveSpec('og')),
    categoryName: category?.name ?? null,
  })
}
