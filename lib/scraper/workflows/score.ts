import type { SupabaseClient } from '@supabase/supabase-js'

import type { ScoringContext, ScoringRow } from '@/lib/scraper/analytics/opportunity/context'
import type { ScoringModel } from '@/lib/scraper/analytics/opportunity/model'
import { scoreRow, type ScoreResult } from '@/lib/scraper/analytics/opportunity/score'
import type { Database } from '@/lib/supabase/database.types'
import { listCategories } from '@/lib/supabase/repositories/categories'
import { latestSnapshots } from '@/lib/supabase/repositories/research/analytics'
import {
  buildScoringContext,
  getActiveScoringModel,
  getScoringModelByVersion,
  listScoringRows,
  toScoringModel,
  writeScore,
} from '@/lib/supabase/repositories/research/opportunity'

type Client = SupabaseClient<Database>

/**
 * Score the corpus — or one source — under a model, and store one row plus seven components per
 * product.
 *
 * THIS IS THE ONE PLACE A SCORE IS PRODUCED. `npm run research:score`, the nightly cron and the
 * Studio recompute action call `scoreScope`; nothing else writes `research_opportunity_scores`.
 *
 * RECOMPUTATION IS EXPLICIT. Nothing recomputes on read: the opportunities table renders stored
 * rows, the drawer renders stored components, and the header states which model and which run
 * produced them.
 *
 * THE MODEL IS THE ACTIVE ONE UNLESS A VERSION IS NAMED. A dry run over a DRAFT is how a person
 * sees what activating it would do row by row; a stored run over a DRAFT is refused, because a
 * stored score must point at a model that cannot change under it.
 */

export interface ScoreScopeOptions {
  readonly modelVersion?: string
  readonly sourceId?: string
  readonly dryRun?: boolean
  readonly computedBy?: string | null
  readonly asOf?: Date
}

export interface ScoredRowOutcome {
  readonly row: ScoringRow
  readonly result: ScoreResult
  readonly scoreId: string | null
}

export interface ScoreScopeOutcome {
  readonly model: ScoringModel
  readonly computedAt: string
  readonly rows: number
  readonly scored: number
  readonly insufficient: number
  readonly written: number
  readonly outcomes: readonly ScoredRowOutcome[]
}

export class NoActiveModelError extends Error {
  constructor() {
    super(
      'no ACTIVE scoring model; activate one at /studio/research/opportunities or name a version',
    )
    this.name = 'NoActiveModelError'
  }
}

export class DraftModelStoreError extends Error {
  constructor(version: string) {
    super(
      `model ${version} is a DRAFT; a stored score must point at a model that cannot change. Use --dry-run.`,
    )
    this.name = 'DraftModelStoreError'
  }
}

export async function resolveModel(reader: Client, version?: string): Promise<ScoringModel> {
  const row =
    version === undefined
      ? await getActiveScoringModel(reader)
      : await getScoringModelByVersion(reader, version)
  if (row === null) {
    if (version === undefined) throw new NoActiveModelError()
    throw new Error(`no scoring model with version ${version}`)
  }
  return toScoringModel(row)
}

/** Pure over the gathered inputs; exported so a dry run and a stored run are the same arithmetic. */
export function scoreRows(
  rows: readonly ScoringRow[],
  context: ScoringContext,
  model: ScoringModel,
): readonly ScoredRowOutcome[] {
  return rows.map((row) => ({ row, result: scoreRow(row, context, model), scoreId: null }))
}

export async function scoreScope(
  reader: Client,
  admin: Client,
  options: ScoreScopeOptions = {},
): Promise<ScoreScopeOutcome> {
  const asOf = options.asOf ?? new Date()
  const computedAt = asOf.toISOString()
  const model = await resolveModel(reader, options.modelVersion)
  if (options.dryRun !== true && model.lifecycle === 'DRAFT')
    throw new DraftModelStoreError(model.version)

  const categories = (await listCategories(reader)).map((category) => ({
    id: category.id,
    slug: category.slug,
  }))
  const slugs = new Map(categories.map((category) => [category.id, category.slug]))
  const rows = await listScoringRows(reader, slugs, options.sourceId)
  const context = await buildScoringContext(reader, rows, categories, asOf)
  const outcomes = scoreRows(rows, context, model)

  // The Phase 31 corpus price snapshot the band inputs are traceable to, when one exists.
  const snapshots =
    options.dryRun === true
      ? []
      : await latestSnapshots(reader, {
          scopeType: 'CORPUS',
          scopeId: null,
          metricFamily: 'PRICE_ARCHITECTURE',
        })
  const snapshotByCurrency = new Map(
    snapshots.map((snapshot) => [snapshot.currency ?? '', snapshot.id]),
  )

  let written = 0
  const stored: ScoredRowOutcome[] = []
  for (const outcome of outcomes) {
    if (options.dryRun === true) {
      stored.push(outcome)
      continue
    }
    const scoreId = await writeScore(admin, {
      productId: outcome.row.id,
      modelId: model.id,
      modelVersion: model.version,
      result: outcome.result,
      analyticsSnapshotId:
        snapshotByCurrency.get(outcome.row.currency?.toUpperCase() ?? '') ?? null,
      computedAt,
      computedBy: options.computedBy ?? null,
    })
    written += 1
    stored.push({ ...outcome, scoreId })
  }

  return {
    model,
    computedAt,
    rows: rows.length,
    scored: stored.filter((outcome) => outcome.result.state === 'SCORED').length,
    insufficient: stored.filter((outcome) => outcome.result.state === 'INSUFFICIENT_DATA').length,
    written,
    outcomes: stored,
  }
}

/** Score one row under the active model without storing — the CLI's `--explain`. */
export async function explainRow(
  reader: Client,
  productId: string,
  modelVersion?: string,
): Promise<ScoredRowOutcome | null> {
  const model = await resolveModel(reader, modelVersion)
  const categories = (await listCategories(reader)).map((category) => ({
    id: category.id,
    slug: category.slug,
  }))
  const slugs = new Map(categories.map((category) => [category.id, category.slug]))
  const rows = await listScoringRows(reader, slugs)
  const row = rows.find((candidate) => candidate.id === productId)
  if (row === undefined) return null
  const context = await buildScoringContext(reader, rows, categories, new Date())
  return { row, result: scoreRow(row, context, model), scoreId: null }
}
