#!/usr/bin/env tsx
/**
 * research:analytics — compute the three Phase 31 analyses over a scope, and optionally store them.
 *
 *   npx tsx scripts/research/analytics.ts --scope=corpus --dry-run
 *   npx tsx scripts/research/analytics.ts --scope=source:<slug> --snapshot
 *   npx tsx scripts/research/analytics.ts --scope=set:<id> --snapshot
 *
 * THE ONLY FULL-CORPUS PATH THAT RUNS ON DEMAND. The Studio reads snapshots; the cron writes them
 * nightly; this is how an operator writes one now, or sees what one would say without writing it.
 * `--dry-run` prints every coverage record — n, denominator, the reasons — and writes nothing,
 * because the honesty rule is easier to check on a terminal than on a chart.
 *
 * ZERO NETWORK TRAFFIC TO ANYBODY ELSE'S SERVER. It reads stored rows and writes stored results;
 * no fetcher is imported, and `tests/unit/analytics-cli.test.ts` asserts that by reading this file.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import { getComparisonSet } from '../../lib/supabase/repositories/research/analytics'
import { listResearchSources } from '../../lib/supabase/repositories/research/sources'
import {
  resolveSetScope,
  snapshotScope,
  type SnapshotTarget,
} from '../../lib/scraper/workflows/analytics'

type Client = SupabaseClient<Database>

const ENV_PATH = '.env.local'

export interface AnalyticsCliOptions {
  readonly scope: string
  readonly snapshot: boolean
  readonly dryRun: boolean
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: AnalyticsCliOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let scope = 'corpus'
  let snapshot = false
  let dryRun = false
  for (const arg of argv) {
    if (arg === '--snapshot') {
      snapshot = true
      continue
    }
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg.startsWith('--scope=')) {
      scope = arg.slice('--scope='.length)
      if (!/^(corpus|source:[a-z0-9-]+|set:[0-9a-f-]{36})$/u.test(scope)) {
        return {
          ok: false,
          error: `--scope must be corpus, source:<slug> or set:<uuid>, not ${scope}`,
        }
      }
      continue
    }
    return { ok: false, error: `Unrecognised argument: ${arg}` }
  }
  if (snapshot && dryRun) return { ok: false, error: '--snapshot and --dry-run exclude each other' }
  return { ok: true, value: { scope, snapshot, dryRun } }
}

async function resolveTarget(client: Client, scope: string): Promise<SnapshotTarget> {
  if (scope === 'corpus') {
    return {
      scopeType: 'CORPUS',
      scopeId: null,
      scope: { type: 'CORPUS' },
      bandRule: 'QUANTILE',
      bandEdges: null,
    }
  }
  if (scope.startsWith('source:')) {
    const slug = scope.slice('source:'.length)
    const source = (await listResearchSources(client)).find((row) => row.slug === slug)
    if (source === undefined) throw new Error(`no source with slug ${slug}`)
    return {
      scopeType: 'SOURCE',
      scopeId: source.id,
      scope: { type: 'SOURCE', sourceId: source.id },
      bandRule: 'QUANTILE',
      bandEdges: null,
    }
  }
  const id = scope.slice('set:'.length)
  const set = await getComparisonSet(client, id)
  if (set === null) throw new Error(`no comparison set with id ${id}`)
  return {
    scopeType: 'SET',
    scopeId: set.id,
    scope: await resolveSetScope(client, set.id),
    bandRule: set.band_rule,
    bandEdges: set.band_edges,
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(2)
  }
  const options = parsed.value

  if (existsSync(ENV_PATH)) {
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

  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const target = await resolveTarget(admin, options.scope)
  const outcome = await snapshotScope(admin, admin, target, {
    dryRun: !options.snapshot,
  })

  console.log(`scope     ${options.scope}`)
  console.log(`rows      ${String(outcome.rows)}`)
  console.log(`as of     ${outcome.computedAt}`)
  for (const family of outcome.families) {
    for (const coverage of family.coverage) {
      const reasons = Object.entries(coverage.excludedReasons)
        .map(([reason, count]) => `${reason}=${String(count)}`)
        .join(' ')
      console.log(
        `  ${family.family.padEnd(18)} ${(family.currency ?? '—').padEnd(4)} n=${String(coverage.n)} / ${String(coverage.denominator)} (${String(coverage.coveragePct)}%)${reasons === '' ? '' : `  excluded: ${reasons}`}`,
      )
    }
  }
  console.log(
    options.snapshot
      ? `written   ${String(outcome.snapshotIds.length)} snapshot(s)`
      : 'written   nothing (dry run — pass --snapshot to store)',
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
