import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { NotFoundError } from '../errors'
import { seoEntrySchema, type SeoEntry } from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'seo entry'

/** The four entity kinds an ENTITY-scope row may name, as `seo_entries.entity_type` spells them. */
export const SEO_ENTITY_TYPES = [
  'products',
  'categories',
  'collections',
  'portfolio_projects',
  'journal_articles',
] as const
export type SeoEntityType = (typeof SEO_ENTITY_TYPES)[number]

export function isSeoEntityType(value: string): value is SeoEntityType {
  return (SEO_ENTITY_TYPES as readonly string[]).includes(value)
}

/** The ENTITY-scope row for one entity, or null. Null is ordinary: most entities have none. */
export async function getSeoEntryForEntity(
  client: Client,
  entityType: SeoEntityType,
  entityId: string,
): Promise<SeoEntry | null> {
  const { data, error } = await client
    .from('seo_entries')
    .select('*')
    .eq('scope', 'ENTITY')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', `${entityType}:${entityId}`, error)
  return data === null ? null : parseRow(ENTITY, seoEntrySchema, data)
}

/** Every row the caller may read, GLOBAL first, then PATH by path, then ENTITY by type. */
export async function listSeoEntries(client: Client): Promise<SeoEntry[]> {
  const { data, error } = await client
    .from('seo_entries')
    .select('*')
    .order('scope')
    .order('path', { nullsFirst: true })
    .order('entity_type', { nullsFirst: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, seoEntrySchema, data ?? [])
}

export type SeoEntryWrite = {
  readonly title: string | null
  readonly description: string | null
  readonly social_title: string | null
  readonly social_description: string | null
  readonly og_media_id: string | null
  readonly canonical_url: string | null
  readonly structured_data_type: string | null
  readonly noindex: boolean
  readonly nofollow: boolean
  readonly derived: boolean
}

export type SeoEntryTarget =
  | { readonly scope: 'GLOBAL' }
  | { readonly scope: 'PATH'; readonly path: string }
  | { readonly scope: 'ENTITY'; readonly entityType: SeoEntityType; readonly entityId: string }

function targetColumns(target: SeoEntryTarget) {
  switch (target.scope) {
    case 'GLOBAL':
      return { scope: 'GLOBAL', path: null, entity_type: null, entity_id: null }
    case 'PATH':
      return { scope: 'PATH', path: target.path, entity_type: null, entity_id: null }
    case 'ENTITY':
      return {
        scope: 'ENTITY',
        path: null,
        entity_type: target.entityType,
        entity_id: target.entityId,
      }
  }
}

/**
 * Create a row for a target that has none.
 *
 * DRAFT, ALWAYS. The Phase 08 transition trigger refuses a session insert at any other status, and
 * an SEO row is content: it goes live through the same publish step as a section. The one row an
 * editor most wants live immediately — a product's own title — resolves through the entity's own
 * `seo_title` column until this row is published, so nothing is lost in the meantime.
 */
export async function insertSeoEntry(
  client: Client,
  target: SeoEntryTarget,
  values: SeoEntryWrite,
  actorId: string,
): Promise<SeoEntry> {
  const { data, error } = await client
    .from('seo_entries')
    .insert({
      ...targetColumns(target),
      ...values,
      status: 'DRAFT',
      fact_classification: 'SEO_COPY',
      owner_verification: 'NOT_REQUIRED',
      owner_edited: true,
      updated_by: actorId,
    })
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'create', target.scope, error)
  return parseRow(ENTITY, seoEntrySchema, data)
}

export async function updateSeoEntry(
  client: Client,
  id: string,
  values: Partial<SeoEntryWrite>,
  actorId: string,
): Promise<SeoEntry> {
  const { data, error } = await client
    .from('seo_entries')
    .update({
      ...values,
      owner_edited: true,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, seoEntrySchema, data)
}

/** Publish or unpublish. The transition trigger judges the edge; this only asks. */
export async function setSeoEntryStatus(
  client: Client,
  id: string,
  status: 'DRAFT' | 'PUBLISHED',
  actorId: string,
): Promise<SeoEntry> {
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('seo_entries')
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
  return parseRow(ENTITY, seoEntrySchema, data)
}

export async function deleteSeoEntry(client: Client, id: string): Promise<void> {
  const { error } = await client.from('seo_entries').delete().eq('id', id)
  if (error) throw toRepositoryError(ENTITY, 'delete', id, error)
}

/**
 * One `global_content` string, by group and key — the Global tab's site name, title template and
 * social defaults. The row must exist (every one is seeded); an owner edit sets `owner_edited` so
 * the seed runner never overwrites it.
 */
export async function updateGlobalString(
  client: Client,
  group: string,
  key: string,
  value: string,
  actorId: string,
): Promise<void> {
  const { data, error } = await client
    .from('global_content')
    .update({
      value,
      owner_edited: true,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq('group_key', group)
    .eq('key', key)
    .select('id')
    .maybeSingle()

  if (error) throw toRepositoryError('global content', 'update', `${group}.${key}`, error)
  if (data === null) throw new NotFoundError('global content', `${group}.${key}`)
}

// --- the Studio's resolution reads ---------------------------------------------------------------

/** A page's live sections reduced to the two fields derivation reads, in position order. */
export type DerivableSection = {
  readonly page_id: string
  readonly heading: string | null
  readonly body: string | null
  readonly status: string
  readonly is_visible: boolean
  readonly position: number
}

export async function listDerivableSections(client: Client): Promise<DerivableSection[]> {
  const { data, error } = await client
    .from('page_sections')
    .select('page_id, heading, body, status, is_visible, position')
    .order('page_id')
    .order('position')

  if (error) throw toRepositoryError('page section', 'list', 'derivable', error)
  return (data ?? []) as DerivableSection[]
}

/** The entities the Entities tab lists: enough to resolve, link and label each one. */
export type SeoEntitySummary = {
  readonly type: SeoEntityType
  readonly id: string
  readonly slug: string
  readonly path: string
  readonly name: string | null
  readonly status: string
  readonly ownTitle: string | null
  readonly ownDescription: string | null
  readonly summary: string | null
}

export async function listSeoEntities(client: Client): Promise<SeoEntitySummary[]> {
  const [products, categories, collections, projects, articles] = await Promise.all([
    client
      .from('products')
      .select('id, slug, title, summary, status, seo_title, seo_description')
      .order('slug'),
    client
      .from('categories')
      .select('id, slug, name, description, status, seo_title, seo_description')
      .order('sort_order'),
    client.from('collections').select('id, slug, name, statement, status').order('slug'),
    client.from('portfolio_projects').select('id, slug, title, summary, status').order('slug'),
    client.from('journal_articles').select('id, slug, title, excerpt, status').order('slug'),
  ])
  for (const [label, result] of [
    ['products', products],
    ['categories', categories],
    ['collections', collections],
    ['portfolio_projects', projects],
    ['journal_articles', articles],
  ] as const) {
    if (result.error) throw toRepositoryError('seo entity', 'list', label, result.error)
  }

  return [
    ...(products.data ?? []).map((row) => ({
      type: 'products' as const,
      id: row.id,
      slug: row.slug,
      path: `/product/${row.slug.toLowerCase()}`,
      name: row.title,
      status: row.status,
      ownTitle: row.seo_title,
      ownDescription: row.seo_description,
      summary: row.summary,
    })),
    ...(categories.data ?? []).map((row) => ({
      type: 'categories' as const,
      id: row.id,
      slug: row.slug,
      path: `/collection/${row.slug.toLowerCase()}`,
      name: row.name,
      status: row.status,
      ownTitle: row.seo_title,
      ownDescription: row.seo_description,
      summary: row.description,
    })),
    ...(collections.data ?? []).map((row) => ({
      type: 'collections' as const,
      id: row.id,
      slug: row.slug,
      path: `/collections/${row.slug.toLowerCase()}`,
      name: row.name,
      status: row.status,
      ownTitle: null,
      ownDescription: null,
      summary: row.statement,
    })),
    ...(projects.data ?? []).map((row) => ({
      type: 'portfolio_projects' as const,
      id: row.id,
      slug: row.slug,
      path: `/portfolio/${row.slug.toLowerCase()}`,
      name: row.title,
      status: row.status,
      ownTitle: null,
      ownDescription: null,
      summary: row.summary,
    })),
    ...(articles.data ?? []).map((row) => ({
      type: 'journal_articles' as const,
      id: row.id,
      slug: row.slug,
      path: `/journal/${row.slug.toLowerCase()}`,
      name: row.title,
      status: row.status,
      ownTitle: null,
      ownDescription: null,
      summary: row.excerpt,
    })),
  ]
}

// --- the Structured Data tab's facts -----------------------------------------------------------

export type StructuredDataFacts = {
  readonly productsPublished: number
  /** PUBLISHED, FIXED and VERIFIED — the only rows whose `Product` node carries `offers`. */
  readonly productsWithOffers: number
}

export async function structuredDataFacts(client: Client): Promise<StructuredDataFacts> {
  const [published, offers] = await Promise.all([
    client.from('products').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
    client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PUBLISHED')
      .eq('price_state', 'FIXED')
      .eq('owner_verification', 'VERIFIED'),
  ])
  if (published.error) throw toRepositoryError('product', 'count', 'published', published.error)
  if (offers.error) throw toRepositoryError('product', 'count', 'offers', offers.error)
  return { productsPublished: published.count ?? 0, productsWithOffers: offers.count ?? 0 }
}
