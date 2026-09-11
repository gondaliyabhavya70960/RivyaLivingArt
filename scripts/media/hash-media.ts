#!/usr/bin/env tsx
/**
 * media:hash — hash every Rivya media asset that has no hash row yet.
 *
 *   npx tsx scripts/media/hash-media.ts                 # every unhashed IMAGE and VIDEO asset
 *   npx tsx scripts/media/hash-media.ts --dry-run       # list the work, fetch nothing
 *   npx tsx scripts/media/hash-media.ts --limit=50
 *   npx tsx scripts/media/hash-media.ts --only=PROCESS-STUDIO-001
 *
 * WHAT IT FETCHES: the ORIGINAL bytes of each asset from the Cloudinary delivery origin — the
 * same URL the upload guard fetches — so the backfill and the guard agree on every checksum.
 * WHAT IT KEEPS: a SHA-256 for every asset; a pHash and dHash for images; nothing else. No file
 * is written, no width or height is recorded, and the buffer is released after the row is
 * written.
 *
 * IDEMPOTENT: an asset with a hash row is skipped, so a nightly re-run costs nothing. `--only`
 * re-hashes one asset by its Rivya id (or uuid) whether or not it has a row.
 *
 * WHERE IT RUNS: anywhere that can reach both the database and res.cloudinary.com. The
 * development container this repository is often worked in cannot reach Cloudinary, which is
 * why `.github/workflows/media-hash.yml` exists: a GitHub-hosted runner can.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { hashMediaBytes, sha256OfStream } from '../../lib/media/hashes'
import { originalUrl } from '../../lib/media/url'
import type { Database } from '../../lib/supabase/database.types'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import {
  hashCoverage,
  listHashableAssets,
  listUnhashedAssets,
  upsertMediaAssetHash,
  type UnhashedAsset,
} from '../../lib/supabase/repositories/media-hashes'

const ENV_PATH = '.env.local'

export interface HashCliOptions {
  readonly dryRun: boolean
  readonly limit: number | null
  readonly only: string | null
}

export type ParsedArgs =
  | { readonly ok: true; readonly value: HashCliOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let dryRun = false
  let limit: number | null = null
  let only: string | null = null
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length))
      if (!Number.isInteger(value) || value < 1) return { ok: false, error: '--limit must be ≥ 1' }
      limit = value
      continue
    }
    if (arg.startsWith('--only=')) {
      only = arg.slice('--only='.length).trim()
      if (only === '') return { ok: false, error: '--only needs a Rivya asset id or a uuid' }
      continue
    }
    return { ok: false, error: `unknown argument ${arg}` }
  }
  return { ok: true, value: { dryRun, limit, only } }
}

/** The work list, after `--only` and `--limit`. Pure, so the unit test can pin it. */
export function planBackfill(
  assets: readonly UnhashedAsset[],
  options: Pick<HashCliOptions, 'limit' | 'only'>,
): UnhashedAsset[] {
  let work = [...assets]
  if (options.only !== null) {
    const wanted = options.only.toLowerCase()
    work = work.filter(
      (asset) => asset.id === wanted || (asset.rivya_asset_id ?? '').toLowerCase() === wanted,
    )
  }
  if (options.limit !== null) work = work.slice(0, options.limit)
  return work
}

async function fetchAndHash(cloudName: string, asset: UnhashedAsset) {
  const resourceType = asset.kind === 'IMAGE' ? 'image' : 'video'
  const url = originalUrl(cloudName, { publicId: asset.public_id, resourceType })
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok || response.body === null) {
    throw new Error(`${asset.public_id}: delivery answered ${String(response.status)}`)
  }
  if (asset.kind === 'VIDEO') {
    return {
      kind: 'VIDEO' as const,
      checksum: await sha256OfStream(response.body),
      phash: null,
      dhash: null,
    }
  }
  return hashMediaBytes('IMAGE', new Uint8Array(await response.arrayBuffer()))
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
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (cloudName === undefined || cloudName === '') {
    console.error(
      'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set; there is no delivery origin to fetch from.',
    )
    process.exit(1)
  }
  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const unhashed = await listUnhashedAssets(admin)
  let candidates = unhashed
  if (
    options.only !== null &&
    planBackfill(unhashed, { only: options.only, limit: null }).length === 0
  ) {
    // `--only` may name an asset that already has a row: re-hash it.
    candidates = await listHashableAssets(admin)
  }
  const work = planBackfill(candidates, options)
  console.log(
    `${String(unhashed.length)} asset(s) without a hash row; ${String(work.length)} to hash${options.dryRun ? ' (dry run — fetching nothing)' : ''}`,
  )

  let done = 0
  let failed = 0
  for (const asset of work) {
    const name = asset.rivya_asset_id ?? asset.public_id
    if (options.dryRun) {
      console.log(`  would hash ${asset.kind.padEnd(5)} ${name}`)
      continue
    }
    try {
      const hashes = await fetchAndHash(cloudName, asset)
      await upsertMediaAssetHash(admin, {
        media_asset_id: asset.id,
        kind: hashes.kind,
        checksum: hashes.checksum,
        phash: hashes.phash,
        dhash: hashes.dhash,
      })
      done += 1
      console.log(`  hashed ${asset.kind.padEnd(5)} ${name}`)
    } catch (error) {
      failed += 1
      console.error(
        `  FAILED ${asset.kind.padEnd(5)} ${name}: ${error instanceof Error ? error.message : 'unknown'}`,
      )
    }
  }

  const coverage = await hashCoverage(admin)
  console.log('')
  console.log('kind   assets  hashed  with pHash')
  for (const row of coverage) {
    console.log(
      `${row.kind.padEnd(6)} ${String(row.assets).padStart(6)}  ${String(row.hashed).padStart(6)}  ${String(row.withPhash).padStart(10)}`,
    )
  }
  console.log('')
  console.log(`hashed ${String(done)}, failed ${String(failed)}`)
  if (failed > 0) process.exit(1)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
