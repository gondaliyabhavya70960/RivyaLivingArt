import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { PermissionError } from '../errors'
import { entityRelationSchema, type EntityRelation } from '../schemas'
import { parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>
type RelationEntity = Database['public']['Enums']['relation_entity']
type RelationKind = Database['public']['Enums']['relation_kind']

const ENTITY = 'entity relation'

/**
 * `entity_relations` — the general edge, and the ONLY module that writes it.
 *
 * NOT `relations.ts`. That file already exists and belongs to `product_relations`, which is a
 * different table with a different shape: its source is always a product, so it can carry a real
 * parent clause in RLS. This one's source is polymorphic. Two relation tables, two repositories,
 * and the phase document says so explicitly — "Phase 03 created product_relations; Phase 16 adds
 * entity_relations".
 *
 * EVERY WRITE TAKES AN `actor` AND IT IS NOT OPTIONAL. FEAT §11: no edge is ever created
 * automatically without a stated, named rule, and an editor can always override one. The only way
 * that stays true as Phase 23's suggestion engine arrives is if the type system refuses an edge
 * with nobody's name on it — so `actorId` is a required parameter rather than a field on an options
 * object that a caller can leave out. `tests/unit/rls/phase16.test.ts` asserts zero rows with a
 * null `created_by`.
 *
 * READS DO NOT RESOLVE THEIR TARGETS. An edge is a type name and a uuid; turning that into a
 * product or an article means querying that table, under that table's own policies, which is what
 * makes an unpublished target yield nothing without this file testing a status. Resolution belongs
 * to the caller that knows which shape it wants back.
 */

export interface RelationEdge {
  readonly sourceType: RelationEntity
  readonly sourceId: string
  readonly targetType: RelationEntity
  readonly targetId: string
  readonly relationType: RelationKind
  readonly note: string | null
  readonly sortOrder: number
}

/** Every edge out of one entity, in the editor's order. */
export async function getRelations(
  client: Client,
  sourceType: RelationEntity,
  sourceId: string,
): Promise<EntityRelation[]> {
  const { data, error } = await client
    .from('entity_relations')
    .select('*')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .order('relation_type', { ascending: true })
    .order('sort_order', { ascending: true })
    // A total order, so two edges sharing a sort_order do not swap between requests and make a
    // related band look like it reshuffled itself while nobody edited it.
    .order('id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', `${sourceType}:${sourceId}`, error)
  return parseRows(ENTITY, entityRelationSchema, data ?? [])
}

/**
 * Replace one entity's outgoing edges with exactly this set.
 *
 * A VERIFIED DIFF, for the same reason every other join write in this repository is one: RLS
 * FILTERS A DELETE, IT DOES NOT REFUSE ONE. `entity_relations` carries
 * `deletePermission: 'destructive.execute'`, so its DELETE policy admits owner and admin while its
 * INSERT policy also admits merchandiser. A merchandiser's blanket delete matches zero rows,
 * returns no error, and the insert that follows then ADDS to the set that was meant to be replaced.
 * The editor is told it saved. The edge is still there.
 *
 * So: work out what actually changed, delete only that, and READ BACK. A removal that did not
 * happen raises PermissionError rather than reporting success. A merchandiser who only adds never
 * issues a destructive statement at all.
 */
export async function setRelations(
  client: Client,
  sourceType: RelationEntity,
  sourceId: string,
  edges: readonly RelationEdge[],
  actorId: string,
): Promise<void> {
  const key = (e: { targetType: RelationEntity; targetId: string; relationType: RelationKind }) =>
    `${e.targetType}:${e.targetId}:${e.relationType}`

  const wanted = new Map(edges.map((edge) => [key(edge), edge]))
  const current = await getRelations(client, sourceType, sourceId)
  const currentByKey = new Map(
    current.map((row) => [
      key({
        targetType: row.target_type,
        targetId: row.target_id,
        relationType: row.relation_type,
      }),
      row,
    ]),
  )

  const removed = [...currentByKey.entries()].filter(([k]) => !wanted.has(k)).map(([, row]) => row)
  if (removed.length > 0) {
    const { error } = await client
      .from('entity_relations')
      .delete()
      .in(
        'id',
        removed.map((row) => row.id),
      )
    if (error) throw toRepositoryError(ENTITY, 'set', `${sourceType}:${sourceId}`, error)

    const survivors = new Set((await getRelations(client, sourceType, sourceId)).map((r) => r.id))
    if (removed.some((row) => survivors.has(row.id))) {
      throw new PermissionError('set-relations', ENTITY)
    }
  }

  const added = [...wanted.entries()].filter(([k]) => !currentByKey.has(k)).map(([, edge]) => edge)
  if (added.length > 0) {
    const { error } = await client.from('entity_relations').insert(
      added.map((edge) => ({
        source_type: sourceType,
        source_id: sourceId,
        target_type: edge.targetType,
        target_id: edge.targetId,
        relation_type: edge.relationType,
        note: edge.note,
        sort_order: edge.sortOrder,
        // Required, never defaulted. See the header: an edge with nobody's name on it is exactly
        // what FEAT §11 forbids, and a null here means a machine made a connection.
        created_by: actorId,
      })),
    )
    if (error) throw toRepositoryError(ENTITY, 'set', `${sourceType}:${sourceId}`, error)
  }

  // A note or an order that changed on an edge that already exists. An UPDATE rather than a
  // delete-and-reinsert, so re-ordering a related band needs no destructive permission — only
  // actually removing an edge does.
  const changed = [...wanted.entries()]
    .map(([k, edge]) => ({ edge, existing: currentByKey.get(k) }))
    .filter(
      (pair) =>
        pair.existing !== undefined &&
        (pair.existing.note !== pair.edge.note || pair.existing.sort_order !== pair.edge.sortOrder),
    )

  for (const { edge, existing } of changed) {
    if (existing === undefined) continue
    const { error } = await client
      .from('entity_relations')
      .update({ note: edge.note, sort_order: edge.sortOrder })
      .eq('id', existing.id)
    if (error) throw toRepositoryError(ENTITY, 'set', `${sourceType}:${sourceId}`, error)
  }
}
