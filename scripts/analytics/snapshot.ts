#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { isMetricId, type MetricId } from '../../lib/analytics/metrics'
import { formatLine, runSnapshots } from '../../lib/analytics/snapshot'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import {
  createAnalyticsReads,
  createSnapshotWriter,
} from '../../lib/supabase/repositories/analytics'

/**
 * `npm run analytics:snapshot -- [--date=YYYY-MM-DD] [--only=<metric>] [--dry-run]` — Phase 37.
 *
 * Writes one `analytics_snapshots` row per metric for the date (today in UTC by default), and
 * prints one line per metric: availability, coverage and figure, or the named reason. `--dry-run`
 * prints the same eighteen lines and writes nothing (PHASE-31-38 §Phase 37, verification 3).
 * Running twice for one date updates rather than duplicates (verification 4).
 */

const ENV_PATH = '.env.local'

export interface SnapshotCliOptions {
  readonly date: string | undefined
  readonly only: MetricId | undefined
  readonly dryRun: boolean
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: SnapshotCliOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let date: string | undefined
  let only: MetricId | undefined
  let dryRun = false
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg.startsWith('--date=')) {
      date = arg.slice('--date='.length)
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(Date.parse(date))) {
        return { ok: false, error: `--date must be YYYY-MM-DD, not ${date}` }
      }
      continue
    }
    if (arg.startsWith('--only=')) {
      const id = arg.slice('--only='.length)
      if (!isMetricId(id)) return { ok: false, error: `--only names no registered metric: ${id}` }
      only = id
      continue
    }
    return { ok: false, error: `Unrecognised argument: ${arg}` }
  }
  return { ok: true, value: { date, only, dryRun } }
}

async function main(): Promise<void> {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH)
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(2)
  }
  const options = parsed.value

  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const result = await runSnapshots(
    createAnalyticsReads(admin),
    options.dryRun ? null : createSnapshotWriter(admin),
    { date: options.date, only: options.only, dryRun: options.dryRun },
  )

  for (const line of result.lines) console.log(formatLine(line))
  console.log(
    result.dryRun
      ? `\ndry run for ${result.asOf}: ${String(result.lines.length)} metric(s) evaluated, nothing written`
      : `\n${result.asOf}: ${String(result.written)} snapshot(s) written, ${String(result.pruned)} pruned beyond retention`,
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
