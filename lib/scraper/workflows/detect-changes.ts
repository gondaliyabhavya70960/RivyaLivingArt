import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { rawProductDraftSchema } from '@/lib/scraper/adapters/draft-schema'
import { diffVersions, type VersionSide } from '@/lib/scraper/analytics/diff'
import type { ChangeRule } from '@/lib/scraper/analytics/materiality'
import { normalizedProductSchema } from '@/lib/scraper/normalization/schema'
import { readChangeRules } from '@/lib/supabase/repositories/research/change-rules'
import { recordChanges, type DetectedChange } from '@/lib/supabase/repositories/research/changes'
import { listVersionsForProduct } from '@/lib/supabase/repositories/research/product-versions'
import type { Database } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

/**
 * The half of change detection that touches the world: read two versions, run the pure diff over
 * them, store what it found.
 *
 * SPLIT FROM `analytics/diff.ts` AND `analytics/materiality.ts` FOR `validation/run.ts`'s REASON.
 * Every judgement this subsystem makes about a competitor is going to be argued with, and an
 * argument is only settleable if the rule can be put beside its input in a unit test with no
 * database at all. This file is the plumbing; it contains no judgement of its own.
 *
 * IT NEVER MOVES A STAGE. A row at `SHORTLISTED` whose price moves stays `SHORTLISTED` and gains a
 * change; a row at `MATCHED` stays there. `lib/scraper/core/stage.ts` remains the only writer of
 * `stage` and only a person calls into it, through `review-actions.ts`. This is the phase document's
 * rule and it is worth stating where somebody might be tempted: detection knows a great deal about
 * what happened and nothing about what it means.
 *
 * IT NEVER TOUCHES A RIVYA TABLE. Not `products`, not `product_media`, not `media_assets`, not
 * `product_specs`, not `product_materials` — the first of FEAT §25's four never-auto-import
 * guarantees, enforced by `scripts/research/check-no-autoimport.mjs` rather than asserted here.
 */

/** What the detector did, for the run log and the cron route's slice accounting. */
export interface DetectionOutcome {
  readonly productsExamined: number
  readonly productsWithChanges: number
  readonly changesRecorded: number
  /** Products skipped because they have only one version — nothing to compare against. */
  readonly productsWithoutHistory: number
}

const EMPTY: DetectionOutcome = {
  productsExamined: 0,
  productsWithChanges: 0,
  changesRecorded: 0,
  productsWithoutHistory: 0,
}

/**
 * A stored version, parsed back into the shapes the differ expects.
 *
 * PARSED, NOT CAST, AND A FAILURE IS A SKIP RATHER THAN A THROW. These are jsonb columns written by
 * an earlier phase of the pipeline, possibly by an earlier version of the schema; `raw` is
 * guaranteed to be an object by a CHECK constraint and nothing more. A version whose payload no
 * longer satisfies today's schema is a real thing that will happen the first time a field is added,
 * and the right response is to leave that product undiffed and carry on with the rest — not to stop
 * the nightly detection pass for every source because one row from 2026 is missing a key.
 *
 * `normalized` MAY LEGITIMATELY BE NULL. A version extracted but not yet normalised has none, and
 * the differ handles it: eight of the eleven fields read from it, and a null side means those
 * fields are absent rather than changed.
 */
function toSide(row: {
  id: string
  raw: unknown
  normalized: unknown
  storage_key: string | null
}): VersionSide | null {
  const raw = rawProductDraftSchema.safeParse(row.raw)
  if (!raw.success) return null

  const normalized =
    row.normalized === null ? null : normalizedProductSchema.safeParse(row.normalized)

  return {
    versionId: row.id,
    raw: raw.data,
    normalized: normalized === null || !normalized.success ? null : normalized.data,
    storageKey: row.storage_key,
  }
}

/**
 * Detect changes for one product, between its two most recent versions.
 *
 * TWO VERSIONS, NOT ALL OF THEM. A version exists only where the content hash differed, so the two
 * most recent are by construction the last two times the page said something different — and
 * diffing every historical pair would re-answer questions already answered and stored, on every
 * pass, forever.
 *
 * A PRODUCT WITH ONE VERSION IS NOT A PRODUCT WITH NO CHANGES. It is a product first seen; there is
 * nothing to compare it against, and inventing a comparison against an empty version would report
 * eleven `ADDED` changes for every new row a source publishes, which is the fastest possible way to
 * make the queue useless.
 */
export async function detectChangesForProduct(
  client: Client,
  admin: Client,
  input: {
    readonly productId: string
    readonly sourceId: string
    readonly runId: string | null
    readonly rules: readonly ChangeRule[]
  },
): Promise<DetectionOutcome> {
  const versions = await listVersionsForProduct(client, input.productId, 2)
  if (versions.length < 2) {
    return { ...EMPTY, productsExamined: 1, productsWithoutHistory: 1 }
  }

  const [newer, older] = versions
  if (newer === undefined || older === undefined) {
    return { ...EMPTY, productsExamined: 1, productsWithoutHistory: 1 }
  }

  const after = toSide(newer)
  const before = toSide(older)
  if (after === null || before === null) {
    return { ...EMPTY, productsExamined: 1, productsWithoutHistory: 1 }
  }

  const changes = diffVersions(before, after, input.rules, input.sourceId)
  if (changes.length === 0) return { ...EMPTY, productsExamined: 1 }

  const rows: DetectedChange[] = changes.map((change) => ({
    productId: input.productId,
    sourceId: input.sourceId,
    field: change.field,
    changeKind: change.changeKind,
    materiality: change.materiality,
    before: change.before ?? null,
    after: change.after ?? null,
    versionBeforeId: before.versionId,
    versionAfterId: after.versionId,
    runId: input.runId,
    snapshotBeforeKey: before.storageKey,
    snapshotAfterKey: after.storageKey,
  }))

  const recorded = await recordChanges(admin, rows)
  return {
    productsExamined: 1,
    productsWithChanges: 1,
    changesRecorded: recorded,
    productsWithoutHistory: 0,
  }
}

/**
 * A bounded slice of detection, for the cron route.
 *
 * BOUNDED BECAUSE VERCEL'S CRON IS, and because a detection pass that tries to do everything is a
 * pass that does nothing when it times out halfway. The caller supplies the product list — the
 * drain loop already knows which products a run touched — and this does the work for them.
 *
 * THE RULES ARE READ ONCE FOR THE WHOLE SLICE. Eleven fields and a handful of overrides is a small
 * table, and reading it per product would put a network round trip inside the loop for a value that
 * cannot change during it.
 */
export async function detectChangesForProducts(
  client: Client,
  admin: Client,
  input: {
    readonly products: readonly { readonly id: string; readonly sourceId: string }[]
    readonly runId: string | null
  },
): Promise<DetectionOutcome> {
  if (input.products.length === 0) return EMPTY

  const rules = await readChangeRules(client)

  let outcome = EMPTY
  for (const product of input.products) {
    const one = await detectChangesForProduct(client, admin, {
      productId: product.id,
      sourceId: product.sourceId,
      runId: input.runId,
      rules,
    })
    outcome = {
      productsExamined: outcome.productsExamined + one.productsExamined,
      productsWithChanges: outcome.productsWithChanges + one.productsWithChanges,
      changesRecorded: outcome.changesRecorded + one.changesRecorded,
      productsWithoutHistory: outcome.productsWithoutHistory + one.productsWithoutHistory,
    }
  }
  return outcome
}
