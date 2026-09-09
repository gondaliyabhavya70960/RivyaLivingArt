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
            limit: (
              n: number,
            ) => Promise<{ data: ReferenceRow[] | null; error: { code?: string } | null }>
          }
        }
      }
    }
  }

  const { data, error } = await loose
    .from(table)
    .select('id, slug, title, summary, hero_media_id')
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error !== null) {
    if (missingTable(error.code)) return null
    throw error
  }
  return data ?? []
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

/** Delivered projects. The table arrives in Phase 17; until then this returns null. */
export async function listReferenceProjects(
  client: Client,
  limit: number,
): Promise<ReferenceRow[] | null> {
  return readMaybeMissing(client, 'portfolio_projects', limit)
}

/** Journal articles. The table arrives in Phase 18; until then this returns null. */
export async function listReferenceArticles(
  client: Client,
  limit: number,
): Promise<ReferenceRow[] | null> {
  return readMaybeMissing(client, 'journal_articles', limit)
}
