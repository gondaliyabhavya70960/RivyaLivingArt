import 'server-only'

import type { ProductFormOption } from '@/components/studio/catalog/ProductForm'
import {
  listCategoriesForStudio,
  listMaterialsForStudio,
} from '@/lib/supabase/repositories/catalog-admin'
import { listMediaAssets } from '@/lib/supabase/repositories/media'
import { createClient } from '@/lib/supabase/server'

/**
 * The three option lists both product pages need.
 *
 * THE MEDIA LIST EXCLUDES CONCEPT ASSETS BEFORE THE FORM SEES THEM. `reject_concept_product_media`
 * refuses a concept render at the database and `validateProduct` refuses it at the boundary, but
 * offering it in the picker and then refusing it is an interface that invites a mistake and then
 * blames the person who made it. The honest arrangement is that the option is never there — and
 * the two guards behind it remain, for the request that did not come from this form.
 */
export async function productFormOptions(): Promise<{
  categories: ProductFormOption[]
  materials: ProductFormOption[]
  mediaOptions: ProductFormOption[]
}> {
  const client = await createClient()
  const [categories, materials, media] = await Promise.all([
    listCategoriesForStudio(client),
    listMaterialsForStudio(client),
    listMediaAssets(client, { kind: 'IMAGE', limit: 500 }),
  ])

  return {
    categories: categories.map((category) => ({ value: category.id, label: category.name })),
    materials: materials.map((material) => ({ value: material.id, label: material.name })),
    mediaOptions: media
      .filter((asset) => !asset.is_concept)
      .map((asset) => ({ value: asset.id, label: asset.title ?? asset.public_id })),
  }
}
