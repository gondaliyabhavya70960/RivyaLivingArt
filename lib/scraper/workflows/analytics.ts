import type { SupabaseClient } from '@supabase/supabase-js'

import { computeAssortment, type AssortmentResult } from '@/lib/scraper/analytics/assortment'
import type { BandRule } from '@/lib/scraper/analytics/bands'
import type { CoverageRecord } from '@/lib/scraper/analytics/coverage'
import { computeDimensions, type DimensionsResult } from '@/lib/scraper/analytics/dimensions'
import {
  computePriceArchitecture,
  splitByCurrency,
  type PriceArchitectureResult,
} from '@/lib/scraper/analytics/price-architecture'
import type { AnalyticsRow } from '@/lib/scraper/analytics/rows'
import type { Database } from '@/lib/supabase/database.types'
import {
  latestRunId,
  listAnalyticsRows,
  listMembers,
  markSetComputed,
  writeSnapshot,
  type AnalyticsScope,
} from '@/lib/supabase/repositories/research/analytics'
import { listCategories } from '@/lib/supabase/repositories/categories'
import {
  ANALYTICS_PAYLOAD_VERSION,
  type AnalyticsPayload,
  type MetricFamily,
  type ScopeType,
} from '@/lib/supabase/schemas/research-analytics'

type Client = SupabaseClient<Database>

/**
 * Compute the three analyses over a scope and write one snapshot per (family, currency).
 *
 * THIS IS THE ONE PLACE A SNAPSHOT IS PRODUCED. The CLI, the nightly cron and the Studio recompute
 * action all call `snapshotScope`; nothing else writes `research_analytics_snapshots`. A second
 * path would be a second definition of "the corpus as of last night".
 *
 * THE CURRENCY SPLIT HAPPENS HERE, BEFORE `computePriceArchitecture` IS CALLED. That function
 * throws on mixed input; this function groups by currency first and writes one PRICE_ARCHITECTURE
 * snapshot per currency, so a two-currency corpus produces two price snapshots and never a
 * combined row — the schema's unique key has nowhere to put one.
 *
 * TWO CLIENTS, DELIBERATELY. The rows are READ as whoever asked (`reader`), so a Studio recompute
 * sees exactly what the person could see; the snapshot is WRITTEN as the system (`admin`), because
 * the snapshot tables have no session write policy. The CLI and the cron pass the admin client for
 * both, which is the same thing the service role always was.
 */

export interface SnapshotTarget {
  readonly scopeType: ScopeType
  readonly scopeId: string | null
  readonly scope: AnalyticsScope
  readonly bandRule: BandRule
  readonly bandEdges: readonly number[] | null
}

export interface ComputedFamily {
  readonly family: MetricFamily
  readonly currency: string | null
  readonly rowCount: number
  readonly coverage: readonly CoverageRecord[]
  readonly result: AssortmentResult | PriceArchitectureResult | DimensionsResult
}

export interface SnapshotOutcome {
  readonly target: SnapshotTarget
  readonly rows: number
  readonly computedAt: string
  readonly families: readonly ComputedFamily[]
  /** Snapshot ids written, in family order. Empty on a dry run. */
  readonly snapshotIds: readonly string[]
}

export interface SnapshotOptions {
  readonly asOf?: Date
  readonly computedBy?: string | null
  readonly dryRun?: boolean
}

/** Pure: rows in, the three families out. Exported so the CLI's `--dry-run` is the same code. */
export function computeFamilies(
  rows: readonly AnalyticsRow[],
  categories: readonly { readonly id: string; readonly slug: string }[],
  target: Pick<SnapshotTarget, 'bandRule' | 'bandEdges'>,
  asOf: Date,
): readonly ComputedFamily[] {
  const families: ComputedFamily[] = []

  const assortment = computeAssortment(rows, { asOf, categories })
  families.push({
    family: 'ASSORTMENT',
    currency: null,
    rowCount: rows.length,
    coverage: [assortment.coverage],
    result: assortment,
  })

  /*
   * ONE SNAPSHOT PER CURRENCY, AND NONE FOR THE NULL GROUP. Rows with no currency are counted
   * under `ambiguous_currency` inside every currency's coverage? No — they belong to no currency,
   * so they are folded into each group's denominator would double-count them. They are reported
   * once, under the ASSORTMENT family's row count, and the price panels state the priced rows
   * they were computed from. The currency groups are sorted so the snapshot order is stable.
   */
  const groups = splitByCurrency(rows)
  const currencies = [...groups.keys()].filter((key): key is string => key !== null).sort()
  const ambiguous = groups.get(null) ?? []
  for (const currency of currencies) {
    // The ambiguous rows are handed to every currency group so they are counted (once per panel)
    // as `ambiguous_currency` rather than vanishing — the denominator of a currency panel is
    // "rows that could have carried this currency", which includes the ones whose currency could
    // not be read.
    const priced = computePriceArchitecture([...(groups.get(currency) ?? []), ...ambiguous], {
      asOf,
      bandRule: target.bandRule,
      ...(target.bandEdges === null ? {} : { bandEdges: target.bandEdges }),
    })
    families.push({
      family: 'PRICE_ARCHITECTURE',
      currency,
      rowCount: (groups.get(currency) ?? []).length + ambiguous.length,
      coverage: [priced.coverage],
      result: priced,
    })
  }

  const dimensions = computeDimensions(rows, { asOf })
  families.push({
    family: 'DIMENSIONS',
    currency: null,
    rowCount: rows.length,
    coverage: [dimensions.coverage],
    result: dimensions,
  })

  return families
}

export async function resolveSetScope(reader: Client, setId: string): Promise<AnalyticsScope> {
  const members = await listMembers(reader, setId)
  return {
    type: 'SET',
    sourceIds: members.flatMap((member) => (member.source_id === null ? [] : [member.source_id])),
    productIds: members.flatMap((member) =>
      member.research_product_id === null ? [] : [member.research_product_id],
    ),
  }
}

export async function snapshotScope(
  reader: Client,
  admin: Client,
  target: SnapshotTarget,
  options: SnapshotOptions = {},
): Promise<SnapshotOutcome> {
  const asOf = options.asOf ?? new Date()
  const computedAt = asOf.toISOString()

  const categories = (await listCategories(reader)).map((category) => ({
    id: category.id,
    slug: category.slug,
  }))
  const slugs = new Map(categories.map((category) => [category.id, category.slug]))
  const rows = await listAnalyticsRows(reader, target.scope, slugs)
  const families = computeFamilies(rows, categories, target, asOf)

  if (options.dryRun === true) {
    return { target, rows: rows.length, computedAt, families, snapshotIds: [] }
  }

  const inputRunMaxId = await latestRunId(reader)
  const snapshotIds: string[] = []
  for (const family of families) {
    const payload: AnalyticsPayload = {
      family: family.family,
      version: ANALYTICS_PAYLOAD_VERSION,
      result: family.result as unknown as Record<string, unknown>,
      coverage: [...family.coverage],
    }
    snapshotIds.push(
      await writeSnapshot(admin, {
        scopeType: target.scopeType,
        scopeId: target.scopeId,
        metricFamily: family.family,
        currency: family.currency,
        payload,
        rowCount: family.rowCount,
        computedAt,
        computedBy: options.computedBy ?? null,
        inputRunMaxId,
        coverage: family.coverage,
      }),
    )
  }

  if (target.scopeType === 'SET' && target.scopeId !== null) {
    await markSetComputed(admin, target.scopeId, computedAt)
  }

  return { target, rows: rows.length, computedAt, families, snapshotIds }
}
