import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { collectionSchema, type Collection } from '../schemas'
import { NotFoundError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'collection'

/**
 * Collection reads.
 *
 * A collection is an exhibition, not a filtered grid. Until Phase 16 every row is a
 * DRAFT_COLLECTION_CONCEPT — the enum holds no other value — so nothing here can be published yet
 * and that is enforced by the database rather than by a check in this file.
 */

export async function listCollections(client: Client): Promise<Collection[]> {
  const { data, error } = await client
    .from('collections')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, collectionSchema, data ?? [])
}

export async function getCollectionBySlug(client: Client, slug: string): Promise<Collection> {
  const { data, error } = await client
    .from('collections')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (!data) throw new NotFoundError(ENTITY, slug)
  return parseRow(ENTITY, collectionSchema, data)
}
