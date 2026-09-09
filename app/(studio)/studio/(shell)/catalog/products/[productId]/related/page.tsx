import { notFound } from 'next/navigation'

import { ProductRelatedTab } from '@/components/studio/catalog/ProductRelatedTab'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { NotFoundError } from '@/lib/supabase/errors'
import { getProductById, listProductsForStudio } from '@/lib/supabase/repositories/catalog-admin'
import {
  RELATION_TARGET,
  RELATION_TARGET_TYPES,
  RELATION_TYPES,
  listProductRelations,
} from '@/lib/supabase/repositories/product-edges'
import { createClient } from '@/lib/supabase/server'

import { createProductRelationAction, deleteProductRelationAction } from '../tab-actions'

export const metadata = { title: 'Product relations — Rivya Studio' }

/**
 * The Related tab's data.
 *
 * ONLY PRODUCT TARGETS GET A LABEL, and the rest show their id. Resolving a portfolio project or a
 * journal article would mean reading tables Phase 17 and Phase 18 build — so an edge to one is
 * listed honestly as an id rather than given a made-up name, and gains its title when the phase
 * that owns the table lands.
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

  const [relations, products] = await Promise.all([
    listProductRelations(client, product.id),
    listProductsForStudio(client),
  ])

  const productTitles = new Map(products.map((row) => [row.id, row.title ?? row.slug]))

  return (
    <ProductRelatedTab
      productId={product.id}
      relations={relations.map((relation) => ({
        id: relation.id,
        targetType: relation.target_type,
        targetId: relation.target_id,
        targetLabel:
          relation.target_type === RELATION_TARGET.product
            ? (productTitles.get(relation.target_id) ?? null)
            : null,
        relationType: relation.relation_type,
        sortOrder: relation.sort_order,
      }))}
      targetTypes={RELATION_TARGET_TYPES}
      relationTypes={RELATION_TYPES}
      canWrite={roleHasPermission(session.role, 'catalog.write')}
      createAction={createProductRelationAction}
      deleteAction={deleteProductRelationAction}
    />
  )
}
