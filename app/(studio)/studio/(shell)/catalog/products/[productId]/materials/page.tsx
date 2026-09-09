import { notFound } from 'next/navigation'

import { ProductMaterialsTab } from '@/components/studio/catalog/ProductMaterialsTab'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { NotFoundError } from '@/lib/supabase/errors'
import { getProductById, listMaterialsForStudio } from '@/lib/supabase/repositories/catalog-admin'
import { listProductMaterialLinks } from '@/lib/supabase/repositories/product-edges'
import { createClient } from '@/lib/supabase/server'

import { detachProductMaterialAction, saveProductMaterialAction } from '../tab-actions'

export const metadata = { title: 'Product materials — Rivya Studio' }

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const session = await requirePermission('catalog.read')
  const { productId } = await params

  const client = await createClient()
  const product = await getProductById(client, productId).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null
    throw error
  })
  if (product === null) notFound()

  const [links, materials] = await Promise.all([
    listProductMaterialLinks(client, product.id),
    listMaterialsForStudio(client),
  ])

  const byId = new Map(materials.map((material) => [material.id, material]))
  const attachedIds = new Set(links.map((link) => link.materialId))

  return (
    <ProductMaterialsTab
      productId={product.id}
      links={links.map((link) => ({
        materialId: link.materialId,
        label: byId.get(link.materialId)?.name ?? link.materialId,
        note: link.note,
      }))}
      attachable={materials
        .filter((material) => !attachedIds.has(material.id))
        .map((material) => ({ id: material.id, label: material.name }))}
      canWrite={roleHasPermission(session.role, 'catalog.write')}
      saveAction={saveProductMaterialAction}
      detachAction={detachProductMaterialAction}
    />
  )
}
