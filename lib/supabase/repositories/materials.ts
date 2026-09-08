import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { materialSchema, type Material } from '../schemas'
import { NotFoundError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'material'

/** Material reads. Descriptions are EDITORIAL_COPY and must not carry a durability,
 *  certification or performance claim (D10) — a content rule, enforced in review and seeding. */

export async function listMaterials(client: Client): Promise<Material[]> {
  const { data, error } = await client
    .from('materials')
    .select('*')
    .order('family', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, materialSchema, data ?? [])
}

export async function listMaterialsByFamily(
  client: Client,
  family: Material['family'],
): Promise<Material[]> {
  const { data, error } = await client
    .from('materials')
    .select('*')
    .eq('family', family)
    .order('name', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', family, error)
  return parseRows(ENTITY, materialSchema, data ?? [])
}

export async function getMaterialBySlug(client: Client, slug: string): Promise<Material> {
  const { data, error } = await client.from('materials').select('*').eq('slug', slug).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (!data) throw new NotFoundError(ENTITY, slug)
  return parseRow(ENTITY, materialSchema, data)
}
