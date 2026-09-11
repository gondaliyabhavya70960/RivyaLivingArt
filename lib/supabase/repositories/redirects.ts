import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { NotFoundError } from '../errors'
import { seoRedirectSchema, type RedirectStatusCode, type SeoRedirect } from '../schemas/seo'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'redirect'

/**
 * `seo_redirects`. Two readers with two audiences: `getPublishedRedirect` is what the 404 path
 * asks through the anonymous client (RLS admits PUBLISHED rows only, and the query says so again),
 * and `listRedirects` is the Studio's table. `recordRedirectHit` is the one write the public path
 * makes, as the service role, because no visitor may update a row.
 */

export async function getPublishedRedirect(
  client: Client,
  fromPath: string,
): Promise<SeoRedirect | null> {
  const { data, error } = await client
    .from('seo_redirects')
    .select('*')
    .eq('from_path', fromPath)
    .eq('status', 'PUBLISHED')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', fromPath, error)
  return data === null ? null : parseRow(ENTITY, seoRedirectSchema, data)
}

export async function listRedirects(client: Client): Promise<SeoRedirect[]> {
  const { data, error } = await client.from('seo_redirects').select('*').order('from_path')
  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, seoRedirectSchema, data ?? [])
}

export async function getRedirect(client: Client, id: string): Promise<SeoRedirect> {
  const { data, error } = await client.from('seo_redirects').select('*').eq('id', id).maybeSingle()
  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, seoRedirectSchema, data)
}

export type RedirectWrite = {
  readonly from_path: string
  readonly to_path: string
  readonly status_code: RedirectStatusCode
  readonly reason: string | null
}

/**
 * Created PUBLISHED. A redirect is operational rather than editorial — the alternative to a live
 * redirect is a live 404 — so the row goes in ready to serve. Pausing one is `setRedirectStatus`.
 */
export async function insertRedirect(
  client: Client,
  values: RedirectWrite,
  actorId: string,
): Promise<SeoRedirect> {
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('seo_redirects')
    .insert({
      ...values,
      status: 'PUBLISHED',
      published_at: now,
      published_by: actorId,
      created_by: actorId,
      updated_by: actorId,
    })
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'create', values.from_path, error)
  return parseRow(ENTITY, seoRedirectSchema, data)
}

export async function updateRedirect(
  client: Client,
  id: string,
  values: RedirectWrite,
  actorId: string,
): Promise<SeoRedirect> {
  const { data, error } = await client
    .from('seo_redirects')
    .update({ ...values, updated_by: actorId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, seoRedirectSchema, data)
}

export async function setRedirectStatus(
  client: Client,
  id: string,
  status: 'DRAFT' | 'PUBLISHED',
  actorId: string,
): Promise<SeoRedirect> {
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('seo_redirects')
    .update(
      status === 'PUBLISHED'
        ? { status, published_at: now, published_by: actorId, updated_by: actorId, updated_at: now }
        : { status, updated_by: actorId, updated_at: now },
    )
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, seoRedirectSchema, data)
}

export async function deleteRedirect(client: Client, id: string): Promise<void> {
  const { error } = await client.from('seo_redirects').delete().eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'delete', id, error)
}

/**
 * `hit_count + 1`, `last_hit_at = now()`, as the service role. Best effort: the redirect has
 * already been decided by the time this runs, and a failed count must never turn into a failed
 * redirect — the caller swallows the error.
 */
export async function recordRedirectHit(
  admin: Client,
  id: string,
  hitCount: number,
): Promise<void> {
  const { error } = await admin
    .from('seo_redirects')
    .update({ hit_count: hitCount + 1, last_hit_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
}
