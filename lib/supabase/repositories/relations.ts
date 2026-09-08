import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { productRelationSchema, type ProductRelation } from '../schemas'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'product relation'

/**
 * Product relationship edges.
 *
 * Phase 23 builds the engine that proposes edges; this is only the storage and the reads. The rule
 * that engine must honour is worth stating where the table is accessed: NO EDGE IS EVER CREATED
 * AUTOMATICALLY WITHOUT A STATED, NAMED RULE, and an editor can always override one. That is why
 * Phase 23 adds `origin` and `rule_key` columns rather than letting a recommendation appear with
 * no account of where it came from.
 */

export async function listRelationsForProduct(
  client: Client,
  sourceProductId: string,
): Promise<ProductRelation[]> {
  const { data, error } = await client
    .from('product_relations')
    .select('*')
    .eq('source_product_id', sourceProductId)
    .order('relation_type', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', sourceProductId, error)
  return parseRows(ENTITY, productRelationSchema, data ?? [])
}

/** Edges pointing AT something — served by `product_relations_target_idx`, which exists precisely
 *  because the unique edge key is ordered source-first and cannot answer this. */
export async function listRelationsToTarget(
  client: Client,
  targetType: string,
  targetId: string,
): Promise<ProductRelation[]> {
  const { data, error } = await client
    .from('product_relations')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('sort_order', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', `${targetType}:${targetId}`, error)
  return parseRows(ENTITY, productRelationSchema, data ?? [])
}
