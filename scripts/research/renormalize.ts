#!/usr/bin/env tsx
/**
 * research:renormalize — re-run the NORMALIZER over stored versions, with **zero network traffic**.
 *
 *   npx tsx scripts/research/renormalize.ts --source=<slug>
 *   npx tsx scripts/research/renormalize.ts --source=<slug> --dry-run
 *   npx tsx scripts/research/renormalize.ts --source=<slug> --limit=500
 *
 * THIS IS HOW A LEXICON OR A PARSER FIX IS ROLLED OUT, AND IT IS THE REASON THE NORMALIZER IS PURE.
 * `lib/scraper/normalization/` takes a stored draft, a source's separators and a lexicon and returns
 * a value; none of those needs a page re-fetched, so correcting a rule and applying it to eighteen
 * months of stored evidence costs one command and no requests to anybody's server. A subsystem that
 * had to re-crawl to re-read would spend a competitor's goodwill to test a local change.
 *
 * IT NEVER OVERWRITES A PERSON'S CORRECTION, AND THE PROOF IS A TEST RATHER THAN THIS SENTENCE.
 * `research_products.normalized_overrides` names the keys a researcher has set by hand;
 * `applyOverrides` puts them back over the rules' answer and this script reports how many rows were
 * affected. Without that, the first lexicon fix after somebody corrected a price would silently
 * undo the correction — silently because re-normalisation is a background job over rows nobody is
 * watching. `tests/unit/renormalize-overrides.test.ts` is what holds it.
 *
 * THE SECOND OF THE THREE OFFLINE RECOMPUTATION SCRIPTS, following the shape `reextract.ts` set: a
 * pure argument parser, a read-only `plan()` that is given no way to write, and an apply step that
 * writes only what `plan()` proposed. `--dry-run` is therefore a structural fact rather than a flag
 * somebody remembered to check.
 *
 * NO FETCHER IS IMPORTED AND THE ABSENCE IS ENFORCED. `tests/unit/renormalize-overrides.test.ts`
 * reads this file off disk and fails if it names `lib/scraper/core/fetch`, `undici`, `axios` or a
 * node HTTP module — because the failure guarded against is a FUTURE EDIT ("just refresh the page
 * if the draft looks stale"), not a bug present today.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { NormalizedProduct } from '../../lib/scraper/normalization'
import { normalizeStoredVersion, readPriceExtraction } from '../../lib/scraper/validation/run'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import { readLexicon } from '../../lib/supabase/repositories/research/lexicon'
import { writeNormalizedProduct } from '../../lib/supabase/repositories/research/normalization'
import { listVersionRawByIds } from '../../lib/supabase/repositories/research/product-versions'
import { listProductsWithVersionForSource } from '../../lib/supabase/repositories/research/products'
import { listResearchSources } from '../../lib/supabase/repositories/research/sources'

type Client = SupabaseClient<Database>

const ENV_PATH = '.env.local'

export const DEFAULT_LIMIT = 500
export const MAX_LIMIT = 20_000

export interface RenormalizeOptions {
  readonly sourceSlug: string
  readonly dryRun: boolean
  readonly limit: number
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: RenormalizeOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let sourceSlug: string | null = null
  let dryRun = false
  let limit = DEFAULT_LIMIT

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg.startsWith('--source=')) {
      sourceSlug = arg.slice('--source='.length).trim()
      continue
    }
    if (arg.startsWith('--limit=')) {
      // `Number` rather than `parseInt`, because `parseInt('50x')` is 50 and a silently truncated
      // limit is the one kind of wrong an operator cannot see in the output.
      const parsed = Number(arg.slice('--limit='.length).trim())
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        return {
          ok: false,
          error: `--limit must be a whole number between 1 and ${String(MAX_LIMIT)}.`,
        }
      }
      limit = parsed
      continue
    }
    return { ok: false, error: `Unrecognised argument '${arg}'.` }
  }

  if (sourceSlug === null || sourceSlug === '') {
    return { ok: false, error: '--source=<slug> is required.' }
  }
  return { ok: true, value: { sourceSlug, dryRun, limit } }
}

/** One row's worth of stored evidence, and what a person has already decided about it. */
export interface StoredRow {
  readonly productId: string
  readonly versionId: string
  readonly raw: unknown
  readonly overrides: Record<string, unknown>
  readonly current: {
    readonly titleNormalized: string | null
    readonly priceMinMinor: number | null
    readonly materialTokens: readonly string[]
    readonly dimensionParseState: string | null
  }
}

export interface RowPlan {
  readonly productId: string
  readonly versionId: string
  /** Null when the stored draft could not be parsed — `failure` says why, and nothing is written. */
  readonly product: NormalizedProduct | null
  /** The keys a person set. Re-normalisation did not touch them; the report says how many. */
  readonly frozen: readonly string[]
  /** True when the rules now read this row differently from what is stored. */
  readonly changed: boolean
  readonly failure: string | null
}

export interface RenormalizeReport {
  readonly examined: number
  readonly changed: number
  readonly unchanged: number
  readonly frozenRows: number
  readonly frozenKeys: number
  readonly failures: ReadonlyArray<{ readonly productId: string; readonly message: string }>
  readonly written: number
}

/**
 * What re-running the rules WOULD do. Given no client, so it cannot do it.
 *
 * THE SIGNATURE IS THE GUARANTEE. `--dry-run` is not a branch this function checks; it is the
 * absence of an apply step afterwards. A planner holding a database handle would be one refactor
 * away from writing during a dry run, and the operator running one is precisely the person who
 * would not notice.
 */
export function plan(
  rows: readonly StoredRow[],
  context: {
    readonly declaredCurrency: string | null
    readonly priceExtraction: unknown
    readonly lexicon: Awaited<ReturnType<typeof readLexicon>>
  },
): readonly RowPlan[] {
  const priceExtraction = readPriceExtraction(context.priceExtraction)

  return rows.map((row) => {
    try {
      const pass = normalizeStoredVersion({
        raw: row.raw,
        config: {
          sourceId: '',
          declaredCurrency: context.declaredCurrency,
          priceExtraction,
        },
        lexicon: context.lexicon,
        overrides: row.overrides,
      })

      return {
        productId: row.productId,
        versionId: row.versionId,
        product: pass.product,
        frozen: pass.frozen,
        changed: differs(pass.product, row.current),
        failure: null,
      }
    } catch (cause) {
      /*
       * ONE MALFORMED STORED DRAFT DOES NOT STOP THE PASS. A version written before a schema
       * tightened, or a row hand-edited in SQL, would otherwise take every row behind it down with
       * it — the isolation failure Phase 27 built a whole panel around for adapters. It is reported
       * against the row that caused it and the rest of the source is re-normalised.
       */
      return {
        productId: row.productId,
        versionId: row.versionId,
        product: null,
        frozen: [],
        changed: false,
        failure: cause instanceof Error ? cause.message : 'unknown failure',
      }
    }
  })
}

/**
 * Did the rules change their mind about this row?
 *
 * FOUR FIELDS RATHER THAN A DEEP EQUALITY, and the four are the ones a rule change actually moves:
 * a title (whitespace and trimming), a price (separators), the material tokens (the lexicon) and
 * whether the dimensions parsed at all. Comparing the whole object would report a change every time
 * the normalizer version string moved, which is every rule change, which would make the report say
 * "everything changed" and therefore nothing.
 */
function differs(next: NormalizedProduct, current: StoredRow['current']): boolean {
  if (next.titleNormalized !== current.titleNormalized) return true
  if (next.priceMinMinor !== current.priceMinMinor) return true
  if (next.dimensionParseState !== current.dimensionParseState) return true

  const before = [...current.materialTokens].sort().join(',')
  const after = [...next.materialTokens].sort().join(',')
  return before !== after
}

export async function apply(admin: Client, plans: readonly RowPlan[]): Promise<number> {
  let written = 0
  for (const entry of plans) {
    if (entry.failure !== null || entry.product === null || !entry.changed) continue
    await writeNormalizedProduct(admin, {
      productId: entry.productId,
      versionId: entry.versionId,
      normalized: entry.product,
      // THE MATCH IS NOT RE-DECIDED HERE. Re-normalisation re-reads values; placing a row in Rivya's
      // taxonomy is `workflows/promote.ts`'s decision and carries a pipeline event. Passing the
      // stored values back would be a write that says a match was made on the day a parser changed.
      matchedCategoryId: null,
      matchConfidence: null,
      matchMethod: null,
    })
    written += 1
  }
  return written
}

export function summarise(plans: readonly RowPlan[], written: number): RenormalizeReport {
  const failures = plans
    .filter((entry) => entry.failure !== null)
    .map((entry) => ({ productId: entry.productId, message: entry.failure ?? 'unknown' }))
  const frozenRows = plans.filter((entry) => entry.frozen.length > 0)

  return {
    examined: plans.length,
    changed: plans.filter((entry) => entry.changed && entry.failure === null).length,
    unchanged: plans.filter((entry) => !entry.changed && entry.failure === null).length,
    frozenRows: frozenRows.length,
    frozenKeys: frozenRows.reduce((total, entry) => total + entry.frozen.length, 0),
    failures,
    written,
  }
}

/* --- The I/O half ------------------------------------------------------------------------------- */

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

/**
 * The stored evidence for one source, read through the repository layer.
 *
 * TWO ROUND TRIPS, NOT ONE PER ROW. `listProductsWithVersionForSource` returns the rows and the
 * version ids; `listVersionRawByIds` fetches every draft in one `in` list. A loop reading one
 * version at a time would make a five-hundred-row pass five hundred round trips, and because
 * nobody watches this job that cost would never be noticed — it would just take forty minutes.
 */
async function readRows(admin: Client, sourceId: string, limit: number): Promise<StoredRow[]> {
  const products = await listProductsWithVersionForSource(admin, { sourceId, limit })

  const versionIds = products
    .map((row) => row.current_version_id)
    .filter((id): id is string => id !== null)
  if (versionIds.length === 0) return []

  const versions = await listVersionRawByIds(admin, versionIds)
  const rawById = new Map(versions.map((version) => [version.id, version.raw]))

  return products.flatMap((row) => {
    const versionId = row.current_version_id
    if (versionId === null || !rawById.has(versionId)) return []
    return [
      {
        productId: row.id,
        versionId,
        raw: rawById.get(versionId),
        overrides:
          typeof row.normalized_overrides === 'object' &&
          row.normalized_overrides !== null &&
          !Array.isArray(row.normalized_overrides)
            ? (row.normalized_overrides as Record<string, unknown>)
            : {},
        current: {
          titleNormalized: row.title_normalized,
          priceMinMinor: row.price_min_minor,
          materialTokens: row.material_tokens,
          dimensionParseState: row.dimension_parse_state,
        },
      },
    ]
  })
}

/** How many per-row lines the summary prints before it stops listing them. */
const MAX_REPORTED_LINES = 20

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(`\n✗ ${parsed.error}`)
    console.error(
      '\n  Usage: npx tsx scripts/research/renormalize.ts --source=<slug> [--dry-run] [--limit=N]\n',
    )
    process.exit(1)
  }

  const options = parsed.value
  loadLocalEnv()
  const admin = createServiceRoleClient()

  const sources = await listResearchSources(admin)
  const source = sources.find((entry) => entry.slug === options.sourceSlug) ?? null
  if (source === null) {
    console.error(`\n✗ No research source is configured with the slug '${options.sourceSlug}'.\n`)
    process.exit(1)
  }

  const [rows, lexicon] = await Promise.all([
    readRows(admin, source.id, options.limit),
    readLexicon(admin),
  ])

  console.log(`\n▸ renormalize · source ${source.slug} · ${String(lexicon.length)} lexicon term(s)`)
  console.log(`  mode: ${options.dryRun ? 'dry run — nothing will be written' : 'writing'}`)
  console.log(
    `  ${String(rows.length)} row(s) with a stored version, limit ${String(options.limit)}`,
  )
  console.log('  NO REQUEST IS MADE TO ANY SOURCE. Every value below comes from stored evidence.')

  const plans = plan(rows, {
    declaredCurrency: source.currency,
    priceExtraction: source.price_extraction,
    lexicon,
  })

  const written = options.dryRun ? 0 : await apply(admin, plans)
  const report = summarise(plans, written)

  console.log(`\n  examined     ${String(report.examined)}`)
  console.log(`  changed      ${String(report.changed)}`)
  console.log(`  unchanged    ${String(report.unchanged)}`)
  console.log(`  written      ${String(report.written)}`)
  console.log(
    `  frozen       ${String(report.frozenKeys)} key(s) across ${String(report.frozenRows)} row(s) — ` +
      'a person set these by hand and re-normalisation left them alone',
  )

  if (report.failures.length > 0) {
    console.log(`\n  ${String(report.failures.length)} row(s) could not be re-normalised:`)
    for (const failure of report.failures.slice(0, MAX_REPORTED_LINES)) {
      console.log(`    ${failure.productId}: ${failure.message}`)
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
