import { notFound } from 'next/navigation'

import { Stack } from '@/components/primitives/Stack'
import { ProductForm } from '@/components/studio/catalog/ProductForm'
import { PublishControls } from '@/components/studio/catalog/PublishControls'
import { ReadinessChecklist } from '@/components/studio/catalog/ReadinessChecklist'
import { EntitySeoPanel } from '@/components/studio/seo/EntitySeoPanel'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { readinessChecklist } from '@/lib/catalog/validation'
import { NotFoundError } from '@/lib/supabase/errors'
import {
  getProductById,
  listProductMaterialIds,
  listProductMediaIds,
} from '@/lib/supabase/repositories/catalog-admin'
import { countProductSpecs } from '@/lib/supabase/repositories/product-specs'
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

  const [materialIds, galleryMediaIds, specCount, options] = await Promise.all([
    listProductMaterialIds(client, product.id),
    listProductMediaIds(client, product.id),
    countProductSpecs(client, product.id),
    productFormOptions(),
  ])

  const checklist = readinessChecklist(productDraft(product), {
    materialIds,
    galleryMediaIds,
    specCount,
  })

  // The title, the status pill and the section strip belong to `layout.tsx`, which every tab
  // shares. What is left here is the overview itself.
  return (
    <Stack gap={8}>
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

      {/* Phase 39: the ENTITY-scope SEO row, beside the form rather than inside it. */}
      <EntitySeoPanel
        entityType="products"
        entityId={product.id}
        entityPath={`/product/${product.slug.toLowerCase()}`}
        name={product.title}
        summary={product.summary}
        ownTitle={product.seo_title}
        ownDescription={product.seo_description}
        role={session.role}
      />
    </Stack>
  )
}
