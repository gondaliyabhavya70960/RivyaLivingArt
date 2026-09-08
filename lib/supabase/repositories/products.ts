import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { productSchema, type Product } from '../schemas'
import { NotFoundError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'product'

/**
 * Product reads.
 *
 * THIS FILE CONTAINS NO INSERT. `products` ships with zero rows and stays that way under seed
 * policy (requirement §32): a product exists because an owner typed it in the Studio (Phase 14) or
 * because an approved import created it. Adding a create function here before that surface exists
 * would be the first step toward fabricated inventory, which D10 forbids outright.
 */

export async function listProductsByCategory(
  client: Client,
  categoryId: string,
): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (error) throw toRepositoryError(ENTITY, 'list', categoryId, error)
  return parseRows(ENTITY, productSchema, data ?? [])
}

export async function listLargeFormatProducts(client: Client): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('is_large_format', true)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (error) throw toRepositoryError(ENTITY, 'list', 'large-format', error)
  return parseRows(ENTITY, productSchema, data ?? [])
}

export async function getProductBySlug(client: Client, slug: string): Promise<Product> {
  const { data, error } = await client.from('products').select('*').eq('slug', slug).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (!data) throw new NotFoundError(ENTITY, slug)
  return parseRow(ENTITY, productSchema, data)
}

/**
 * Trigram search over title.
 *
 * `ilike` with leading and trailing wildcards is what the `products_title_trgm_idx` GIN index
 * exists to serve; without that index this degrades to a sequential scan, which is why the index
 * and this function must move together.
 *
 * The search term is passed as a bound parameter by PostgREST, but `%` and `_` inside it are still
 * pattern metacharacters, so they are escaped here. Otherwise a user searching for "50%" matches
 * every product.
 */
export async function searchProductsByTitle(
  client: Client,
  term: string,
  limit = 20,
): Promise<Product[]> {
  const escaped = term.replace(/([\\%_])/g, '\\$1')

  const { data, error } = await client
    .from('products')
    .select('*')
    .ilike('title', `%${escaped}%`)
    .limit(limit)

  if (error) throw toRepositoryError(ENTITY, 'search', term, error)
  return parseRows(ENTITY, productSchema, data ?? [])
}
