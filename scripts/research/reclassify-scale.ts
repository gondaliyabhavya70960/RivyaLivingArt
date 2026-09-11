#!/usr/bin/env tsx
/**
 * research:reclassify-scale — re-run the SCALE RULES over stored rows, with **zero network traffic**.
 *
 *   npx tsx scripts/research/reclassify-scale.ts
 *   npx tsx scripts/research/reclassify-scale.ts --dry-run
 *   npx tsx scripts/research/reclassify-scale.ts --source=<slug> --limit=500
 *
 * THIS IS HOW A RULE EDIT REACHES THE CORPUS, AND IT IS THE REASON THE CLASSIFIER IS PURE.
 * `lib/scraper/analytics/scale.ts` takes stored dimensions, a parse state, a category flag and a
 * rule list, and returns a band. None of that needs a page re-fetched, so lowering a threshold and
 * applying it to eighteen months of stored evidence costs one command and no requests to anybody's
 * server. The third of the three offline recomputation scripts, following the shape `reextract.ts`
 * set and `renormalize.ts` repeated.
 *
 * **AN EDITOR OVERRIDE IS NEVER OVERWRITTEN, AND THE SKIP IS REPORTED RATHER THAN SILENT.** A
 * researcher who corrected a band by hand did it from evidence the rules do not have — a
 * photograph, the source's own copy, knowledge of the piece — and a threshold edit two months later
 * must not quietly undo it. Reporting the count is the other half of the promise: somebody editing
 * the rules needs to know how many rows their edit did NOT reach, because that number is the
 * difference between "the rules now say X" and "the corpus now says X".
 *
 * THE PLANNER IS GIVEN NO CLIENT, so `--dry-run` is a structural fact rather than a flag somebody
 * remembered to check: `plan()` cannot write because it has nothing to write with.
 *
 * NO FETCHER IS IMPORTED AND THE ABSENCE IS ENFORCED by `tests/unit/scale-overrides.test.ts`, which
 * reads this file off disk and fails if it names a fetch module — because the failure guarded
 * against is a FUTURE EDIT ("just refresh the dimensions if they look stale"), not a bug today.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  classifyScale,
  isFrozen,
  type Classification,
  type LargeFormatSource,
  type ScaleBand,
  type ScaleRule,
} from '../../lib/scraper/analytics/scale'
import type { DimensionsMm, ParseState } from '../../lib/scraper/normalization/schema'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import {
  listClassifiableProducts,
  readScaleRules,
  writeClassification,
} from '../../lib/supabase/repositories/research/scale'

type Client = SupabaseClient<Database>

const ENV_PATH = '.env.local'

export const DEFAULT_LIMIT = 2_000
export const MAX_LIMIT = 50_000
const MAX_REPORTED_LINES = 20

export interface ReclassifyOptions {
  readonly dryRun: boolean
  readonly limit: number
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: ReclassifyOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let dryRun = false
  let limit = DEFAULT_LIMIT

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg.startsWith('--limit=')) {
      // `Number` rather than `parseInt`, because `parseInt('50x')` is 50 and a silently truncated
      // limit is the one kind of wrong an operator cannot see in the output.
      const value = Number(arg.slice('--limit='.length))
      if (!Number.isInteger(value) || value <= 0 || value > MAX_LIMIT) {
        return { ok: false, error: `--limit must be a whole number between 1 and ${MAX_LIMIT}.` }
      }
      limit = value
      continue
    }
    return { ok: false, error: `Unrecognised argument: ${arg}` }
  }

  return { ok: true, value: { dryRun, limit } }
}

/** One stored row, as the classifier needs it. */
export interface StoredScaleRow {
  readonly productId: string
  readonly dimensionsMm: DimensionsMm | null
  readonly dimensionParseState: ParseState
  readonly categoryIsLargeFormat: boolean
  readonly currentBand: ScaleBand | null
  readonly currentSource: LargeFormatSource | null
}

export interface RowPlan {
  readonly productId: string
  readonly classification: Classification | null
  /** True when the rules now place this row in a different band from the stored one. */
  readonly moved: boolean
  readonly from: ScaleBand | null
  /** True when an editor override froze the row and nothing was computed for it. */
  readonly skipped: boolean
}

export interface ReclassifyReport {
  readonly examined: number
  readonly moved: number
  readonly unchanged: number
  readonly skipped: number
  readonly written: number
  readonly movements: ReadonlyArray<{
    readonly productId: string
    readonly from: ScaleBand | null
    readonly to: ScaleBand
  }>
}

/**
 * What re-running the rules WOULD do. Given no client, so it cannot do it.
 *
 * A FROZEN ROW IS PLANNED AS A SKIP RATHER THAN OMITTED. Omitting it would make `examined` smaller
 * than the row count and the report would quietly describe a subset — the very thing the skip
 * count exists to make visible.
 */
export function plan(rows: readonly StoredScaleRow[], rules: readonly ScaleRule[]): RowPlan[] {
  return rows.map((row) => {
    if (isFrozen(row.currentSource)) {
      return {
        productId: row.productId,
        classification: null,
        moved: false,
        from: row.currentBand,
        skipped: true,
      }
    }

    const classification = classifyScale(
      {
        dimensionsMm: row.dimensionsMm,
        dimensionParseState: row.dimensionParseState,
        categoryIsLargeFormat: row.categoryIsLargeFormat,
      },
      rules,
    )

    return {
      productId: row.productId,
      classification,
      moved: classification.band !== row.currentBand,
      from: row.currentBand,
      skipped: false,
    }
  })
}

/** Apply only what `plan()` proposed. */
export async function apply(
  admin: Client,
  plans: readonly RowPlan[],
  actorUserId: string | null = null,
): Promise<number> {
  let written = 0
  for (const entry of plans) {
    if (entry.skipped || entry.classification === null) continue
    await writeClassification(admin, {
      productId: entry.productId,
      band: entry.classification.band,
      isLargeFormat: entry.classification.isLargeFormat,
      longestAxisMm: entry.classification.longestAxisMm,
      source: entry.classification.source,
      ruleId: entry.classification.ruleId,
      actorUserId,
    })
    written += 1
  }
  return written
}

export function summarise(plans: readonly RowPlan[], written: number): ReclassifyReport {
  const skipped = plans.filter((entry) => entry.skipped).length
  const moved = plans.filter((entry) => entry.moved)
  return {
    examined: plans.length,
    moved: moved.length,
    unchanged: plans.length - skipped - moved.length,
    skipped,
    written,
    movements: moved.flatMap((entry) =>
      entry.classification === null
        ? []
        : [{ productId: entry.productId, from: entry.from, to: entry.classification.band }],
    ),
  }
}

function createServiceRoleClient(): Client {
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function loadLocalEnv(): void {
  if (!existsSync(ENV_PATH)) return
  try {
    process.loadEnvFile(ENV_PATH)
  } catch (error) {
    // The name of the problem, never its contents: that file holds live secrets.
    console.error(
      `Could not read ${ENV_PATH}: ${error instanceof Error ? error.message : 'unknown'}`,
    )
    process.exit(1)
  }
}

const BANDS = new Set<string>([
  'DINING',
  'CONSOLE',
  'COFFEE',
  'SEATING',
  'SIDE',
  'MONUMENTAL',
  'WALL',
  'UNKNOWN',
])

function readDimensions(value: unknown): DimensionsMm | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'number' && Number.isFinite(entry) && entry > 0) out[key] = entry
  }
  return Object.keys(out).length === 0 ? null : (out as DimensionsMm)
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(`\n✗ ${parsed.error}`)
    console.error(
      '\n  Usage: npx tsx scripts/research/reclassify-scale.ts [--dry-run] [--limit=N]\n',
    )
    process.exit(1)
  }

  const options = parsed.value
  loadLocalEnv()
  const admin = createServiceRoleClient()

  const [rules, products] = await Promise.all([
    readScaleRules(admin),
    listClassifiableProducts(admin, options.limit),
  ])

  console.log(`\n▸ reclassify-scale · ${String(rules.length)} published rule(s)`)
  console.log(`  mode: ${options.dryRun ? 'dry run — nothing will be written' : 'writing'}`)
  console.log(`  ${String(products.length)} row(s), limit ${String(options.limit)}`)
  console.log('  NO REQUEST IS MADE TO ANY SOURCE. Every value below comes from stored evidence.')

  const rows: StoredScaleRow[] = products.map((row) => ({
    productId: row.id,
    dimensionsMm: readDimensions(row.dimensions_mm),
    dimensionParseState: (row.dimension_parse_state ?? 'ABSENT') as ParseState,
    // THE CATEGORY SIGNAL IS "HAS A MATCHED CATEGORY AT ALL", not a mapped large-format set, until
    // Phase 31 gives categories a large-format flag. Stated rather than guessed: rule 30 is
    // therefore currently "long, and Rivya has placed it in a category", which is weaker than the
    // phase document's wording and is the honest reading of the columns that exist today.
    categoryIsLargeFormat: row.matched_category_id !== null,
    currentBand: BANDS.has(row.scale_band ?? '') ? (row.scale_band as ScaleBand) : null,
    currentSource: (row.large_format_source as LargeFormatSource | null) ?? null,
  }))

  const plans = plan(rows, rules)
  const written = options.dryRun ? 0 : await apply(admin, plans)
  const report = summarise(plans, written)

  console.log(`\n  examined     ${String(report.examined)}`)
  console.log(`  moved band   ${String(report.moved)}`)
  console.log(`  unchanged    ${String(report.unchanged)}`)
  console.log(
    `  skipped      ${String(report.skipped)} row(s) — a person set these by hand and the rules left them alone`,
  )
  console.log(`  written      ${String(report.written)}`)

  if (report.movements.length > 0) {
    console.log(`\n  ${String(report.movements.length)} row(s) move band:`)
    for (const movement of report.movements.slice(0, MAX_REPORTED_LINES)) {
      console.log(`    ${movement.productId}: ${movement.from ?? 'unclassified'} → ${movement.to}`)
    }
  }
  console.log('')
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
