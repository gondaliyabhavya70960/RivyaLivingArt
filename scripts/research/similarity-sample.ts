#!/usr/bin/env tsx
/**
 * research:similarity-sample — draw the stratified sample a precision figure must come from.
 *
 *   npx tsx scripts/research/similarity-sample.ts --out=similarity-sample.csv
 *   npx tsx scripts/research/similarity-sample.ts --per-band=50 --out=...
 *
 * NO PRECISION FIGURE MAY EXIST IN THE REPOSITORY UNLESS THIS SCRIPT PRODUCED THE SAMPLE IT CAME
 * FROM. It reads the stored pairs of every SUCCEEDED run, draws up to `--per-band` (default 50)
 * per band with a seeded shuffle so the draw is reproducible, and writes a CSV with a blank
 * `correct` column for a researcher to fill. The count of `yes` per band, the sample size and the
 * date are then transcribed into `MEASURED_PRECISION` in `lib/scraper/analytics/similarity/bands.ts`.
 *
 * TODAY IT WRITES A HEADER AND NOTHING ELSE: under amendment A33 the research hash corpus is
 * empty, so there are no pairs to sample and no precision to measure. The script says so rather
 * than inventing a sample.
 */
import { existsSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { SIMILARITY_BANDS, type SimilarityBand } from '../../lib/scraper/analytics/similarity/bands'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import {
  listSimilarityPairs,
  listSimilarityRuns,
} from '../../lib/supabase/repositories/research/similarity'
import type { SimilarityPairRow } from '../../lib/supabase/schemas/similarity'

const ENV_PATH = '.env.local'

export interface SampleOptions {
  readonly out: string
  readonly perBand: number
  readonly seed: number
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: SampleOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let out: string | null = null
  let perBand = 50
  let seed = 33
  for (const arg of argv) {
    if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length)
      continue
    }
    if (arg.startsWith('--per-band=')) {
      perBand = Number(arg.slice('--per-band='.length))
      if (!Number.isInteger(perBand) || perBand < 1)
        return { ok: false, error: '--per-band must be ≥ 1' }
      continue
    }
    if (arg.startsWith('--seed=')) {
      seed = Number(arg.slice('--seed='.length))
      if (!Number.isInteger(seed)) return { ok: false, error: '--seed must be an integer' }
      continue
    }
    return { ok: false, error: `unknown argument ${arg}` }
  }
  if (out === null || out === '') return { ok: false, error: '--out=<file.csv> is required' }
  return { ok: true, value: { out, perBand, seed } }
}

/** A seeded Fisher–Yates draw of up to `perBand` pairs per band. Pure, so the test can pin it. */
export function stratifiedSample(
  pairs: readonly SimilarityPairRow[],
  perBand: number,
  seed: number,
): Partial<Record<SimilarityBand, SimilarityPairRow[]>> {
  let state = seed >>> 0
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
  const out: Partial<Record<SimilarityBand, SimilarityPairRow[]>> = {}
  for (const band of SIMILARITY_BANDS) {
    const pool = pairs.filter((pair) => pair.band === band)
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1))
      const a = pool[i]
      const b = pool[j]
      if (a !== undefined && b !== undefined) {
        pool[i] = b
        pool[j] = a
      }
    }
    out[band] = pool.slice(0, perBand)
  }
  return out
}

export const CSV_HEADER = 'band,pair_id,run_id,left_hash_id,right_hash_id,distance,cosine,correct'

export function toCsv(sample: Partial<Record<SimilarityBand, SimilarityPairRow[]>>): string {
  const lines = [CSV_HEADER]
  for (const band of SIMILARITY_BANDS) {
    for (const pair of sample[band] ?? []) {
      lines.push(
        [
          band,
          pair.id,
          pair.run_id,
          pair.left_hash_id,
          pair.right_hash_id,
          pair.distance ?? '',
          pair.cosine ?? '',
          '',
        ]
          .map(String)
          .join(','),
      )
    }
  }
  return `${lines.join('\n')}\n`
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
      console.error(
        `Could not read ${ENV_PATH}: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      process.exit(1)
    }
  }
  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })
  const runs = (await listSimilarityRuns(admin, 200)).filter((run) => run.status === 'SUCCEEDED')
  const pairs: SimilarityPairRow[] = []
  for (const run of runs) pairs.push(...(await listSimilarityPairs(admin, run.id)))
  const sample = stratifiedSample(pairs, options.perBand, options.seed)
  writeFileSync(options.out, toCsv(sample))
  const total = SIMILARITY_BANDS.reduce((sum, band) => sum + (sample[band]?.length ?? 0), 0)
  if (total === 0) {
    console.log(
      `no pairs to sample: the research hash corpus is empty under amendment A33. Wrote the header only to ${options.out}.`,
    )
    return
  }
  console.log(
    `wrote ${String(total)} pair(s) to ${options.out}; label the "correct" column yes/no and transcribe the counts.`,
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
