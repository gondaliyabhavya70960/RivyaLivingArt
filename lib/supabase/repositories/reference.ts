import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'

/**
 * Reads for the three entity families a homepage reference block shows, each of which may not
 * exist yet.
 *
 * WHY THESE ARE NOT IN `products.ts`, `portfolio.ts` AND `journal.ts`. Two of those tables have no
 * migration yet — `portfolio_projects` arrives in Phase 17, `journal_articles` in Phase 18 — so
 * they are absent from `database.types.ts` and a typed `.from('journal_articles')` does not
 * compile. What these three reads have in common is not their subject, it is their SHAPE: each
 * asks a table that may not exist for a handful of cards and must answer "no such table" without
 * throwing. Keeping that shape in one file means the untyped escape hatch below is written once,
 * next to the reason for it, rather than three times in three files that each look like ordinary
 * repository code.
 *
 * `null` MEANS "NO SUCH TABLE", `[]` MEANS "NOTHING TO SHOW". The two look identical on the page
 * and are different facts, and a caller that could not tell them apart would report a site that is
 * merely young as a site that is broken.
 *
 * THE SELECT LISTS ARE NARROW ON PURPOSE. A homepage card shows a name, a line of summary and a
 * picture; it never shows a price, a dimension or an availability state. Asking for only those
 * columns means a renderer cannot accidentally acquire commercial detail about an object nobody
 * has confirmed exists — the schema of the query is the guardrail.
 */

type Client = SupabaseClient<Database>

/** The columns every reference card needs, and no others. */
export type ReferenceRow = {
  readonly id: string
  readonly slug: string
  readonly title: string | null
  readonly summary: string | null
  readonly hero_media_id: string | null
  /**
   * One extra column, named per table, or absent.
   *
   * IT IS DELIBERATELY UNTYPED-BY-TABLE AND DELIBERATELY SINGULAR. The three tables this file reads
   * share a narrow card shape on purpose — a name, a line and a picture, never a price or a
   * dimension — and that restraint is what stops a card band quietly acquiring a fourth fact about
   * a product. But `portfolio_projects.project_type` is a real difference: a project card carries
   * "Commission" or "Restoration" above its title, which is what RC-219 means by an eyebrow, and no
   * product or article has an equivalent. One optional slot admits that one difference without
   * opening the select list to whatever the next caller fancies.
   */
  readonly eyebrow?: string | null
}

/** PostgreSQL's `undefined_table`, and PostgREST's own code for a relation absent from its cache. */
function missingTable(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205'
}

/**
 * A read against a table that may not exist.
 *
 * THE CAST IS THE POINT AND IS CONFINED HERE. `client.from('journal_articles')` does not type-check
 * against generated types that have no such table, and generating types for tables two phases away
 * would mean writing migrations we are not ready to write. Widening the client for this one call
 * keeps the escape hatch to four lines, in a file whose header explains it, rather than turning off
 * type safety across a repository.
 */
async function readMaybeMissing(
  client: Client,
  table: string,
  limit: number,
  /** A column on THIS table to read as the card's eyebrow. Omitted for tables that have none. */
  eyebrowColumn?: string,
): Promise<ReferenceRow[] | null> {
  const loose = client as unknown as {
    from: (t: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{
              data: (ReferenceRow & Record<string, unknown>)[] | null
              error: { code?: string } | null
            }>
          }
        }
      }
    }
  }

  const columns = ['id', 'slug', 'title', 'summary', 'hero_media_id']
  if (eyebrowColumn !== undefined) columns.push(eyebrowColumn)

  const { data, error } = await loose
    .from(table)
    .select(columns.join(', '))
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error !== null) {
    if (missingTable(error.code)) return null
    throw error
  }
  if (data === null) return []
  if (eyebrowColumn === undefined) return data

  return data.map((row) => {
    const value = row[eyebrowColumn]
    return { ...row, eyebrow: typeof value === 'string' ? value : null }
  })
}

/**
 * Published products, newest first.
 *
 * `products` DOES exist — Phase 03 created it — so this never returns null. It returns `[]`, which
 * is the true and permanent answer until Phase 14 puts something in it: `products` is not a member
 * of the seed runner's `SeedableTable` union, so no seed will ever add a row.
 */
export async function listReferenceProducts(
  client: Client,
  limit: number,
): Promise<ReferenceRow[] | null> {
  return readMaybeMissing(client, 'products', limit)
}

/**
 * Delivered projects.
 *
 * `project_type` COMES BACK AS THE EYEBROW, which is the one column this file reads that its
 * siblings do not. RC-219 asks for the project's type above its title as TEXT — never a
 * colour-coded chip, because a colour is not readable to everyone and a chip invites a taxonomy
 * nobody has agreed. It is nullable and often will be null; the card simply omits the line.
 */
export async function listReferenceProjects(
  client: Client,
  limit: number,
): Promise<ReferenceRow[] | null> {
  return readMaybeMissing(client, 'portfolio_projects', limit, 'project_type')
}

/** Journal articles. The table arrives in Phase 18; until then this returns null. */
export async function listReferenceArticles(
  client: Client,
  limit: number,
): Promise<ReferenceRow[] | null> {
  return readMaybeMissing(client, 'journal_articles', limit)
}

/**
 * The products curated into one collection, in the curator's order.
 *
 * IT IS IN THIS FILE FOR THE SECOND REASON THE HEADER GIVES, not the first. `products` and
 * `product_collections` both exist and are both typed, so this read needs none of the
 * missing-table escape hatch above. What it shares with the other three is the SHAPE that matters
 * more: the narrow card select list. A collection band shows a name, a line and a picture, never a
 * price or a dimension, and keeping that select list beside the others is what stops one of them
 * quietly acquiring a fourth column.
 *
 * `!inner` IS LOAD-BEARING. A draft product curated into a published collection must not appear on
 * the exhibition page, and RLS already hides the product row — an inner join drops the join row
 * with it. A left join would keep the row with a null product and render a card with no name.
 *
 * ORDERED BY THE JOIN, NOT THE PRODUCT. `product_collections.sort_order` is what the Studio
 * curator drag-reorders; `products.created_at` is an accident of data entry. `product_id` breaks
 * the tie so the order is total and a page does not reshuffle between requests.
 */
export async function listCuratedProducts(
  client: Client,
  collectionId: string,
  limit: number,
): Promise<ReferenceRow[]> {
  const { data, error } = await client
    .from('product_collections')
    .select('sort_order, product_id, products!inner(id, slug, title, summary, hero_media_id)')
    .eq('collection_id', collectionId)
    .order('sort_order', { ascending: true })
    .order('product_id', { ascending: true })
    .limit(limit)

  if (error !== null) throw error

  return (data ?? []).map((row) => {
    const product = row.products as unknown as ReferenceRow
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      summary: product.summary,
      hero_media_id: product.hero_media_id,
    }
  })
}
