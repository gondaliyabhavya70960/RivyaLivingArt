import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type * as React from 'react'

import { LazyModelViewerMount } from '@/components/patterns/ModelViewerMount/lazy'
import { Container } from '@/components/primitives/Container'
import { Stack } from '@/components/primitives/Stack'
import {
  CatalogListing,
  type LoadedCatalogListing,
  loadCatalogListing,
} from '@/lib/catalog/listing'
import { optionalEnv } from '@/lib/env'
import { isEnabled } from '@/lib/flags'
import { listMaterials } from '@/lib/supabase/repositories/materials'
import { loadPublicModel } from '@/lib/supabase/repositories/models'
import { canonicalCatalogUrl, catalogUrl } from '@/lib/catalog/query'
import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { createPublicClient } from '@/lib/supabase/public'
import { listCategories } from '@/lib/supabase/repositories/categories'

/**
 * `/collection/[category]` — the seven D3 category listings.
 *
 * THE ONLY DYNAMIC PUBLIC ROUTE THIS PHASE ADDS, and it is declared in `lib/site/routes.ts`
 * alongside the static ones so `tests/unit/site-routes.test.ts` still fails in both directions: a
 * dynamic family that exists on disk and is not declared is as much of a drift as a missing file.
 *
 * TWO GATES, AND BOTH ARE 404s.
 *
 *   The CATEGORY must be visible. `listCategories` returns what RLS admits, which for a visitor is
 *   published rows only, so an unknown slug and an unpublished one are indistinguishable — as they
 *   must be, since telling them apart would leak the existence of a draft category.
 *
 *   The PAGE must have live sections. That is `renderCmsPage`'s rule, unchanged: a published route
 *   with nothing on it reads as "coming soon" and indexes as a real page. The product grid does
 *   not rescue it — a grid under a heading nobody has approved is the same failure wearing a
 *   different hat.
 *
 * `generateStaticParams` LISTS PUBLISHED CATEGORIES ONLY. An unpublished one is not pre-rendered
 * and, because the same visibility rule applies at request time, is not reachable either.
 */

type Params = { readonly category: string }
type Props = {
  readonly params: Promise<Params>
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The one category whose listing mounts its products' models (PHASE-16-22 §Phase 21). */
const MODEL_CATEGORY_SLUG = '3d-resin'

const BASE = '/collection'

export async function generateStaticParams(): Promise<Params[]> {
  const categories = await listCategories(createPublicClient())
  return categories.map((category) => ({ category: category.slug }))
}

/** The category row for this slug, or null. One read, shared by metadata and the render. */
async function categoryFor(slug: string) {
  const categories = await listCategories(createPublicClient())
  return categories.find((category) => category.slug === slug) ?? null
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category: slug } = await params
  const path = `${BASE}/${slug}`

  /*
   * THE LISTING IS LOADED FOR THIS CATEGORY, not for the whole catalogue.
   *
   * `rel="next"` is a claim about how many pages THIS listing has. Computing it without the
   * category filter would promise a page 2 of `/collection/furniture` that holds another
   * category's products — or, worse, promise one at all when furniture fits on a single page.
   */
  const category = await categoryFor(slug)
  const loaded = await loadCatalogListing({
    basePath: path,
    categoryId: category?.id ?? null,
    searchParams: await searchParams,
  })
  const { query, page, pageCount } = loaded

  return cmsPageMetadata(path, {
    canonicalPath: canonicalCatalogUrl(path, query),
    pagination: {
      ...(page > 1 ? { previous: catalogUrl(path, query, { page: page - 1 }) } : {}),
      ...(page < pageCount ? { next: catalogUrl(path, query, { page: page + 1 }) } : {}),
    },
  })
}

export default async function CategoryPage({
  params,
  searchParams,
}: Props): Promise<React.ReactElement> {
  const { category: slug } = await params
  const category = await categoryFor(slug)
  if (category === null) notFound()

  const path = `${BASE}/${slug}`
  const loaded = await loadCatalogListing({
    basePath: path,
    categoryId: category.id,
    searchParams: await searchParams,
  })

  /*
   * A PAGE PAST THE END IS A 404, NOT AN EMPTY LISTING. `?page=99` of a two-page listing is not an
   * address this site has; answering 200 with "this collection is being prepared" would be false,
   * and would mint an indexable page for every number a crawler tries.
   */
  if (loaded.beyondEnd) notFound()

  return renderCmsPage(
    path,
    <>
      <CatalogListing basePath={path} loaded={loaded} />
      {await categoryModels(slug, loaded)}
    </>,
  )
}

/**
 * Phase 21: on `/collection/3d-resin`, every published product on this page of the listing that
 * carries a public model gets its mount below the grid. Only that category — the phase document
 * names it, and a furniture product's model belongs on its own page — and only with the flag on.
 * A product whose model is not public with a poster contributes nothing, so the block is absent
 * rather than empty.
 */
async function categoryModels(
  slug: string,
  loaded: LoadedCatalogListing,
): Promise<React.ReactNode> {
  if (slug !== MODEL_CATEGORY_SLUG) return null
  if (!(await isEnabled('three_d_viewer'))) return null
  const withModels = loaded.listing.rows.filter((row) => row.model_media_id !== null)
  if (withModels.length === 0) return null
  const client = createPublicClient()
  const [entries, materials] = await Promise.all([
    Promise.all(
      withModels.map(async (row) => ({
        row,
        model:
          row.model_media_id === null ? null : await loadPublicModel(client, row.model_media_id),
      })),
    ),
    listMaterials(client),
  ])
  const mounts = entries.flatMap(({ row, model }) => (model === null ? [] : [{ row, model }]))
  if (mounts.length === 0) return null
  const cloudName = optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') ?? ''
  return (
    <Container>
      <Stack gap={10} data-category-models="">
        {mounts.map(({ row, model }) => (
          <LazyModelViewerMount
            key={row.id}
            model={model}
            materials={materials}
            dimensions={row.dimensions}
            title={row.title ?? row.slug}
            strings={loaded.chrome.strings}
            cloudName={cloudName}
            enabled
            ratio="16:9"
            sizes="(min-width: 1024px) 80vw, 100vw"
          />
        ))}
      </Stack>
    </Container>
  )
}
