import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { categorySchema, type Category } from '../schemas'
import { NotFoundError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'category'

/**
 * Category reads.
 *
 * Nothing here filters on `status` in application code. The public site sees published rows
 * because RLS says so (Phase 04), not because a repository remembered to add `.eq('status',
 * 'PUBLISHED')` — a filter that is one forgotten call away from leaking a draft. The `listAll`
 * function is not "unfiltered": it returns whatever the CALLER'S client is allowed to see, which
 * for an anonymous visitor is published rows and for a signed-in editor is everything.
 */

/** Every category visible to this client, in the order they are presented. */
export async function listCategories(client: Client): Promise<Category[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, categorySchema, data ?? [])
}

/** Top-level categories only — the mega-menu set. */
export async function listPrimaryCategories(client: Client): Promise<Category[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .eq('is_primary', true)
    .order('sort_order', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'primary', error)
  return parseRows(ENTITY, categorySchema, data ?? [])
}

/** Children of one category, in order. */
export async function listChildCategories(client: Client, parentId: string): Promise<Category[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', parentId, error)
  return parseRows(ENTITY, categorySchema, data ?? [])
}

/** One category by slug. Throws NotFoundError when it does not exist OR is not visible — the two
 *  are indistinguishable under RLS, and telling them apart would leak the existence of drafts. */
export async function getCategoryBySlug(client: Client, slug: string): Promise<Category> {
  const { data, error } = await client.from('categories').select('*').eq('slug', slug).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (!data) throw new NotFoundError(ENTITY, slug)
  return parseRow(ENTITY, categorySchema, data)
}

export async function getCategoryById(client: Client, id: string): Promise<Category> {
  const { data, error } = await client.from('categories').select('*').eq('id', id).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  if (!data) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, categorySchema, data)
}
