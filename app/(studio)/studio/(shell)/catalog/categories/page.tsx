import type { Route } from 'next'
import Link from 'next/link'

import { DataTable } from '@/components/studio/DataTable'
import { StatusPill } from '@/components/studio/StatusPill'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { listCategoriesForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/lib/supabase/schemas'

/**
 * /studio/catalog/categories — the seven, in the order they are presented.
 *
 * NO CREATE, NO DELETE, DELIBERATELY. The seven are D3's taxonomy and the site's route map:
 * `/collection/[category]` pre-renders exactly these slugs, the mega menu lists them, and
 * `content/seed/taxonomy.ts` owns them. An eighth typed in here would have a page nobody designed
 * and copy nobody wrote; removing one would break a published URL. What an owner legitimately
 * changes — the wording, the order, the hero image, the SEO fields — is what the editor accepts.
 */
export const metadata = studioMetadata('/studio/catalog/categories')

export default async function Page() {
  await requirePermission('catalog.read')
  const categories = await listCategoriesForStudio(await createClient())

  return (
    <StudioPage path="/studio/catalog/categories">
      <DataTable<Category>
        caption={t('studio.catalog.categories.caption')}
        rows={categories}
        rowKey={(category) => category.id}
        empty={{
          reason: 'empty',
          heading: t('studio.catalog.categories.emptyHeading'),
          body: t('studio.catalog.categories.emptyBody'),
        }}
        columns={[
          {
            id: 'name',
            header: t('studio.catalog.categories.colName'),
            cell: (category) => (
              <Link
                href={`/studio/catalog/categories/${category.id}` as Route}
                className="underline underline-offset-4"
              >
                {category.name}
              </Link>
            ),
          },
          {
            id: 'slug',
            header: t('studio.catalog.categories.colSlug'),
            cell: (category) => `/collection/${category.slug}`,
          },
          {
            id: 'order',
            header: t('studio.catalog.categories.colOrder'),
            numeric: true,
            cell: (category) => category.sort_order,
          },
          {
            id: 'status',
            header: t('studio.catalog.categories.colStatus'),
            cell: (category) => <StatusPill status={category.status} />,
          },
        ]}
      />
    </StudioPage>
  )
}
