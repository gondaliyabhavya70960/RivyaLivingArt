import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type * as React from 'react'

import { MerchandisedRow } from '@/components/patterns/MerchandisedRow'
import { CatalogListing, loadCatalogListing } from '@/lib/catalog/listing'
import { canonicalCatalogUrl, catalogUrl } from '@/lib/catalog/query'
import { optionalEnv } from '@/lib/env'
import { resolveSlot } from '@/lib/cms/merchandising'
import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { siteString } from '@/lib/cms/strings'
import { createPublicClient } from '@/lib/supabase/public'
import { listCategories } from '@/lib/supabase/repositories/categories'
import { listMediaAssetsByIds } from '@/lib/supabase/repositories/media'

/**
 * /collection — the catalogue landing.
 *
 * ONE FILE PER D3 PATH, deliberately, rather than a catch-all segment: the route map lives in the
 * file system where D3 says it does, and `tests/unit/site-routes.test.ts` asserts the set of files
 * here equals the set of declared paths exactly — no missing route, no undeclared one.
 *
 * PHASE 14 ADDS THE GRID BENEATH THE SEEDED SECTIONS. The two sections stay what they were — a
 * hero and the category grid, both editable — and the listing appends the whole catalogue under
 * them, unfiltered by category. With zero products that is SEED §27's empty state, which is the
 * correct thing for an empty catalogue to say and the reason no placeholder card exists.
 *
 * A CARD HERE NAMES ITS CATEGORY, because a listing spanning seven categories is otherwise seven
 * unlabelled grids in a row. The category pages pass no map: repeating "Furniture" under every
 * card on `/collection/furniture` is noise.
 *
 * PHASE 22 ADDS THE FEATURED ROW ABOVE THE GRID. `STORE_FEATURED_ROW` is curated in Studio →
 * Merchandising → Featured; its fallback is HIDE_SECTION, so with fewer than three entries the row
 * is simply absent and the page is what Phase 14 shipped. Its heading is a `global_content` string.
 */
const PATH = '/collection'

/** The slot this route reads. One, and the register names it for this surface. */
const FEATURED_SLOT = 'STORE_FEATURED_ROW'
const FEATURED_HEADING_KEY = 'UI_LABEL.merchandising.store_featured'

export async function generateMetadata({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { query, page, pageCount } = await loadCatalogListing({
    basePath: PATH,
    searchParams: await searchParams,
  })

  return cmsPageMetadata(PATH, {
    canonicalPath: canonicalCatalogUrl(PATH, query),
    pagination: {
      ...(page > 1 ? { previous: catalogUrl(PATH, query, { page: page - 1 }) } : {}),
      ...(page < pageCount ? { next: catalogUrl(PATH, query, { page: page + 1 }) } : {}),
    },
  })
}

export default async function CollectionPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.ReactElement> {
  const client = createPublicClient()
  const [loaded, categories, featured] = await Promise.all([
    loadCatalogListing({ basePath: PATH, searchParams: await searchParams }),
    listCategories(client),
    resolveSlot(client, FEATURED_SLOT),
  ])
  const featuredAssets = await listMediaAssetsByIds(
    client,
    featured.cards.map((card) => card.mediaId).filter((id): id is string => id !== null),
  )

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))

  /*
   * A PAGE PAST THE END IS A 404, NOT AN EMPTY LISTING. `?page=99` of a two-page listing is not an
   * address this site has; answering 200 with "this collection is being prepared" would be false,
   * and would mint an indexable page for every number a crawler tries.
   */
  if (loaded.beyondEnd) notFound()

  return renderCmsPage(
    PATH,
    <>
      <MerchandisedRow
        resolved={featured}
        assets={featuredAssets}
        heading={siteString(loaded.chrome.strings, FEATURED_HEADING_KEY)}
        marker="data-collection-card"
        ratio="4:5"
        strings={loaded.chrome.strings}
        cloudName={optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') ?? ''}
      />
      <CatalogListing basePath={PATH} loaded={loaded} categoryNames={categoryNames} />
    </>,
  )
}
