import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { rawProductDraftSchema } from '@/lib/scraper/adapters/draft-schema'
import type { CategoryMapping } from '@/lib/scraper/core/category-map'
import { moveStage } from '@/lib/scraper/core/stage'
import type { DimensionsMm } from '@/lib/scraper/normalization'
import {
  loadLexicon,
  normalizeStoredVersion,
  readPriceExtraction,
  validateAndRecord,
  type SourceNormalizationConfig,
} from '@/lib/scraper/validation/run'
import { listCategories } from '@/lib/supabase/repositories/categories'
import {
  frozenKeys,
  writeNormalizedProduct,
} from '@/lib/supabase/repositories/research/normalization'
import { getProductVersionById } from '@/lib/supabase/repositories/research/product-versions'
import {
  getProductForPromotion,
  listPromotableIds,
  listSiblingsInSource,
  listUrlPeersInSource,
  type ResearchStage,
} from '@/lib/supabase/repositories/research/products'
import { listCategoryMappings } from '@/lib/supabase/repositories/research/source-config'
import { getSourceParsingConfig } from '@/lib/supabase/repositories/research/sources'
import { listBlockingRules } from '@/lib/supabase/repositories/research/validation-issues'
import type { Database } from '@/lib/supabase/database.types'

import {
  applyDuplicateProposals,
  matchTaxonomy,
  type CategoryTerm,
  type DuplicateSubject,
} from './match'

type Client = SupabaseClient<Database>

/**
 * `RAW → NORMALIZED → VALIDATED → MATCHED`, **one stage per pass**.
 *
 * ONE STAGE PER CALL IS THE WHOLE DESIGN AND IT IS NOT A THROUGHPUT COMPROMISE. Each stage has a
 * phase that owns it, a set of rules that decide it, and a pipeline event that records it; a
 * function that ran all three would write one event for three decisions and would make "why did
 * this row stop" unanswerable — because it never stopped anywhere, it just came out the far end in
 * whatever state the last rule left it. Running the pass three times to move a row three stages
 * costs three reads and buys a history somebody can read.
 *
 * A ROW THAT CANNOT MOVE IS NOT AN ERROR. `VALIDATED` with an ERROR attached is the correct resting
 * place for a row Rivya could not read properly, and `VALIDATED` with `missing_category_mapping` is
 * the correct resting place for a row nobody has taught the map about. Both are counted, both are
 * listed, and both move the moment the reason clears. Nothing is deleted and nothing is promoted
 * past a reason it has not answered.
 *
 * THE STAGE IS WRITTEN BY `core/stage.ts` AND NOWHERE ELSE, including from here. That module is the
 * only importer of `writeProductStage` and the guard script enforces it, so every transition this
 * file makes carries its event.
 */

export type PromotionStep = 'NORMALIZED' | 'VALIDATED' | 'MATCHED' | 'HELD' | 'DONE'

export interface PromotionResult {
  readonly productId: string
  readonly from: ResearchStage
  readonly step: PromotionStep
  /** Why a `HELD` row is held: the blocking rule names, or `no_version`. */
  readonly heldBy: readonly string[]
  readonly frozen: readonly string[]
}

/** Everything a pass over one source needs, read once rather than once per row. */
export interface PromotionContext {
  readonly config: SourceNormalizationConfig
  readonly mappings: readonly CategoryMapping[]
  readonly categories: readonly CategoryTerm[]
  readonly lexicon: Awaited<ReturnType<typeof loadLexicon>>
}

export async function loadPromotionContext(
  admin: Client,
  sourceId: string,
): Promise<PromotionContext> {
  const [source, mappingRows, categories, lexicon] = await Promise.all([
    getSourceParsingConfig(admin, sourceId),
    listCategoryMappings(admin, sourceId),
    listCategories(admin),
    loadLexicon(admin),
  ])

  if (source === null) throw new Error(`research source ${sourceId} could not be read.`)

  return {
    config: {
      sourceId,
      declaredCurrency: source.currency,
      priceExtraction: readPriceExtraction(source.priceExtraction),
    },
    mappings: mappingRows.map((row) => ({
      id: row.id,
      sourceLabel: row.source_label,
      sourcePath: row.source_path,
      categoryId: row.category_id,
      isIgnored: row.is_ignored,
    })),
    categories: categories.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
    lexicon,
  }
}

/**
 * Move one row exactly one step, or explain why it did not.
 *
 * THE VERSION IS THE EVIDENCE AND A ROW WITHOUT ONE CANNOT BE NORMALISED. That is not a failure
 * either: a product discovered by a listing crawl has a URL and no page read yet, and the honest
 * thing is to leave it at `RAW` until one is. Inventing a normalised row from a URL would put a
 * title in a comparison table that no page ever printed.
 */
export async function promoteProduct(
  admin: Client,
  input: {
    readonly productId: string
    readonly context: PromotionContext
    readonly actorUserId?: string | null
  },
): Promise<PromotionResult> {
  const actorUserId = input.actorUserId ?? null
  const product = await getProductForPromotion(admin, input.productId)
  const from = product.stage

  if (from !== 'RAW' && from !== 'NORMALIZED' && from !== 'VALIDATED') {
    // Past MATCHED the row belongs to Phase 29's review and Phase 35's confirmation. This function
    // does not reach into them, and a pass that met such a row has simply finished with it.
    return { productId: input.productId, from, step: 'DONE', heldBy: [], frozen: [] }
  }

  const versionId = product.current_version_id
  if (versionId === null) {
    return { productId: input.productId, from, step: 'HELD', heldBy: ['no_version'], frozen: [] }
  }

  const version = await getProductVersionById(admin, versionId)
  if (version === null) {
    // A pointer at a version that is gone. Not an error to raise: `current_version_id` is
    // `on delete set null`, so this is a row read between a delete and its cascade — held rather
    // than failed, and the next pass sees whichever state settled.
    return { productId: input.productId, from, step: 'HELD', heldBy: ['no_version'], frozen: [] }
  }

  const overrides = readOverrides(product.normalized_overrides)
  const pass = normalizeStoredVersion({
    raw: version.raw,
    config: input.context.config,
    lexicon: input.context.lexicon,
    overrides,
  })
  const frozen = frozenKeys(product.normalized_overrides)

  const taxonomy = matchTaxonomy(
    pass.product.categoryLabels,
    input.context.mappings,
    input.context.categories,
  )

  if (from === 'RAW') {
    await writeNormalizedProduct(admin, {
      productId: input.productId,
      versionId,
      normalized: pass.product,
      // THE CATEGORY IS NOT WRITTEN AT THIS STAGE even though it has been resolved. `NORMALIZED`
      // means the values were read; `MATCHED` means they were placed. Writing the match here would
      // make a row that never reached MATCHED still carry a category, and the stage would stop
      // meaning what it says.
      matchedCategoryId: null,
      matchConfidence: null,
      matchMethod: null,
    })
    await moveStage(admin, {
      productId: input.productId,
      to: 'NORMALIZED',
      actor: { userId: actorUserId },
      reason: `Normalised by rules ${pass.product.normalizerVersion}.`,
    })
    return { productId: input.productId, from, step: 'NORMALIZED', heldBy: [], frozen }
  }

  if (from === 'NORMALIZED') {
    const earlier = await findEarlierRowWithSameUrl(admin, {
      sourceId: product.source_id,
      sourceUrl: product.source_url,
      productId: input.productId,
      firstSeenAt: product.first_seen_at,
    })

    const outcome = await validateAndRecord(admin, {
      productId: input.productId,
      versionId,
      draft: rawProductDraftSchema.parse(version.raw),
      pass,
      sourceUrl: product.source_url,
      duplicateOfEarlierId: earlier,
      categoryMapped: taxonomy.categoryId !== null || taxonomy.ignored,
    })

    /*
     * THE ROW REACHES `VALIDATED` WHETHER OR NOT IT PASSED, AND THAT IS THE POINT OF THE STAGE.
     * `VALIDATED` means "judged", not "clean". A row held at `NORMALIZED` because it failed would
     * be indistinguishable from one nobody has got to yet, and the count of things needing
     * attention would be a count of two different things added together.
     */
    await moveStage(admin, {
      productId: input.productId,
      to: 'VALIDATED',
      actor: { userId: actorUserId },
      reason:
        outcome.issues.length === 0
          ? 'Validated with no findings.'
          : `Validated with ${String(outcome.issues.length)} finding(s).`,
    })
    return { productId: input.productId, from, step: 'VALIDATED', heldBy: outcome.blocking, frozen }
  }

  // from === 'VALIDATED'
  const blocking = await listBlockingRules(admin, input.productId)
  if (blocking.length > 0) {
    return { productId: input.productId, from, step: 'HELD', heldBy: blocking, frozen }
  }
  if (taxonomy.categoryId === null) {
    // `missing_category_mapping` is a WARNING and does not block `VALIDATED` — but `MATCHED` is
    // literally the stage that says a category was found, so a row without one cannot be at it.
    return {
      productId: input.productId,
      from,
      step: 'HELD',
      heldBy: ['missing_category_mapping'],
      frozen,
    }
  }

  await writeNormalizedProduct(admin, {
    productId: input.productId,
    versionId,
    normalized: pass.product,
    matchedCategoryId: taxonomy.categoryId,
    matchConfidence: taxonomy.confidence,
    matchMethod: taxonomy.method,
  })

  const siblingRows = await listSiblingsInSource(admin, {
    sourceId: product.source_id,
    excludeId: input.productId,
  })
  const siblings: readonly DuplicateSubject[] = siblingRows.map((row) => ({
    id: row.id,
    externalId: row.source_external_id,
    titleNormalized: row.title_normalized,
    currency: row.currency,
    priceMinMinor: row.price_min_minor,
    dimensionsMm: (row.dimensions_mm ?? null) as DimensionsMm | null,
    firstSeenAt: row.first_seen_at,
  }))

  await applyDuplicateProposals(admin, {
    subject: {
      id: input.productId,
      externalId: product.source_external_id,
      titleNormalized: pass.product.titleNormalized,
      currency: pass.product.currency,
      priceMinMinor: pass.product.priceMinMinor,
      dimensionsMm: pass.product.dimensionsMm,
      firstSeenAt: product.first_seen_at,
    },
    siblings,
  })

  await moveStage(admin, {
    productId: input.productId,
    to: 'MATCHED',
    actor: { userId: actorUserId },
    reason: `Matched by ${taxonomy.method ?? 'MAP'} at ${String(taxonomy.confidence ?? 1)}.`,
  })
  return { productId: input.productId, from, step: 'MATCHED', heldBy: [], frozen }
}

function readOverrides(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * An OLDER row in the same source holding the same address.
 *
 * `research_products_unique_per_source` ALREADY FORBIDS ONE, which makes this look redundant — and
 * it is not, for the reason every rule in this phase is stated twice. The constraint is on
 * `(source_id, source_url)` AS STORED; a source that serves the same product at two addresses
 * differing by a tracking parameter produces two rows the constraint is happy with and a person is
 * not. This finds the second kind, and the RULE reports it rather than the database refusing it.
 */
async function findEarlierRowWithSameUrl(
  admin: Client,
  input: {
    readonly sourceId: string
    readonly sourceUrl: string
    readonly productId: string
    readonly firstSeenAt: string
  },
): Promise<string | null> {
  const canonical = stripTracking(input.sourceUrl)
  const peers = await listUrlPeersInSource(admin, {
    sourceId: input.sourceId,
    excludeId: input.productId,
    noLaterThan: input.firstSeenAt,
  })
  const match = peers.find((row) => stripTracking(row.source_url) === canonical)
  return match?.id ?? null
}

/**
 * The parameters that identify a CAMPAIGN rather than a product.
 *
 * A CLOSED LIST, NOT A HEURISTIC. Dropping every query parameter would collapse `?variant=oak` and
 * `?variant=walnut` into one row, which is two products merged; dropping none makes every
 * newsletter link a new product. Naming the tracking parameters is the only reading that is right
 * in both directions, and a parameter nobody listed simply keeps the rows apart — the safe failure.
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
  '_gl',
]

export function stripTracking(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of TRACKING_PARAMS) parsed.searchParams.delete(key)
    parsed.hash = ''
    parsed.searchParams.sort()
    return parsed.toString().replace(/\/$/u, '')
  } catch {
    // Not a URL this runtime can parse. Comparing the raw strings keeps two rows apart unless they
    // are character-identical, which is the safe direction — see the note on the parameter list.
    return url.trim()
  }
}

/**
 * One pass over a source: every eligible row moves at most one stage.
 *
 * ROWS ARE PROCESSED IN ORDER AND FAILURES DO NOT STOP THE PASS. One malformed stored draft — a
 * version written before a schema tightened, a hand-edited row — would otherwise hold back every
 * row behind it, which is the isolation failure Phase 27 spent a whole panel on for adapters. The
 * failure is returned with the row that caused it.
 */
export async function promoteSource(
  admin: Client,
  input: {
    readonly sourceId: string
    readonly limit?: number
    readonly actorUserId?: string | null
  },
): Promise<{
  readonly results: readonly PromotionResult[]
  readonly failures: ReadonlyArray<{ readonly productId: string; readonly message: string }>
}> {
  const context = await loadPromotionContext(admin, input.sourceId)
  const ids = await listPromotableIds(admin, { sourceId: input.sourceId, limit: input.limit })

  const results: PromotionResult[] = []
  const failures: Array<{ productId: string; message: string }> = []

  for (const productId of ids) {
    try {
      results.push(
        await promoteProduct(admin, {
          productId,
          context,
          actorUserId: input.actorUserId ?? null,
        }),
      )
    } catch (cause) {
      failures.push({
        productId,
        message: cause instanceof Error ? cause.message : 'unknown failure',
      })
    }
  }

  return { results, failures }
}
