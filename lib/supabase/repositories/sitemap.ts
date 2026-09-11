import type { SupabaseClient } from '@supabase/supabase-js'

import type { SitemapRow, SitemapType } from '@/lib/seo/sitemap'

import type { Database } from '../database.types'
import { toRepositoryError } from './support'

type Client = SupabaseClient<Database>

/**
 * The six sitemap readers, through the anonymous client.
 *
 * FIVE OF THE SIX READ `pages`, because five of the six kinds of page ARE pages: a category, a
 * collection, a project and an article each have a `pages` row whose `kind` names them and whose
 * `path` is the address a visitor loads, and `renderCmsPage` 404s any of them with no live
 * section. So the sitemap asks the same question the renderer does — a `pages` row of the right
 * kind with at least one section — rather than the entity table, which could be PUBLISHED while
 * its page is not. Products are the exception: `/product/[slug]` has no `pages` row and renders
 * from the product itself.
 *
 * THE ANONYMOUS CLIENT IS THE FILTER, and `sitemapEntries()` checks `status` again. Nothing here
 * spells out a publication rule a policy already states; the second check is a belt.
 */

const KIND: Readonly<Record<Exclude<SitemapType, 'products'>, string>> = {
  pages: 'PAGE',
  categories: 'CATEGORY',
  collections: 'COLLECTION',
  portfolio: 'PROJECT',
  journal: 'ARTICLE',
}

async function pagesOfKind(client: Client, kind: string): Promise<SitemapRow[]> {
  const { data, error } = await client
    .from('pages')
    .select('path, status, published_at, updated_at, page_sections!inner(id)')
    .eq('kind', kind)
    .not('path', 'is', null)
    .order('path')

  if (error) throw toRepositoryError('page', 'list', `sitemap:${kind}`, error)
  const seen = new Set<string>()
  const rows: SitemapRow[] = []
  for (const row of data ?? []) {
    if (row.path === null || seen.has(row.path)) continue
    seen.add(row.path)
    rows.push({
      path: row.path,
      status: row.status,
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
    })
  }
  return rows
}

async function products(client: Client): Promise<SitemapRow[]> {
  const { data, error } = await client
    .from('products')
    .select('slug, status, published_at, updated_at')
    .order('slug')

  if (error) throw toRepositoryError('product', 'list', 'sitemap', error)
  return (data ?? []).map((row) => ({
    path: `/product/${row.slug.toLowerCase()}`,
    status: row.status,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  }))
}

export async function listSitemapRows(client: Client, type: SitemapType): Promise<SitemapRow[]> {
  return type === 'products' ? products(client) : pagesOfKind(client, KIND[type])
}
