import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/database.types'
import { getRelations } from '@/lib/supabase/repositories/entity-relations'
import { listSameCategoryArticles } from '@/lib/supabase/repositories/journal'
import type { EntityRelation, JournalArticle } from '@/lib/supabase/schemas'

type Client = SupabaseClient<Database>

/**
 * What appears at the end of an article, and the single rule that fills it when nobody curated one.
 *
 * FEAT §11 ALLOWS EXACTLY ONE AUTOMATIC RULE, AND THIS FILE IS WHERE IT IS WRITTEN DOWN. Curated
 * edges — the ones an editor made by hand in `entity_relations` — always win and are always shown in
 * the editor's order. When there are fewer than `MINIMUM` of them, the shortfall is filled from ONE
 * source: other published articles in the same primary category, newest first, excluding this one.
 * That is the whole of it. No similarity scoring, no co-occurrence, no "readers also liked", no
 * personalisation, no invented association.
 *
 * WHY A RULE AT ALL, RATHER THAN NOTHING. An article that ends with two links looks unfinished, and
 * the pressure to fix that is what produces recommendation engines nobody asked for. Naming the one
 * permitted rule here, in one function, with a test that asserts it, is what keeps the second rule
 * from arriving quietly — the day somebody adds "or the same material", this file is where the
 * review happens.
 *
 * THE FALLBACK IS LABELLED, AND THE LABEL IS A FACT. The band renders the seeded string
 * `More in {category}` for the filled portion, never "Related" and never "You may also like": those
 * imply a judgement somebody made, and nobody did. It says what is true — these pieces share a
 * category — which is the same distinction `product.related.same_category` draws on a product page.
 *
 * IT NEVER MIXES THE TWO IN ONE UNLABELLED LIST. Curated items and rule-filled items come back as
 * separate groups, so the renderer can head them differently. Blending them would present an
 * editor's choice and a query's output as the same kind of thing.
 */

/** Below this many curated edges, the one rule fills the rest. FEAT §11's "fewer than three". */
export const MINIMUM = 3

/** What a related band gets: what a person chose, and what the rule added, kept apart. */
export type RelatedForArticle = {
  /** Hand-made edges out of this article, in the editor's order. */
  readonly curated: readonly EntityRelation[]
  /**
   * Same-category articles filling the shortfall. Empty when curation already reached `MINIMUM`,
   * when the article has no primary category, or when the category holds nothing else published.
   */
  readonly sameCategory: readonly JournalArticle[]
  /** The category the fill came from, for the `More in {category}` label. Null when nothing filled. */
  readonly sameCategoryId: string | null
}

/**
 * Curated edges first, then the one rule.
 *
 * RLS DOES THE PUBLICATION FILTERING, not this function. `listSameCategoryArticles` returns what the
 * caller's client may see, so a visitor gets published, dated articles and an editor previewing gets
 * their drafts too — from the same code. Re-testing `status` here would be a second copy of the
 * policy that could drift from it.
 *
 * THE CURATED EDGES ARE NOT RESOLVED TO ROWS HERE. `entity_relations` points at four kinds of thing
 * — products, projects, articles, collections — and each needs its own read; the caller knows which
 * of those it can render. What this function owns is the DECISION about what belongs in the band,
 * which is the part that must not drift.
 */
export async function relatedForArticle(
  client: Client,
  article: Pick<JournalArticle, 'id' | 'primary_category_id'>,
): Promise<RelatedForArticle> {
  const curated = await getRelations(client, 'JOURNAL_ARTICLE', article.id)

  const shortfall = MINIMUM - curated.length
  if (shortfall <= 0 || article.primary_category_id === null) {
    return { curated, sameCategory: [], sameCategoryId: null }
  }

  /*
   * OVER-FETCHED BY THE NUMBER OF CURATED ARTICLE EDGES, then filtered.
   *
   * A curated edge may already point at an article in the same category, and the fill must not
   * repeat it. Excluding those ids in SQL would need the list in the query; fetching `shortfall +
   * curated.length` and dropping the duplicates afterwards asks for at most three extra rows and
   * keeps the exclusion beside the reason for it.
   */
  const alreadyLinked = new Set(
    curated.filter((edge) => edge.target_type === 'JOURNAL_ARTICLE').map((edge) => edge.target_id),
  )

  const candidates = await listSameCategoryArticles(
    client,
    article.primary_category_id,
    article.id,
    shortfall + alreadyLinked.size,
  )

  const sameCategory = candidates
    .filter((candidate) => !alreadyLinked.has(candidate.id))
    .slice(0, shortfall)

  return {
    curated,
    sameCategory,
    sameCategoryId: sameCategory.length === 0 ? null : article.primary_category_id,
  }
}
