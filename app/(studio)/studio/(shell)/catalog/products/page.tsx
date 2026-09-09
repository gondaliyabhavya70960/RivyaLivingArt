import type { Route } from 'next'
import Link from 'next/link'

import { Cluster } from '@/components/primitives/Cluster'
import { Text } from '@/components/primitives/Text'
import { DataTable } from '@/components/studio/DataTable'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { DemoPill, StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { unmetForPublish, readinessChecklist } from '@/lib/catalog/validation'
import {
  joinCountsForProducts,
  listCategoriesForStudio,
  listProductsForStudio,
} from '@/lib/supabase/repositories/catalog-admin'
import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/lib/supabase/schemas'

import { productDraft } from '../product-values'

/**
 * /studio/catalog/products — every product, with what is still missing.
 *
 * THE "NOT READY" COLUMN IS THE POINT OF THIS SCREEN. A status alone tells an owner that something
 * is a draft; it does not tell them why it is still a draft. The column lists the unmet REQUIRED
 * items by name, so the work outstanding across the whole catalogue is visible without opening
 * anything — which is what FEAT §22 is asking for, one level up from the product form.
 *
 * IT IS COMPUTED FROM THE ROW, NOT READ FROM `publication_readiness`. That column is a cache
 * written on save; a row edited by any other route would carry a stale snapshot, and a list that
 * quietly lies about what is missing is worse than one that costs a few microseconds per row.
 *
 * WHICH IS WHY IT LOADS THE JOIN COUNTS. Computing from the row is only honest if the row is the
 * whole story, and two of the ten readiness items — Materials and Gallery — live in join tables.
 * Calling `readinessChecklist(draft)` with no context made both of them read as unmet on EVERY
 * product, so a fully-finished piece was listed as missing its materials and its gallery: the
 * exact lie the paragraph above refuses, arrived at from the other direction. `joinCountsForProducts`
 * reads both joins for the whole page in one round trip each.
 *
 * READS THROUGH THE REQUEST-SCOPED CLIENT, so the list is exactly what this role may see.
 */
export const metadata = studioMetadata('/studio/catalog/products')

/**
 * The search box's term, from a query string that may not contain what the type says.
 *
 * `?q=a&q=b` HANDS NEXT AN ARRAY, and this page used to be typed `{ q?: string }` and read it
 * straight. The type is a claim about the URL, not a guarantee from it: two `q` parameters made
 * `filter.search.trim()` a call on an array, and the Studio's product list answered 500. A visitor
 * cannot reach this page, but an editor with two tabs and a stale form can produce the URL, and a
 * server error is the wrong answer to a duplicated parameter either way.
 *
 * THE LAST ONE WINS, matching how a browser treats a repeated form field. Not comma-split, unlike
 * `values()` in `lib/catalog/query.ts`: that helper serves filters where `?material=oak,resin` is
 * two selections, whereas this is a free-text box and "chair, oak" is one thing to look for.
 */
function searchTerm(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined
  const last = Array.isArray(raw) ? raw[raw.length - 1] : raw
  return last === undefined || last.trim() === '' ? undefined : last
}

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('catalog.read')
  const q = searchTerm((await searchParams).q)

  const client = await createClient()
  const [products, categories] = await Promise.all([
    listProductsForStudio(client, q === undefined ? {} : { search: q }),
    listCategoriesForStudio(client),
  ])

  // Sequenced after the products because it needs their ids; one round trip per join, not per row.
  const joinCounts = await joinCountsForProducts(
    client,
    products.map((product) => product.id),
  )

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
  const canWrite = roleHasPermission(session.role, 'catalog.write')

  return (
    <StudioPage
      path="/studio/catalog/products"
      actions={
        canWrite ? (
          <Link
            href={'/studio/catalog/products/new' as Route}
            className="underline underline-offset-4"
          >
            <Text as="span" size="sm">
              {t('studio.catalog.products.newHeading')}
            </Text>
          </Link>
        ) : undefined
      }
    >
      {/* A plain GET form: searching a list must not need JavaScript any more than filtering the
          public one does. */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label htmlFor="q" className="flex flex-col gap-1">
          <Text as="span" size="sm" tone="secondary">
            {t('studio.catalog.products.searchLabel')}
          </Text>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            className="border-line-strong bg-surface h-11 rounded-sm border px-3"
          />
        </label>
        <button type="submit" className="underline underline-offset-4">
          <Text as="span" size="sm">
            {t('studio.catalog.products.searchSubmit')}
          </Text>
        </button>
      </form>

      <DataTable<Product>
        caption={t('studio.catalog.products.caption')}
        rows={products}
        rowKey={(product) => product.id}
        empty={{
          reason: 'empty',
          heading: t('studio.catalog.products.emptyHeading'),
          body: t('studio.catalog.products.emptyBody'),
        }}
        columns={[
          {
            id: 'title',
            header: t('studio.catalog.products.colTitle'),
            cell: (product) => (
              <Link
                href={`/studio/catalog/products/${product.id}` as Route}
                className="underline underline-offset-4"
              >
                {product.title ?? t('studio.catalog.products.untitled')}
              </Link>
            ),
          },
          {
            id: 'sku',
            header: t('studio.catalog.products.colSku'),
            cell: (product) => product.sku ?? t('studio.catalog.products.noSku'),
          },
          {
            id: 'category',
            header: t('studio.catalog.products.colCategory'),
            cell: (product) =>
              product.category_id === null
                ? t('studio.catalog.products.noCategory')
                : (categoryNames.get(product.category_id) ??
                  t('studio.catalog.products.noCategory')),
          },
          {
            id: 'status',
            header: t('studio.catalog.products.colStatus'),
            cell: (product) => (
              <span className="flex flex-wrap items-center gap-1">
                <StatusPill status={product.status} />
                <DemoPill isDemo={product.is_demo} />
              </span>
            ),
          },
          {
            id: 'readiness',
            header: t('studio.catalog.products.colReadiness'),
            cell: (product) => {
              const unmet = unmetForPublish(
                readinessChecklist(productDraft(product), {
                  materialIds: new Array<string>(joinCounts.materials.get(product.id) ?? 0),
                  galleryMediaIds: new Array<string>(joinCounts.gallery.get(product.id) ?? 0),
                  specCount: joinCounts.specs.get(product.id) ?? 0,
                }),
              )
              return unmet.length === 0 ? (
                <Text as="span" size="sm">
                  {t('studio.catalog.products.readyToPublish')}
                </Text>
              ) : (
                <Cluster gap={2} data-unmet-summary="">
                  {unmet.map((item) => (
                    <Text key={item} as="span" size="sm" tone="secondary">
                      {item}
                    </Text>
                  ))}
                </Cluster>
              )
            },
          },
          {
            id: 'updated',
            header: t('studio.catalog.products.colUpdated'),
            cell: (product) => <RelativeTime value={product.updated_at} />,
          },
        ]}
      />
    </StudioPage>
  )
}
