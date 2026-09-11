import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { NotFoundError } from '../errors'
import { seoKeywordThemeSchema, type KeywordStatus, type SeoKeywordTheme } from '../schemas/seo'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'keyword theme'

/**
 * `seo_keyword_themes` — the Keywords tab's table. Nothing here reads or writes a number about a
 * keyword, because the table has no column for one (0370).
 */

export async function listKeywordThemes(client: Client): Promise<SeoKeywordTheme[]> {
  const { data, error } = await client
    .from('seo_keyword_themes')
    .select('*')
    .order('mapped_path', { nullsFirst: false })
    .order('theme')

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, seoKeywordThemeSchema, data ?? [])
}

export async function getKeywordTheme(client: Client, id: string): Promise<SeoKeywordTheme> {
  const { data, error } = await client
    .from('seo_keyword_themes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, seoKeywordThemeSchema, data)
}

export type KeywordThemeWrite = {
  readonly theme: string
  readonly mapped_path: string | null
  readonly research_status: KeywordStatus
  readonly notes: string | null
  readonly evidence_url: string | null
}

/**
 * `researched_at` and `researched_by` follow the status: set when it leaves UNRESEARCHED, cleared
 * when it returns. The CHECK in 0370 refuses any other combination, so this is the one place the
 * pair is computed.
 */
function researchStamp(status: KeywordStatus, actorId: string, now: string) {
  return status === 'UNRESEARCHED'
    ? { researched_at: null, researched_by: null }
    : { researched_at: now, researched_by: actorId }
}

export async function insertKeywordTheme(
  client: Client,
  values: KeywordThemeWrite,
  actorId: string,
): Promise<SeoKeywordTheme> {
  const now = new Date().toISOString()
  // `normalized_theme` is a GENERATED column (0370) the database fills; the generated Insert type
  // lists it as required because it is `not null` with no default, which is the one shape the
  // type generator cannot tell from an ordinary column. The cast says: everything but that key.
  const row: Omit<
    Database['public']['Tables']['seo_keyword_themes']['Insert'],
    'normalized_theme'
  > = {
    ...values,
    ...researchStamp(values.research_status, actorId, now),
    status: 'DRAFT',
    fact_classification: 'SEO_COPY',
    owner_verification: 'NOT_REQUIRED',
    owner_edited: true,
    updated_by: actorId,
  }
  const { data, error } = await client
    .from('seo_keyword_themes')
    .insert(row as Database['public']['Tables']['seo_keyword_themes']['Insert'])
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'create', values.theme, error)
  return parseRow(ENTITY, seoKeywordThemeSchema, data)
}

export async function updateKeywordTheme(
  client: Client,
  id: string,
  values: Omit<KeywordThemeWrite, 'theme'>,
  actorId: string,
  existing: SeoKeywordTheme,
): Promise<SeoKeywordTheme> {
  const now = new Date().toISOString()
  // A status that has not changed keeps its original stamp; only a transition writes a new one.
  const stamp =
    existing.research_status === values.research_status
      ? {}
      : researchStamp(values.research_status, actorId, now)
  const { data, error } = await client
    .from('seo_keyword_themes')
    .update({ ...values, ...stamp, owner_edited: true, updated_by: actorId, updated_at: now })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, seoKeywordThemeSchema, data)
}

export async function deleteKeywordTheme(client: Client, id: string): Promise<void> {
  const { error } = await client.from('seo_keyword_themes').delete().eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'delete', id, error)
}
