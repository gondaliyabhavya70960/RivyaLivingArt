import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'export'

/**
 * The three export reads.
 *
 * THE ENQUIRY READ NAMES ITS COLUMNS AND THE FREE-TEXT PAIR IS CONDITIONAL AT THE QUERY, not
 * filtered out afterwards. That matters: a read of `*` followed by a delete of two keys leaves the
 * message body in the process's memory, in a log if the query is traced, and one careless
 * `JSON.stringify` away from a file it was excluded from. Not selecting it is the difference
 * between "we removed it" and "we never had it".
 */

export async function listProductsForExport(
  admin: Client,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await admin
    .from('products')
    // ONE LITERAL, NOT A CONCATENATION. supabase-js infers the row type from the select string,
    // and a string built at runtime infers nothing — the first draft of this file concatenated it
    // and every column came back as an error type.
    .select(
      'slug, sku, title, subtitle, summary, status, price_state, price_minor, price_from_minor, currency, availability_state, edition_state, edition_size, is_customizable, is_large_format, owner_verification, created_at, updated_at, categories(slug)',
    )
    .order('slug', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'products', 'all', error)

  return (data ?? []).map((row) => {
    const { categories, ...rest } = row as Record<string, unknown> & {
      categories?: { slug?: string } | null
    }
    return { ...rest, category_slug: categories?.slug ?? '' }
  })
}

export async function listMediaForExport(admin: Client): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await admin
    .from('media_assets')
    .select(
      'rivya_asset_id, public_id, folder, filename, kind, status, is_ai_generated, is_concept, source, tags, width, height, created_at',
    )
    .order('public_id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'media', 'all', error)
  return (data ?? []).map((row) => ({
    ...row,
    // An array in a CSV cell is a JSON blob or a delimiter accident. Semicolons, because a comma
    // would need quoting and a reader would still see one field.
    tags: Array.isArray(row.tags) ? row.tags.join('; ') : '',
  }))
}

const INQUIRY_BASE =
  'reference_code, kind, pipeline_status, name, phone, email, city, created_at, whatsapp_state'

export async function listInquiriesForExport(
  admin: Client,
  includeMessageBodies: boolean,
): Promise<Array<Record<string, unknown>>> {
  const columns = includeMessageBodies ? `${INQUIRY_BASE}, message, answers` : INQUIRY_BASE

  const { data, error } = await admin
    .from('inquiries')
    .select(columns)
    .order('created_at', { ascending: false })

  if (error) throw toRepositoryError(ENTITY, 'inquiries', 'all', error)
  return (data ?? []) as unknown as Array<Record<string, unknown>>
}
