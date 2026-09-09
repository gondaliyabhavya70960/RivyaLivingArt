import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { EntityForm } from '@/components/studio/catalog/EntityForm'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { NotFoundError } from '@/lib/supabase/errors'
import { getCategoryByIdForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { createClient } from '@/lib/supabase/server'

import { saveCategoryAction } from '../../actions'

/**
 * /studio/catalog/categories/[categoryId] — the copy, order, hero image and SEO of one category.
 *
 * THE HERO PICKER EXCLUDES CONCEPT ASSETS, unlike the database, which permits one here. A category
 * is a THEME rather than an object — `reject_concept_product_media` guards products alone, and D6
 * allows a concept render to illustrate a material or an idea. The picker still leaves them out
 * because three of these seven have no bound asset at all (Phase 09 recorded the gaps), and the
 * quickest way to fill a gap dishonestly would be to reach for a render of a piece that does not
 * exist. An owner who genuinely wants one can bind it through the media surface, deliberately.
 */
export const metadata = { title: 'Category — Rivya Studio' }

export default async function Page({ params }: { params: Promise<{ categoryId: string }> }) {
  const session = await requirePermission('catalog.read')
  const { categoryId } = await params

  const client = await createClient()
  const category = await getCategoryByIdForStudio(client, categoryId).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (category === null) notFound()

  const media = await listMediaAssets(client, { kind: 'IMAGE', limit: 500 })
  const mediaOptions = [
    { value: '', label: t('studio.catalog.product.none') },
    ...media
      .filter((asset) => !asset.is_concept)
      .map((asset) => ({ value: asset.id, label: asset.title ?? asset.public_id })),
  ]

  return (
    <Stack gap={6}>
      <PageHeader
        level={1}
        title={category.name}
        description={`/collection/${category.slug}`}
        actions={<StatusPill status={category.status} />}
      />
      <Link href={'/studio/catalog/categories' as Route} className="underline underline-offset-4">
        <Text size="sm" as="span">
          {t('studio.catalog.categories.caption')}
        </Text>
      </Link>

      <EntityForm
        id={category.id}
        action={saveCategoryAction}
        submitLabelKey="studio.catalog.product.save"
        canWrite={roleHasPermission(session.role, 'catalog.write')}
        fields={[
          {
            name: 'name',
            labelKey: 'studio.catalog.category.name',
            required: true,
            defaultValue: category.name,
          },
          {
            name: 'subtitle',
            labelKey: 'studio.catalog.category.subtitle',
            defaultValue: category.subtitle ?? '',
          },
          {
            name: 'description',
            labelKey: 'studio.catalog.category.description',
            kind: 'textarea',
            rows: 6,
            defaultValue: category.description ?? '',
          },
          {
            name: 'sort_order',
            labelKey: 'studio.catalog.category.sortOrder',
            required: true,
            defaultValue: String(category.sort_order),
          },
          {
            name: 'hero_media_id',
            labelKey: 'studio.catalog.category.heroMedia',
            kind: 'select',
            options: mediaOptions,
            defaultValue: category.hero_media_id ?? '',
          },
          {
            name: 'seo_title',
            labelKey: 'studio.catalog.product.seoTitle',
            defaultValue: category.seo_title ?? '',
          },
          {
            name: 'seo_description',
            labelKey: 'studio.catalog.product.seoDescription',
            kind: 'textarea',
            rows: 3,
            defaultValue: category.seo_description ?? '',
          },
        ]}
      />
    </Stack>
  )
}
