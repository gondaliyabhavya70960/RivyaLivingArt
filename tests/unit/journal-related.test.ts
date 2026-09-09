import { describe, expect, it, vi } from 'vitest'

import { MINIMUM } from '@/lib/cms/related'
import type { EntityRelation, JournalArticle } from '@/lib/supabase/schemas'

/**
 * The one automatic rule, held to being one.
 *
 * FEAT §11 PERMITS EXACTLY ONE, and the failure this file prevents is the second one arriving
 * quietly: "or the same material", "or what other readers opened", "or the newest three". Each of
 * those looks like an improvement in isolation and each is an association nobody made. The
 * assertions below are therefore about what the function REFUSES to do as much as what it does.
 *
 * THE CLIENT IS A STUB. What is under test is the decision — curated first, then the shortfall from
 * one source — not the SQL underneath it. The repository's own query is what excludes drafts and the
 * article itself, and RLS is what excludes what a caller may not see; neither is this function's
 * job, and a test that mocked a database to re-check them would be testing the mock.
 */

const CATEGORY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function article(overrides: Partial<JournalArticle> = {}): JournalArticle {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    slug: 'the-article',
    page_id: null,
    title: 'The article',
    standfirst: null,
    excerpt: null,
    angle_note: null,
    primary_category_id: CATEGORY,
    cover_media_id: null,
    cover_mobile_media_id: null,
    byline: 'Rivya Living Art',
    reading_minutes: null,
    seo_entry_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    status: 'PUBLISHED',
    owner_verification: 'NOT_REQUIRED',
    fact_classification: 'EDITORIAL_COPY',
    published_at: '2026-01-01T00:00:00Z',
    published_by: null,
    seed_key: null,
    content_seed_version: null,
    seed_content_hash: null,
    seed_last_applied_at: null,
    owner_edited: false,
    ...overrides,
  } as JournalArticle
}

function edge(targetId: string, targetType = 'JOURNAL_ARTICLE'): EntityRelation {
  return {
    id: `edge-${targetId}`,
    source_type: 'JOURNAL_ARTICLE',
    source_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    target_type: targetType,
    target_id: targetId,
    relation_type: 'RELATED',
    note: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
  } as unknown as EntityRelation
}

/** Stubs the two repository calls `relatedForArticle` makes, and records what it asked for. */
function harness(options: {
  readonly curated: readonly EntityRelation[]
  readonly sameCategory: readonly JournalArticle[]
}) {
  const asked: { limit?: number; exclude?: string; categoryId?: string } = {}

  vi.doMock('@/lib/supabase/repositories/entity-relations', () => ({
    getRelations: async () => options.curated,
  }))
  vi.doMock('@/lib/supabase/repositories/journal', () => ({
    listSameCategoryArticles: async (
      _client: unknown,
      categoryId: string,
      exclude: string,
      limit: number,
    ) => {
      asked.categoryId = categoryId
      asked.exclude = exclude
      asked.limit = limit
      return options.sameCategory
    },
  }))

  return asked
}

async function run(options: {
  readonly curated: readonly EntityRelation[]
  readonly sameCategory: readonly JournalArticle[]
  readonly subject?: JournalArticle
}) {
  vi.resetModules()
  const asked = harness(options)
  const { relatedForArticle: fresh } = await import('@/lib/cms/related')
  const result = await fresh({} as never, options.subject ?? article())
  return { result, asked }
}

describe('curated edges always win', () => {
  it('does not fire the rule at all once there are three curated links', async () => {
    const { result, asked } = await run({
      curated: [edge('one'), edge('two'), edge('three')],
      sameCategory: [article({ id: 'filler' })],
    })

    expect(result.curated).toHaveLength(3)
    expect(result.sameCategory).toEqual([])
    expect(result.sameCategoryId).toBeNull()
    // The strongest form of "the rule did not fire": the query was never made.
    expect(asked.limit).toBeUndefined()
  })

  it('does not fire it when there are MORE than three, either', async () => {
    const { result } = await run({
      curated: [edge('one'), edge('two'), edge('three'), edge('four')],
      sameCategory: [article({ id: 'filler' })],
    })
    expect(result.sameCategory).toEqual([])
  })

  it('fills only the shortfall, never a full set', async () => {
    const { result, asked } = await run({
      curated: [edge('one')],
      sameCategory: [
        article({ id: 'f1' }),
        article({ id: 'f2' }),
        article({ id: 'f3' }),
        article({ id: 'f4' }),
      ],
    })

    expect(result.curated).toHaveLength(1)
    expect(result.sameCategory).toHaveLength(MINIMUM - 1)
    expect(result.sameCategoryId).toBe(CATEGORY)
    expect(asked.categoryId).toBe(CATEGORY)
  })
})

describe('the fallback rule is exactly one rule', () => {
  it('asks only for the article’s own primary category', async () => {
    const { asked } = await run({ curated: [], sameCategory: [] })
    expect(asked.categoryId).toBe(CATEGORY)
  })

  it('excludes the article itself, in the query rather than afterwards', async () => {
    const subject = article({ id: 'me' })
    const { asked } = await run({ curated: [], sameCategory: [], subject })
    expect(asked.exclude).toBe('me')
  })

  /**
   * A curated edge may already point at an article in the same category. Showing it twice — once as
   * a choice somebody made and once as a filler — is the duplicate this shape invites.
   */
  it('never repeats an article a curated edge already points at', async () => {
    const { result } = await run({
      curated: [edge('f1')],
      sameCategory: [article({ id: 'f1' }), article({ id: 'f2' }), article({ id: 'f3' })],
    })

    expect(result.sameCategory.map((a) => a.id)).toEqual(['f2', 'f3'])
  })

  it('over-fetches by the number of curated article edges, so the shortfall can still be met', async () => {
    const { asked } = await run({
      curated: [edge('f1'), edge('f2')],
      sameCategory: [],
    })
    // One short, two possible duplicates to drop.
    expect(asked.limit).toBe(MINIMUM - 2 + 2)
  })

  /** Only ARTICLE edges can collide with the fill; a product edge is not a candidate to dedupe. */
  it('counts only article edges when working out how many extras to fetch', async () => {
    const { asked } = await run({
      curated: [edge('p1', 'PRODUCT')],
      sameCategory: [],
    })
    expect(asked.limit).toBe(MINIMUM - 1)
  })
})

describe('the rule cannot fire when there is nothing true to say', () => {
  it('returns no fill for an article with no primary category', async () => {
    const { result, asked } = await run({
      curated: [],
      sameCategory: [article({ id: 'f1' })],
      subject: article({ primary_category_id: null }),
    })

    expect(result.sameCategory).toEqual([])
    expect(result.sameCategoryId).toBeNull()
    expect(asked.categoryId).toBeUndefined()
  })

  /**
   * `sameCategoryId` IS WHAT LABELS THE BAND — *More in {category}* — so it must be null whenever
   * the band would be empty. A heading over nothing is the failure this guards.
   */
  it('reports no category when the category held nothing else', async () => {
    const { result } = await run({ curated: [], sameCategory: [] })
    expect(result.sameCategory).toEqual([])
    expect(result.sameCategoryId).toBeNull()
  })
})
