import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ProductForm } from '@/components/studio/catalog/ProductForm'
import { PublishControls } from '@/components/studio/catalog/PublishControls'
import { ReadinessChecklist } from '@/components/studio/catalog/ReadinessChecklist'
import { PageHeader } from '@/components/studio/PageHeader'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { readinessChecklist } from '@/lib/catalog/validation'
import { NotFoundError } from '@/lib/supabase/errors'
import {
  getProductById,
  listProductMaterialIds,
  listProductMediaIds,
} from '@/lib/supabase/repositories/catalog-admin'
import { createClient } from '@/lib/supabase/server'

import { publishProductAction, saveProductAction, unpublishProductAction } from '../../actions'
import { productDraft, productFormValues } from '../../product-values'
import { productFormOptions } from '../../product-page-data'

/**
 * /studio/catalog/products/[productId] — the product editor.
 *
 * THE CHECKLIST IS COMPUTED FROM THE SAVED ROW, not from the form. It answers "can this be
 * published now?", and the only thing that can be published is what is stored — a checklist
 * tracking unsaved edits would go green before the row it describes did.
 *
 * `catalog.read` GETS IN; `catalog.write` GETS A SUBMIT BUTTON; `catalog.publish` GETS THE PUBLISH
 * CONTROL. The three are separate permissions and are resolved server-side, then passed down as
 * data. The client uses them only to decide which controls to draw — every action re-checks, so a
 * hidden control is a courtesy rather than a boundary.
 */
export const metadata = { title: 'Product — Rivya Studio' }

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const session = await requirePermission('catalog.read')
  const { productId } = await params

  const client = await createClient()

  const product = await getProductById(client, productId).catch((error: unknown) => {
    // A product this role cannot see and one that does not exist are indistinguishable under RLS,
    // and must stay that way: telling them apart would leak the existence of a draft.
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (product === null) notFound()

  const [materialIds, galleryMediaIds, options] = await Promise.all([
    listProductMaterialIds(client, product.id),
    listProductMediaIds(client, product.id),
    productFormOptions(),
  ])

  const checklist = readinessChecklist(productDraft(product), { materialIds, galleryMediaIds })

  return (
    <Stack gap={8}>
      <PageHeader
        level={1}
        title={product.title ?? t('studio.catalog.products.untitled')}
        description={product.slug}
        actions={<StatusPill status={product.status} />}
      />

      <Link href={'/studio/catalog/products' as Route} className="underline underline-offset-4">
        <Text size="sm" as="span">
          {t('studio.catalog.products.caption')}
        </Text>
      </Link>

      <ReadinessChecklist checklist={checklist} />

      <PublishControls
        productId={product.id}
        isPublished={product.status === 'PUBLISHED'}
        publishAction={publishProductAction}
        unpublishAction={unpublishProductAction}
        canPublish={roleHasPermission(session.role, 'catalog.publish')}
      />

      <ProductForm
        values={productFormValues(product, materialIds)}
        categories={options.categories}
        materials={options.materials}
        mediaOptions={options.mediaOptions}
        action={saveProductAction}
        canWrite={roleHasPermission(session.role, 'catalog.write')}
      />
    </Stack>
  )
}
