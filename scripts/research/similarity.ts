#!/usr/bin/env tsx
/**
 * research:similarity — a similarity run, recorded honestly.
 *
 *   npx tsx scripts/research/similarity.ts --scope=media                  # the Rivya library
 *   npx tsx scripts/research/similarity.ts --scope=corpus --method=phash  # every source: skipped
 *   npx tsx scripts/research/similarity.ts --scope=source:<slug>
 *   npx tsx scripts/research/similarity.ts --scope=media --dry-run        # compare, store nothing
 *
 * THE CORPUS SCOPES DO NOT FETCH. Under amendment A33 competitor images are referenced by URL and
 * never downloaded, so a corpus or source run opens a run row, lists every enabled source under
 * `sources_skipped` with the first gate that stops it — `KILL_SWITCH`, `FLAG_OFF`,
 * `SOURCE_OPT_OUT` — and, whatever the gates say, `NOT_BUILT`: the fetcher does not exist. It
 * then closes the run with `images_fetched = 0`. The run is the audit trail that says so.
 *
 * `--scope=media` runs the library library check (`lib/media/library-check.ts`), the same code the
 * Studio button runs, and prints the pairs. `--method=embedding` exits with the reason it cannot.
 *
 * `--rehash` is accepted for the phase document's interface and has nothing to re-fetch.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { libraryCheck } from '../../lib/media/library-check'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import { listFeatureFlags } from '../../lib/supabase/repositories/flags'
import { listMediaAssetHashes } from '../../lib/supabase/repositories/media-hashes'
import { listResearchSources } from '../../lib/supabase/repositories/research/sources'
import {
  closeSimilarityRun,
  openSimilarityRun,
} from '../../lib/supabase/repositories/research/similarity'

const ENV_PATH = '.env.local'

export type Scope =
  | { readonly kind: 'CORPUS' }
  | { readonly kind: 'SOURCE'; readonly slug: string }
  | { readonly kind: 'MEDIA' }

export interface SimilarityCliOptions {
  readonly scope: Scope
  readonly method: 'phash' | 'embedding'
  readonly rehash: boolean
  readonly dryRun: boolean
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: SimilarityCliOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let scope: Scope | null = null
  let method: 'phash' | 'embedding' = 'phash'
  let rehash = false
  let dryRun = false
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg === '--rehash') {
      rehash = true
      continue
    }
    if (arg.startsWith('--method=')) {
      const value = arg.slice('--method='.length)
      if (value !== 'phash' && value !== 'embedding') {
        return { ok: false, error: `--method must be phash or embedding, not ${value}` }
      }
      method = value
      continue
    }
    if (arg.startsWith('--scope=')) {
      const value = arg.slice('--scope='.length)
      if (value === 'corpus') scope = { kind: 'CORPUS' }
      else if (value === 'media') scope = { kind: 'MEDIA' }
      else if (value.startsWith('source:') && /^[a-z0-9-]+$/u.test(value.slice(7))) {
        scope = { kind: 'SOURCE', slug: value.slice(7) }
      } else
        return { ok: false, error: `--scope must be corpus, media or source:<slug>, not ${value}` }
      continue
    }
    return { ok: false, error: `unknown argument ${arg}` }
  }
  if (scope === null) return { ok: false, error: '--scope is required' }
  return { ok: true, value: { scope, method, rehash, dryRun } }
}

/** The gate that stops a source, in the order the phase document lists them; NOT_BUILT last. */
export function skipReason(input: {
  readonly researchEnabled: boolean
  readonly hashingFlag: boolean
  readonly sourceOptIn: boolean
}): 'KILL_SWITCH' | 'FLAG_OFF' | 'SOURCE_OPT_OUT' | 'NOT_BUILT' {
  if (!input.researchEnabled) return 'KILL_SWITCH'
  if (!input.hashingFlag) return 'FLAG_OFF'
  if (!input.sourceOptIn) return 'SOURCE_OPT_OUT'
  return 'NOT_BUILT'
}

async function readFlag(
  admin: ReturnType<typeof createClient<Database>>,
  key: string,
): Promise<boolean> {
  const flags = await listFeatureFlags(admin)
  return flags.some((flag) => flag.key === key && flag.is_enabled)
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(2)
  }
  const options = parsed.value
  if (options.method === 'embedding') {
    console.error(
      'embedding runs are not built: FORM_SIMILAR would need competitor bytes the owner has decided are never fetched (amendment A33), and advanced_similarity is off.',
    )
    process.exit(1)
  }
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

  if (options.scope.kind === 'MEDIA') {
    const rows = await listMediaAssetHashes(admin)
    const result = libraryCheck(
      rows.map((row) => ({
        id: row.media_asset_id,
        label:
          row.media_assets?.rivya_asset_id ?? row.media_assets?.public_id ?? row.media_asset_id,
        kind: row.kind,
        checksum: row.checksum,
        phash: row.phash,
      })),
    )
    console.log(
      `library: ${String(result.hashed)} image(s) hashed, ${String(result.compared)} compared, ${String(result.pairs.length)} pair(s), ${String(result.exact)} byte-identical`,
    )
    for (const pair of result.pairs) {
      console.log(
        `  ${pair.band.padEnd(16)} ${pair.exact ? 'exact' : `d=${String(pair.distance ?? '-')}`.padEnd(5)}  ${pair.leftLabel}  ·  ${pair.rightLabel}`,
      )
    }
    if (!options.dryRun) {
      const run = await openSimilarityRun(admin, {
        scope_type: 'MEDIA_ASSET',
        scope_id: null,
        method: 'PHASH',
        model_name: null,
        created_by: null,
      })
      await closeSimilarityRun(admin, run.id, {
        status: 'SUCCEEDED',
        counts: {
          images_fetched: 0,
          images_hashed: result.hashed,
          sources_skipped: {},
          pairs_considered: result.compared,
          pairs_stored: 0,
          pairs_exact: result.exact,
        },
      })
      console.log(`run ${run.id} recorded (no pairs stored: a MEDIA_ASSET run never stores one)`)
    }
    return
  }

  const [researchEnabled, hashingFlag, sources] = await Promise.all([
    readFlag(admin, 'research_enabled'),
    readFlag(admin, 'research_image_hashing'),
    listResearchSources(admin),
  ])
  const inScope =
    options.scope.kind === 'SOURCE'
      ? sources.filter((source) => source.slug === (options.scope as { slug: string }).slug)
      : sources
  if (options.scope.kind === 'SOURCE' && inScope.length === 0) {
    console.error(`no source with slug ${options.scope.slug}`)
    process.exit(1)
  }
  const skipped: Record<string, string> = {}
  for (const source of inScope) {
    skipped[source.slug] = skipReason({
      researchEnabled,
      hashingFlag,
      sourceOptIn: false, // image_hashing_enabled is false everywhere under A33 and never set
    })
  }
  console.log(
    'competitor images are referenced by URL and never fetched (amendment A33): 0 requests made.',
  )
  for (const [slug, reason] of Object.entries(skipped))
    console.log(`  ${slug.padEnd(24)} ${reason}`)
  if (options.rehash) console.log('--rehash: nothing to re-fetch.')
  if (options.dryRun) return

  const scopeId = options.scope.kind === 'SOURCE' ? (inScope[0]?.id ?? null) : null
  const run = await openSimilarityRun(admin, {
    scope_type: options.scope.kind,
    scope_id: scopeId,
    method: 'PHASH',
    model_name: null,
    created_by: null,
  })
  await closeSimilarityRun(admin, run.id, {
    status: 'SUCCEEDED',
    counts: {
      images_fetched: 0,
      images_hashed: 0,
      sources_skipped: skipped,
      pairs_considered: 0,
      pairs_stored: 0,
      pairs_exact: 0,
    },
  })
  console.log(`run ${run.id} recorded with every source skipped`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
