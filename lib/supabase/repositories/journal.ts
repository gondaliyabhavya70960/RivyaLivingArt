import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { NotFoundError, PermissionError } from '../errors'
import {
  journalArticleSchema,
  journalCategorySchema,
  type JournalArticle,
  type JournalCategory,
} from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'journal article'
const CATEGORY = 'journal category'

/**
 * Reads for the journal.
 *
 * NOTHING HERE FILTERS ON `status` OR ON `published_at`, AND THAT IS DELIBERATE. Both conditions
 * live in the RLS policy — `journal_articles` is the one table on the site whose public clause
 * carries a date — so an anonymous caller cannot see a draft or a scheduled piece however this file
 * is written, and a staff caller with `content.read` sees everything. Repeating the filter here
 * would be a second copy of the rule that could drift from the policy, and the policy is the one
 * that cannot be bypassed.
 *
 * THE CONSEQUENCE IS WORTH STATING: these functions return DIFFERENT ROWS for a visitor and for an
 * editor, from the same code, because the client carries the identity. That is the point of RLS and
 * it is why every read takes a client rather than reaching for one.
 *
 * `angle_note` COMES BACK ON THE ROW AND IS NEVER RENDERED. It is the editorial brief, readable by
 * staff; the public routes select the same row and simply do not draw it. Unlike
 * `portfolio_projects.evidence_note` it is not revoked from `anon`, because an article's angle is
 * not a fact about a person or a client — it is a note about a piece the studio intends to write,
 * and treating it as a secret would be theatre. If that judgement ever changes, the fix is a column
 * grant like `0152`'s, not a narrower select list here.
 */

/** Categories in the order the studio arranged them. RLS decides which ones a caller sees. */
export async function listCategories(client: Client): Promise<JournalCategory[]> {
  const { data, error } = await client
    .from('journal_categories')
    .select('*')
    .order('position', { ascending: true })
    // A total order, so two categories sharing a position do not swap between requests.
    .order('slug', { ascending: true })

  if (error) throw toRepositoryError(CATEGORY, 'list', 'all', error)
  return parseRows(CATEGORY, journalCategorySchema, data ?? [])
}

/** One category by slug. `citext`, so the caller need not normalise case. */
export async function getCategoryBySlug(client: Client, slug: string): Promise<JournalCategory> {
  const { data, error } = await client
    .from('journal_categories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw toRepositoryError(CATEGORY, 'get', slug, error)
  if (data === null) throw new NotFoundError(CATEGORY, slug)
  return parseRow(CATEGORY, journalCategorySchema, data)
}

/**
 * Articles, newest first.
 *
 * ORDERED BY `published_at`, NOT `created_at`. When an article appears is an editorial decision;
 * when its row was first typed is an accident of drafting, and a piece written in January and
 * scheduled for March belongs in March's place. `id` breaks the tie so the order is total.
 */
export async function listArticles(
  client: Client,
  options: { readonly limit?: number; readonly offset?: number } = {},
): Promise<JournalArticle[]> {
  const from = options.offset ?? 0
  const to = from + (options.limit ?? 12) - 1

  const { data, error } = await client
    .from('journal_articles')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, to)

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, journalArticleSchema, data ?? [])
}

/** How many articles this caller may see. Needed for pagination, which is real links. */
export async function countArticles(
  client: Client,
  options: { readonly categoryId?: string } = {},
): Promise<number> {
  let query = client.from('journal_articles').select('id', { count: 'exact', head: true })
  if (options.categoryId !== undefined) {
    query = query.eq('primary_category_id', options.categoryId)
  }

  const { count, error } = await query
  if (error) throw toRepositoryError(ENTITY, 'count', options.categoryId ?? 'all', error)
  return count ?? 0
}

/**
 * The articles in one category.
 *
 * PRIMARY CATEGORY ONLY, AND THAT IS THE WHOLE RULE. An article carries one primary category and any
 * number of secondary ones; the category page lists the pieces that BELONG to it, not the pieces
 * that mention it. Listing both would put the same article on four category pages and make the
 * taxonomy meaningless — which is the failure a tag system has and a category system is chosen to
 * avoid.
 */
export async function listArticlesByCategory(
  client: Client,
  categoryId: string,
  options: { readonly limit?: number; readonly offset?: number } = {},
): Promise<JournalArticle[]> {
  const from = options.offset ?? 0
  const to = from + (options.limit ?? 12) - 1

  const { data, error } = await client
    .from('journal_articles')
    .select('*')
    .eq('primary_category_id', categoryId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, to)

  if (error) throw toRepositoryError(ENTITY, 'list-by-category', categoryId, error)
  return parseRows(ENTITY, journalArticleSchema, data ?? [])
}

/** One article by slug. */
export async function getArticleBySlug(client: Client, slug: string): Promise<JournalArticle> {
  const { data, error } = await client
    .from('journal_articles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (data === null) throw new NotFoundError(ENTITY, slug)
  return parseRow(ENTITY, journalArticleSchema, data)
}

/** The article a page belongs to, by `pages.id`. The reverse of `page_id`. */
export async function getArticleIdForPage(client: Client, pageId: string): Promise<string | null> {
  const { data, error } = await client
    .from('journal_articles')
    .select('id')
    .eq('page_id', pageId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'for-page', pageId, error)
  return data?.id ?? null
}

/**
 * Same-category articles, for the ONE fallback rule in `lib/cms/related.ts`.
 *
 * IT EXCLUDES THE ARTICLE ITSELF, in the query rather than in the caller. A "related" list that
 * includes the piece you are reading is the classic off-by-one of this feature, and the exclusion
 * belongs where the rows are chosen so no caller can forget it.
 */
export async function listSameCategoryArticles(
  client: Client,
  categoryId: string,
  excludeArticleId: string,
  limit: number,
): Promise<JournalArticle[]> {
  const { data, error } = await client
    .from('journal_articles')
    .select('*')
    .eq('primary_category_id', categoryId)
    .neq('id', excludeArticleId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)

  if (error) throw toRepositoryError(ENTITY, 'same-category', categoryId, error)
  return parseRows(ENTITY, journalArticleSchema, data ?? [])
}

// --- the Studio's reads and writes ---------------------------------------------------------------

/** Every article, for the Studio. All statuses; RLS admits staff to the drafts. */
export async function listArticlesForStudio(client: Client): Promise<JournalArticle[]> {
  const { data, error } = await client
    .from('journal_articles')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw toRepositoryError(ENTITY, 'list', 'studio', error)
  return parseRows(ENTITY, journalArticleSchema, data ?? [])
}

export async function getArticleByIdForStudio(client: Client, id: string): Promise<JournalArticle> {
  const { data, error } = await client
    .from('journal_articles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, journalArticleSchema, data)
}

/**
 * Create one article, as a DRAFT with no body.
 *
 * `reading_minutes` IS NOT ACCEPTED, and `status` is not either. The first is derived by a trigger
 * and the second is what SEED §20 forbids a machine from setting. What a caller may supply is a
 * title, an address and a category.
 */
export async function insertArticle(
  client: Client,
  values: {
    readonly slug: string
    readonly title: string
    readonly primaryCategoryId: string | null
    readonly createdBy: string
  },
): Promise<JournalArticle> {
  const { data, error } = await client
    .from('journal_articles')
    .insert({
      slug: values.slug,
      title: values.title,
      primary_category_id: values.primaryCategoryId,
      updated_by: values.createdBy,
    })
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'insert', values.slug, error)
  return parseRow(ENTITY, journalArticleSchema, data)
}

/** Update one article. The gates are a trigger and a constraint, so a refusal is a thrown error. */
export async function updateArticleRow(
  client: Client,
  id: string,
  values: Partial<JournalArticle>,
): Promise<JournalArticle> {
  const { data, error } = await client
    .from('journal_articles')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
  return parseRow(ENTITY, journalArticleSchema, data)
}

/** Point an article at its body page. Read back, because RLS filters an UPDATE rather than refusing it. */
export async function linkArticlePage(
  client: Client,
  articleId: string,
  pageId: string,
): Promise<void> {
  const { data, error } = await client
    .from('journal_articles')
    .update({ page_id: pageId })
    .eq('id', articleId)
    .select('page_id')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'link-page', articleId, error)
  // Zero rows changed and no error is what an RLS-filtered UPDATE looks like. Reported as a
  // refusal rather than as success, or the editor is told the article has a body page it does not.
  if (data?.page_id !== pageId) throw new PermissionError('link-page', ENTITY)
}

/** Update one category. Slugs are immutable after seed — the action refuses a change, not this. */
export async function updateCategoryRow(
  client: Client,
  id: string,
  values: Partial<JournalCategory>,
): Promise<JournalCategory> {
  const { data, error } = await client
    .from('journal_categories')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw toRepositoryError(CATEGORY, 'update', id, error)
  return parseRow(CATEGORY, journalCategorySchema, data)
}
