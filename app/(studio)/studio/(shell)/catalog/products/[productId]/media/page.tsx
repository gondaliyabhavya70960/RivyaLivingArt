import { notFound } from 'next/navigation'

import { ProductMediaTab } from '@/components/studio/catalog/ProductMediaTab'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { NotFoundError } from '@/lib/supabase/errors'
import { getProductById } from '@/lib/supabase/repositories/catalog-admin'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import {
  PRODUCT_MEDIA_ROLES,
  listProductMediaEdgesForStudio,
} from '@/lib/supabase/repositories/product-edges'
import { createClient } from '@/lib/supabase/server'

import { detachProductMediaAction, saveProductMediaAction } from '../tab-actions'

export const metadata = { title: 'Product media — Rivya Studio' }

/**
 * The Media tab's data.
 *
 * THE ATTACHABLE LIST IS FILTERED HERE, ON THE SERVER, and concept renders never reach the browser
 * as an option. That is one of three copies of the same rule and all three are wanted: this picker
 * so an editor is never offered a choice that will be refused, `validation.ts` so the Server Action
 * refuses it without a round trip to the database, and `product_media_reject_concept` so a request
 * that skipped both is still refused. The picker is the courteous copy; the trigger is the real one.
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

  const [edges, assets] = await Promise.all([
    listProductMediaEdgesForStudio(client, product.id),
    listMediaAssets(client, { limit: 200 }),
  ])

  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  const attachedIds = new Set(edges.map((edge) => edge.mediaAssetId))

  /** An asset's own words where it has them, its public id where it does not. Never a bare uuid. */
  const label = (id: string): string => {
    const asset = byId.get(id)
    if (asset === undefined) return id
    return asset.title ?? asset.filename ?? asset.public_id
  }

  return (
    <ProductMediaTab
      productId={product.id}
      edges={edges.map((edge) => ({
        mediaAssetId: edge.mediaAssetId,
        label: label(edge.mediaAssetId),
        role: edge.role,
        sortOrder: edge.sortOrder,
      }))}
      attachable={assets
        .filter((asset) => !asset.is_concept && !attachedIds.has(asset.id))
        .map((asset) => ({ id: asset.id, label: label(asset.id) }))}
      roles={PRODUCT_MEDIA_ROLES}
      canWrite={roleHasPermission(session.role, 'catalog.write')}
      saveAction={saveProductMediaAction}
      detachAction={detachProductMediaAction}
    />
  )
}
