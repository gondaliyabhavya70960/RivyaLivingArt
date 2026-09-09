import { notFound } from 'next/navigation'

import { ProductSpecsTab } from '@/components/studio/catalog/ProductSpecsTab'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { dimensionEntries } from '@/lib/catalog/dimensions'
import { NotFoundError } from '@/lib/supabase/errors'
import { getProductById } from '@/lib/supabase/repositories/catalog-admin'
import { listProductSpecs } from '@/lib/supabase/repositories/product-specs'
import { createClient } from '@/lib/supabase/server'

import {
  deleteProductSpecAction,
  saveProductSpecAction,
  setSpecificationsOmittedAction,
} from '../tab-actions'

export const metadata = { title: 'Product specifications — Rivya Studio' }

/**
 * The Specifications tab's data.
 *
 * THE DIMENSIONS PANEL IS READ-ONLY AND SHOWS ONLY NON-NULL KEYS, which is the same rule the public
 * block follows: an absent measurement produces no line, here as there. Showing every possible key
 * with the empty ones greyed would teach an editor that the block has a fixed shape with gaps in
 * it, which is exactly the impression the no-placeholder rule exists to prevent.
 */
export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const session = await requirePermission('catalog.read')
  const { productId } = await params

  const client = await createClient()
  const product = await getProductById(client, productId).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (product === null) notFound()

  const specs = await listProductSpecs(client, product.id)

  return (
    <ProductSpecsTab
      productId={product.id}
      specs={specs.map((spec) => ({
        id: spec.id,
        label: spec.label,
        value: spec.value,
        unit: spec.unit,
        groupLabel: spec.group_label,
        sortOrder: spec.sort_order,
      }))}
      dimensions={dimensionEntries(product.dimensions).map((entry) => ({
        key: entry.key,
        value: String(entry.value),
      }))}
      specificationsOmitted={product.specifications_omitted}
      canWrite={roleHasPermission(session.role, 'catalog.write')}
      saveAction={saveProductSpecAction}
      deleteAction={deleteProductSpecAction}
      omitAction={setSpecificationsOmittedAction}
    />
  )
}
