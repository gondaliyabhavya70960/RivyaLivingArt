import { describe, expect, it } from 'vitest'

import {
  getCategoryBySlug,
  listCategories,
  listPrimaryCategories,
} from '../../../lib/supabase/repositories/categories'
import {
  getProductBySlug,
  listProductsByCategory,
  searchProductsByTitle,
} from '../../../lib/supabase/repositories/products'
import { getMediaAssetByRivyaId } from '../../../lib/supabase/repositories/media'
import {
  ConflictError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from '../../../lib/supabase/errors'
import { allArgsOf, argsOf, makeFakeClient, postgrestError } from './fake-client'

/** A complete, valid category row — the shape the schema demands. */
function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'furniture',
    parent_id: null,
    name: 'Furniture',
    subtitle: null,
    description: null,
    sort_order: 10,
    is_primary: true,
    hero_media_id: null,
    seo_title: null,
    seo_description: null,
    created_at: '2026-09-08T00:00:00+00:00',
    updated_at: '2026-09-08T00:00:00+00:00',
    updated_by: null,
    status: 'DRAFT',
    owner_verification: 'NOT_REQUIRED',
    fact_classification: null,
    published_at: null,
    published_by: null,
    seed_key: 'category:furniture',
    content_seed_version: 'rivya-v1',
    seed_content_hash: 'abc',
    seed_last_applied_at: '2026-09-08T00:00:00+00:00',
    owner_edited: false,
    ...overrides,
  }
}

describe('repositories — the query each one issues', () => {
  it('listCategories reads the categories table, ordered as presented', async () => {
    const fake = makeFakeClient({ data: [categoryRow()], error: null })
    await listCategories(fake.client)

    expect(fake.table).toBe('categories')
    expect(allArgsOf(fake.calls, 'order')).toEqual([
      ['sort_order', { ascending: true }],
      ['slug', { ascending: true }],
    ])
  })

  it('listPrimaryCategories asks for top-level primaries only', async () => {
    const fake = makeFakeClient({ data: [], error: null })
    await listPrimaryCategories(fake.client)

    expect(argsOf(fake.calls, 'is')).toEqual(['parent_id', null])
    expect(argsOf(fake.calls, 'eq')).toEqual(['is_primary', true])
  })

  it('listProductsByCategory filters on the category it was given', async () => {
    const fake = makeFakeClient({ data: [], error: null })
    await listProductsByCategory(fake.client, 'cat-1')

    expect(fake.table).toBe('products')
    expect(argsOf(fake.calls, 'eq')).toEqual(['category_id', 'cat-1'])
  })

  it('getMediaAssetByRivyaId looks up the D6 identity, not the filename', async () => {
    const fake = makeFakeClient({ data: null, error: null })
    await expect(getMediaAssetByRivyaId(fake.client, 'HERO-001')).rejects.toThrow(NotFoundError)

    expect(argsOf(fake.calls, 'eq')).toEqual(['rivya_asset_id', 'HERO-001'])
  })
})

describe('searchProductsByTitle — pattern metacharacters', () => {
  it('escapes % so a search for "50%" is not a search for everything', async () => {
    const fake = makeFakeClient({ data: [], error: null })
    await searchProductsByTitle(fake.client, '50%')

    expect(argsOf(fake.calls, 'ilike')).toEqual(['title', '%50\\%%'])
  })

  it('escapes _ , which otherwise matches any single character', async () => {
    const fake = makeFakeClient({ data: [], error: null })
    await searchProductsByTitle(fake.client, 'a_b')

    expect(argsOf(fake.calls, 'ilike')).toEqual(['title', '%a\\_b%'])
  })

  it('escapes the escape character itself', async () => {
    const fake = makeFakeClient({ data: [], error: null })
    await searchProductsByTitle(fake.client, 'a\\b')

    expect(argsOf(fake.calls, 'ilike')).toEqual(['title', '%a\\\\b%'])
  })

  it('leaves an ordinary term alone', async () => {
    const fake = makeFakeClient({ data: [], error: null })
    await searchProductsByTitle(fake.client, 'walnut')

    expect(argsOf(fake.calls, 'ilike')).toEqual(['title', '%walnut%'])
  })
})

describe('error mapping — a caller never sees a PostgrestError', () => {
  it('23505 unique violation becomes ConflictError, carrying the constraint name', async () => {
    const fake = makeFakeClient({
      data: null,
      error: postgrestError(
        '23505',
        'duplicate key value violates unique constraint "categories_slug_key"',
      ),
    })

    await expect(getCategoryBySlug(fake.client, 'furniture')).rejects.toMatchObject({
      kind: 'conflict',
      constraint: 'categories_slug_key',
    })
    await expect(getCategoryBySlug(fake.client, 'furniture')).rejects.toBeInstanceOf(ConflictError)
  })

  it('23503 foreign key violation becomes ConflictError', async () => {
    const fake = makeFakeClient({ data: null, error: postgrestError('23503') })
    await expect(getCategoryBySlug(fake.client, 'x')).rejects.toBeInstanceOf(ConflictError)
  })

  it('42501 insufficient privilege becomes PermissionError', async () => {
    const fake = makeFakeClient({ data: null, error: postgrestError('42501') })
    await expect(getCategoryBySlug(fake.client, 'x')).rejects.toBeInstanceOf(PermissionError)
  })

  it('23514 check violation becomes ValidationError naming the constraint', async () => {
    const fake = makeFakeClient({
      data: null,
      error: postgrestError('23514', 'violates check constraint "products_price_state_coherent"'),
    })
    await expect(getProductBySlug(fake.client, 'x')).rejects.toMatchObject({
      kind: 'validation',
      issues: [{ path: 'products_price_state_coherent' }],
    })
  })

  it('an unrecognised code still becomes a typed error rather than leaking through', async () => {
    const fake = makeFakeClient({ data: null, error: postgrestError('XX999', 'internal') })
    await expect(getCategoryBySlug(fake.client, 'x')).rejects.toBeInstanceOf(ValidationError)
  })

  it('a missing row is NotFoundError, whether it is absent or merely invisible', async () => {
    // RLS gives no way to tell those apart, and telling them apart would leak the existence of
    // draft rows to anonymous visitors.
    const fake = makeFakeClient({ data: null, error: null })
    await expect(getCategoryBySlug(fake.client, 'ghost')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('schema validation on the way OUT of the database', () => {
  it('rejects a row whose enum value is not in the schema', async () => {
    // A migration that adds a content_status value without updating the Zod schema lands here,
    // loudly, instead of surfacing as a blank page for the one row that used it.
    const fake = makeFakeClient({ data: categoryRow({ status: 'SOMETHING_NEW' }), error: null })
    await expect(getCategoryBySlug(fake.client, 'furniture')).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('rejects a row missing a non-nullable column', async () => {
    const row = categoryRow()
    delete (row as Record<string, unknown>).name
    const fake = makeFakeClient({ data: row, error: null })

    await expect(getCategoryBySlug(fake.client, 'furniture')).rejects.toMatchObject({
      kind: 'validation',
      issues: [{ path: 'name' }],
    })
  })

  it('fails a whole list rather than silently dropping the bad row', async () => {
    // Filtering the row out would produce a category listing quietly missing an item, with
    // nothing anywhere saying why — the hardest kind of bug to notice.
    const fake = makeFakeClient({
      data: [categoryRow(), categoryRow({ sort_order: 'not-a-number' })],
      error: null,
    })
    await expect(listCategories(fake.client)).rejects.toBeInstanceOf(ValidationError)
  })

  it('names the index of the offending row in a list', async () => {
    const fake = makeFakeClient({
      data: [categoryRow(), categoryRow({ sort_order: 'not-a-number' })],
      error: null,
    })
    await expect(listCategories(fake.client)).rejects.toMatchObject({
      issues: [{ path: '[1].sort_order' }],
    })
  })

  it('accepts a valid row', async () => {
    const fake = makeFakeClient({ data: categoryRow(), error: null })
    const category = await getCategoryBySlug(fake.client, 'furniture')

    expect(category.slug).toBe('furniture')
    expect(category.sort_order).toBe(10)
  })
})
