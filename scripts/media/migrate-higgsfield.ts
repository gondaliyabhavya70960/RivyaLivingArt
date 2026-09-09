#!/usr/bin/env node
/**
 * media:migrate:higgsfield — move the 250 manifest assets into Cloudinary and `media_assets`.
 *
 * THE DECISIONS ARE NOT IN THIS FILE. `lib/media/migration.ts` holds the plan, the ledger rules and
 * the row mapping, and `tests/unit/higgsfield-migration.test.ts` drives all 250 real manifest rows
 * through them with a fake uploader and no network. What is here is wiring: arguments, a database
 * connection, a Cloudinary client, and the console output a human watches for twenty minutes.
 *
 * TWO PIECES OF STATE, AND THE SPLIT IS DELIBERATE:
 *
 *   `data/higgsfield/migration-log.json`  per ASSET, keyed by higgsfield_generation_id, committed.
 *                                         This is the resume mechanism. Committed because the
 *                                         migration must be resumable by somebody who has the repo
 *                                         and a Cloudinary key but no database yet, and because a
 *                                         ledger in git is reviewable in a pull request.
 *   `higgsfield_migration_runs`           per RUN, in the database. The audit record: what was
 *                                         attempted, when, by which scope, with what outcome.
 *
 * ORDER OF OPERATIONS PER ASSET: upload, then write the row. Never the reverse. A row written
 * first would point at an asset that does not exist, and a broken image in a Studio table is
 * harder to notice than a missing one.
 *
 * THE UPSERT KEY IS `higgsfield_generation_id`, NOT `rivya_asset_id`. Rebuilding the manifest
 * renumbers a family whose membership changed — `PROCESS-POUR-004` can legitimately become
 * `PROCESS-POUR-005` — while the generation id names the run that produced the pixels and no
 * rebuild touches it. Keying on the asset id would re-insert a renumbered family as new rows and
 * double the library. `media_assets_higgsfield_generation_idx` is the partial unique index that
 * makes this possible.
 *
 * Usage:
 *   npm run media:migrate:higgsfield -- --dry-run
 *   npm run media:migrate:higgsfield
 *   npm run media:migrate:higgsfield -- --family=process-pour
 *   npm run media:migrate:higgsfield -- --limit=10
 *   npm run media:migrate:higgsfield -- --from-results=data/higgsfield/mcp-upload-results.json
 *   npm run media:migrate:higgsfield -- --from-results=… --rebuild-rows
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import pg from 'pg'

import { readManifest, resourceTypeFor, sourceUrlFor } from '../../lib/media/manifest'
import {
  EMPTY_LEDGER,
  cloudinaryTagsFor,
  contextFor,
  planRun,
  recordFailure,
  recordSuccess,
  toMediaAssetRow,
  type AssetUploader,
  type Ledger,
  type RunScope,
  type UploadedAsset,
} from '../../lib/media/migration'
import { createCloudinaryUploader } from '../../lib/media/providers/cloudinary-admin'

const LEDGER_PATH = 'data/higgsfield/migration-log.json'
const ENV_PATH = '.env.local'

/**
 * Load `.env.local`, if it is there.
 *
 * WITHOUT THIS THE SCRIPT IS UNRUNNABLE, and the first real run proved it: every asset failed with
 * "Missing required environment variable NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" while that variable sat
 * in `.env.local` the whole time. Next.js loads that file for the app; a `tsx` CLI is not Next.js
 * and nothing was loading it here.
 *
 * `process.loadEnvFile` is built into Node 22, so this costs no dependency. It **does not override
 * a variable already set in the environment**, which is the property that makes it safe to call:
 * `.env.local` points `DATABASE_URL` at the hosted project, and an operator who exported a local
 * one — the way `db:reset` requires — must keep it. Verified rather than assumed.
 *
 * Missing file is not an error. CI has no `.env.local` and passes its variables directly.
 */
function loadLocalEnv(): void {
  if (!existsSync(ENV_PATH)) return
  try {
    process.loadEnvFile(ENV_PATH)
  } catch (error) {
    // A malformed file is worth naming, but never worth printing: it holds live secrets.
    console.error(
      `Could not read ${ENV_PATH}: ${error instanceof Error ? error.message : 'unknown'}`,
    )
    process.exit(1)
  }
}

loadLocalEnv()

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const family = argv.find((a) => a.startsWith('--family='))?.slice('--family='.length)
const limitRaw = argv.find((a) => a.startsWith('--limit='))?.slice('--limit='.length)
const limit = limitRaw === undefined ? undefined : Number(limitRaw)
const resultsPath = argv
  .find((a) => a.startsWith('--from-results='))
  ?.slice('--from-results='.length)

/**
 * `--rebuild-rows` — re-apply recorded results to `media_assets` for assets the ledger already
 * calls done.
 *
 * The ledger answers "was this uploaded to Cloudinary", which is the expensive, irreversible half.
 * It does NOT answer "is there a row in this database", and the two come apart the moment anyone
 * runs `npm run db:reset`: Cloudinary still holds all 250, the ledger still says done, and
 * `media_assets` is empty with no way to refill it.
 *
 * IT REQUIRES `--from-results`, and that is the whole safety argument. In replay mode the uploader
 * cannot reach the network — it answers from a recorded file and throws for anything absent — so
 * ignoring the ledger can re-write rows but can never re-upload an asset or spend a credit. The
 * same flag against the live uploader would re-transfer every asset in scope, so it is refused
 * there rather than merely discouraged.
 */
const rebuildRows = argv.includes('--rebuild-rows')

if (rebuildRows && resultsPath === undefined) {
  console.error(
    '--rebuild-rows requires --from-results=<file>.\n' +
      'Against the live uploader it would re-transfer every asset in scope; from a recorded file it cannot.',
  )
  process.exit(1)
}

if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
  console.error(`--limit must be a positive integer; got ${String(limitRaw)}`)
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
  process.exit(1)
}

/**
 * PREFLIGHT, BEFORE ANYTHING ELSE. D6 as amended by A1 requires the ID-collision guard to run
 * before any media migration, and the phase document makes it verification step 1: a failing run
 * blocks every step below. It is invoked here rather than left to CI because CI is not what runs
 * this — a person is, on a machine that may never have run the guard.
 */
function preflight(): void {
  try {
    const output = execFileSync('python3', ['scripts/media/check-asset-ids.py'], {
      encoding: 'utf8',
    })
    console.log(`▸ preflight: ${output.trim()}`)
  } catch (error) {
    console.error(
      '✗ scripts/media/check-asset-ids.py failed. A planned asset ID reuses a manifest family\n' +
        '  prefix, which will collide the moment that family grows (D6, amendment A1). Fix the ID\n' +
        '  before migrating anything.\n' +
        String((error as { stdout?: string }).stdout ?? error),
    )
    process.exit(1)
  }
}

/**
 * The three variables `createCloudinaryUploader()` needs, checked ONCE before the run rather than
 * discovered per asset.
 *
 * WHY THIS IS NOT LEFT TO THE UPLOADER. `configure()` is lazy, so a missing key surfaces on the
 * first upload — inside the per-asset try/catch, which dutifully records it as a FAILURE and moves
 * on. A full run with no credentials therefore produced 250 identical ledger entries, an exit code
 * that says "250 assets failed", and a committed file describing a problem that was never about the
 * assets at all. One check, one message, before anything is written.
 *
 * Names only, never values or lengths — these are live secrets (CLAUDE.md, house style).
 */
const CLOUDINARY_VARS = [
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const

function requireCloudinaryCredentials(): void {
  const missing = CLOUDINARY_VARS.filter((name) => !process.env[name])
  if (missing.length === 0) return

  console.error(
    `✗ ${String(missing.length)} Cloudinary variable(s) are not set:\n` +
      missing.map((name) => `    ${name}`).join('\n') +
      `\n\n  Add them to ${ENV_PATH} (names only are shown here; never paste a value into a\n` +
      '  terminal transcript or a chat). The API key and secret are in the Cloudinary console\n' +
      '  under Settings → API Keys. See docs/ops/ENVIRONMENT.md §5.\n' +
      '  Nothing was uploaded and nothing was written.',
  )
  process.exit(1)
}

function readLedger(manifestVersion: string): Ledger {
  if (!existsSync(LEDGER_PATH)) return { ...EMPTY_LEDGER, manifestVersion }
  const parsed = JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as Ledger
  return { manifestVersion, entries: parsed.entries ?? {} }
}

function writeLedger(ledger: Ledger): void {
  // Pretty-printed and key-sorted: this file is committed, so its diff is read by a person. An
  // unsorted dump would show every line as changed whenever object key order shifted.
  const sorted = Object.fromEntries(
    Object.entries(ledger.entries).sort(([a], [b]) => a.localeCompare(b)),
  )
  writeFileSync(LEDGER_PATH, `${JSON.stringify({ ...ledger, entries: sorted }, null, 2)}\n`)
}

const UPSERT = `
insert into media_assets (
  rivya_asset_id, provider, resource_type, public_id, folder, filename, kind, source,
  alt_text, is_ai_generated, is_concept, status, owner_verification,
  tags, subject_tags, aspect_ratio, width, height, duration_s, bytes, mime_type,
  higgsfield_generation_id, higgsfield_model, higgsfield_prompt, manifest_version, migrated_at
) values (
  $1,$2,$3,$4,$5,$6,$7,$8, $9,$10,$11,$12,$13, $14,$15,$16,$17,$18,$19,$20,$21,
  $22,$23,$24,$25, now()
)
on conflict (higgsfield_generation_id) where higgsfield_generation_id is not null
do update set
  -- Provider-derived and manifest-derived fields are refreshed. alt_text is NOT: it is imported as
  -- a draft and an editor's rewrite must survive a re-run, exactly as in the canary importer.
  rivya_asset_id  = excluded.rivya_asset_id,
  resource_type   = excluded.resource_type,
  public_id       = excluded.public_id,
  folder          = excluded.folder,
  filename        = excluded.filename,
  kind            = excluded.kind,
  tags            = excluded.tags,
  subject_tags    = excluded.subject_tags,
  aspect_ratio    = excluded.aspect_ratio,
  width           = excluded.width,
  height          = excluded.height,
  duration_s      = excluded.duration_s,
  bytes           = excluded.bytes,
  mime_type       = excluded.mime_type,
  higgsfield_model  = excluded.higgsfield_model,
  higgsfield_prompt = excluded.higgsfield_prompt,
  manifest_version  = excluded.manifest_version,
  migrated_at       = excluded.migrated_at
`

/**
 * `--from-results=<file>` — replay uploads that happened somewhere else.
 *
 * WHY THIS EXISTS. The sandbox this project is built in cannot open a connection to
 * api.cloudinary.com at all — the proxy refuses the CONNECT — so `createCloudinaryUploader()` can
 * never run here. The uploads were performed through the Cloudinary MCP server instead, with the
 * SAME parameters this file's uploader sends (`public_id` verbatim, `overwrite: false`,
 * `unique_filename: false`, `use_filename: false`, the tags from `cloudinaryTagsFor`, the context
 * from `contextFor`), and each response was saved. This mode feeds those saved responses through
 * the same planner, the same row mapping and the same ledger rules, so the ONLY thing that differs
 * from a direct run is which process made the HTTP request.
 *
 * WHAT IT REFUSES. An asset with no recorded response is a FAILURE, not a skip: the ledger records
 * it as failed and the run exits non-zero, exactly as a rejected upload would. A recorded failure
 * is replayed as a failure. Nothing here can invent an upload that did not happen.
 *
 * The file's shape:
 *   { "results":  { "<publicId>": { publicId, bytes, width, height, durationSeconds, format } },
 *     "failures": { "<publicId>": "<error message>" } }
 */
type RecordedResults = {
  readonly results: Record<string, UploadedAsset>
  readonly failures?: Record<string, string>
}

function createReplayUploader(path: string): AssetUploader {
  const recorded = JSON.parse(readFileSync(path, 'utf8')) as RecordedResults
  const results = recorded.results ?? {}
  const failures = recorded.failures ?? {}

  return {
    async probe(publicId): Promise<UploadedAsset | null> {
      return results[publicId] ?? null
    },
    async upload(request): Promise<UploadedAsset> {
      const hit = results[request.publicId]
      if (hit !== undefined) return hit
      const failure = failures[request.publicId]
      throw new Error(failure ?? `no recorded upload result for ${request.publicId} in ${path}`)
    },
  }
}

async function main(): Promise<void> {
  preflight()

  const manifest = readManifest()
  const scope: RunScope = {
    ...(family === undefined ? {} : { family }),
    ...(limit === undefined ? {} : { limit }),
  }
  const ledger = readLedger(manifest.manifest_version)
  // A rebuild plans against an empty ledger so every asset is attempted, then writes the real one
  // back at the end — the recorded upload history is reported, never discarded.
  const plan = planRun(
    manifest.assets,
    rebuildRows ? { ...EMPTY_LEDGER, manifestVersion: manifest.manifest_version } : ledger,
    scope,
  )

  console.log(
    `▸ manifest ${manifest.manifest_version} · ${String(manifest.assets.length)} assets\n` +
      `▸ scope ${plan.requestedScope} · attempt ${String(plan.attempt.length)} · ` +
      `already done ${String(plan.skip.length)}${dryRun ? ' · DRY RUN' : ''}\n`,
  )

  if (dryRun) {
    // Reports and writes nothing — not to Cloudinary, not to the ledger, not to the database.
    // Verification step 2 asserts exactly this shape.
    console.log(
      `attempted ${String(plan.attempt.length)}, migrated 0, skipped ${String(plan.skip.length)}, failed 0`,
    )
    for (const asset of plan.attempt.slice(0, 5)) {
      console.log(`    would upload ${asset.rivya_asset_id} -> ${asset.cloudinary_public_id}`)
    }
    if (plan.attempt.length > 5) console.log(`    … and ${String(plan.attempt.length - 5)} more`)
    return
  }

  // A replay needs no Cloudinary credentials: the requests it replays were already made.
  if (resultsPath === undefined) requireCloudinaryCredentials()

  const uploader: AssetUploader =
    resultsPath === undefined ? createCloudinaryUploader() : createReplayUploader(resultsPath)
  const client = new pg.Client({ connectionString: url })
  await client.connect()

  const startedAt = new Date().toISOString()
  const log: Record<string, string> = {}
  let current = ledger
  let migrated = 0
  let failed = 0

  try {
    for (const [index, asset] of plan.attempt.entries()) {
      const position = `[${String(index + 1)}/${String(plan.attempt.length)}]`
      try {
        // Already in Cloudinary but missing from the ledger — the case a lost or partial ledger
        // produces. Adopt it rather than re-uploading: `overwrite: false` would refuse anyway, and
        // paying for the transfer twice to learn that is not worth it.
        const existing = await uploader.probe(asset.cloudinary_public_id, resourceTypeFor(asset))
        const uploaded =
          existing ??
          (await uploader.upload({
            sourceUrl: sourceUrlFor(asset),
            publicId: asset.cloudinary_public_id,
            resourceType: resourceTypeFor(asset),
            tags: cloudinaryTagsFor(asset),
            context: contextFor(asset),
          }))

        const row = toMediaAssetRow(asset, uploaded, manifest.manifest_version)
        await client.query(UPSERT, [
          row.rivya_asset_id,
          row.provider,
          row.resource_type,
          row.public_id,
          row.folder,
          row.filename,
          row.kind,
          row.source,
          row.alt_text,
          row.is_ai_generated,
          row.is_concept,
          row.status,
          row.owner_verification,
          row.tags,
          row.subject_tags,
          row.aspect_ratio,
          row.width,
          row.height,
          row.duration_s,
          row.bytes,
          row.mime_type,
          row.higgsfield_generation_id,
          row.higgsfield_model,
          row.higgsfield_prompt,
          row.manifest_version,
        ])

        current = recordSuccess(current, asset, uploaded, new Date().toISOString())
        migrated += 1
        log[asset.rivya_asset_id] = existing ? 'adopted' : 'uploaded'
        console.log(`  ${position} ${existing ? 'adopted ' : 'uploaded'} ${asset.rivya_asset_id}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        current = recordFailure(current, asset, message, new Date().toISOString())
        failed += 1
        log[asset.rivya_asset_id] = `failed: ${message}`
        console.error(`  ${position} FAILED   ${asset.rivya_asset_id} — ${message}`)
      }

      // Written after EVERY asset, not at the end. A run interrupted at asset 180 must resume from
      // 180, and a ledger flushed only on success would lose 180 uploads that were actually paid
      // for and stored.
      writeLedger(current)
    }
  } finally {
    await client
      .query(
        `insert into higgsfield_migration_runs
           (started_at, finished_at, manifest_version, requested_scope,
            attempted, migrated, skipped, failed, dry_run, log)
         values ($1, now(), $2, $3, $4, $5, $6, $7, false, $8)`,
        [
          startedAt,
          manifest.manifest_version,
          plan.requestedScope,
          plan.attempt.length,
          migrated,
          plan.skip.length,
          failed,
          JSON.stringify(log),
        ],
      )
      .catch((error: unknown) => {
        // The run record failing must not mask the migration's own outcome, which the ledger and
        // the exit code already carry.
        console.error(`  (could not write the run record: ${String(error)})`)
      })
    await client.end()
  }

  console.log(
    `\nattempted ${String(plan.attempt.length)}, migrated ${String(migrated)}, ` +
      `skipped ${String(plan.skip.length)}, failed ${String(failed)}`,
  )

  // Non-zero on any failure, so a CI step or a shell `&&` chain stops. The phase document's
  // verification step 3 requires `failed 0`.
  if (failed > 0) process.exit(1)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
