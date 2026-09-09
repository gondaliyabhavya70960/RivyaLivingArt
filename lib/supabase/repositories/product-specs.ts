import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, TablesInsert, TablesUpdate } from '../database.types'
import { productSpecSchema, type ProductSpec } from '../schemas'
import { NotFoundError, PermissionError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'product-spec'

/**
 * `product_specs` — the rows the specification block renders, and the Studio tab that fills it.
 *
 * READS AND WRITES IN ONE FILE, unlike the catalogue's split between `products.ts` and
 * `catalog-admin.ts`. That split exists because `products` must have no create function sitting
 * beside its public reads — a product appearing from anywhere but an owner's keyboard is the first
 * step toward fabricated inventory. `product_specs` has no such asymmetry: every row here comes
 * from the Studio by construction, there is no seed path and no import, so the create function is
 * not a hazard to keep at arm's length.
 *
 * EVERY FUNCTION TAKES THE REQUEST-SCOPED CLIENT. RLS is what decides whether a caller sees a draft
 * spec row or writes one; passing the service-role client here would quietly bypass the parent-
 * product test in `product_specs_select_public` and publish a measurement of an unpublished piece.
 */

/**
 * The published specification rows for one published product, in the owner's order.
 *
 * NO FILTER ON `status` HERE, because the policy already applies one and applying it twice would
 * suggest the policy is optional. `product_specs_select_public` admits a row only when both it and
 * its parent product are PUBLISHED, so an anonymous caller gets exactly the public set and a staff
 * caller gets everything their role may read — which is what the Studio preview wants.
 */
export async function listProductSpecs(client: Client, productId: string): Promise<ProductSpec[]> {
  const { data, error } = await client
    .from('product_specs')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    // A total order, so two rows sharing a sort_order do not swap places between requests and make
    // a specification table look like it changed when nothing did.
    .order('label', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', productId, error)
  return parseRows(ENTITY, productSpecSchema, data ?? [])
}

export async function getProductSpec(client: Client, id: string): Promise<ProductSpec> {
  const { data, error } = await client.from('product_specs').select('*').eq('id', id).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, productSpecSchema, data)
}

export async function insertProductSpec(
  client: Client,
  values: TablesInsert<'product_specs'>,
): Promise<ProductSpec> {
  const { data, error } = await client.from('product_specs').insert(values).select('*').single()

  if (error) throw toRepositoryError(ENTITY, 'insert', values.label, error)
  return parseRow(ENTITY, productSpecSchema, data)
}

export async function updateProductSpec(
  client: Client,
  id: string,
  values: TablesUpdate<'product_specs'>,
): Promise<ProductSpec> {
  const { data, error } = await client
    .from('product_specs')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
  return parseRow(ENTITY, productSpecSchema, data)
}

/**
 * Deleting a spec row needs `destructive.execute`, which is owner and admin only.
 *
 * RLS FILTERS A DELETE RATHER THAN REFUSING ONE, so a merchandiser's delete would remove nothing
 * and report success — the same trap `setProductMaterials` fell into. The row is read back and its
 * survival raises rather than passing silently.
 */
export async function deleteProductSpec(client: Client, id: string): Promise<void> {
  const { error } = await client.from('product_specs').delete().eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'delete', id, error)

  const { data, error: readError } = await client
    .from('product_specs')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (readError) throw toRepositoryError(ENTITY, 'delete', id, readError)
  if (data !== null) throw new PermissionError('delete', ENTITY)
}
