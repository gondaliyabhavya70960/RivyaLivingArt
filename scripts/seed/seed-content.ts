#!/usr/bin/env node
/**
 * seed:content — apply the content seed idempotently.
 *
 * THE ONE RULE THIS SCRIPT EXISTS TO ENFORCE
 * ------------------------------------------
 * Re-seeding must never overwrite something a human typed. Everything below follows from that:
 *
 *   1. Each record carries a stable `seedKey`.
 *   2. The runner hashes the field values it is about to write.
 *   3. Row absent                                   -> insert, store the hash        [inserted]
 *   4. Row present, current fields hash == stored   -> the runner still owns it;
 *                                                      update and re-store the hash  [updated]
 *   5. Row present, hashes differ                   -> A HUMAN EDITED IT. Skip.      [skipped]
 *   6. --dry-run performs 2-5 and reports, mutating no content row.
 *   7. The runner never deletes a row, and never changes `status` on an existing row.
 *
 * Rule 5 is the whole point, and rule 7 is its quieter twin: re-seeding must not un-publish
 * something an editor published, so `status` is excluded from every update payload.
 *
 * WHY THIS TALKS TO POSTGRES DIRECTLY RATHER THAN THROUGH supabase-js
 * -------------------------------------------------------------------
 * This is an operations script in the same family as a migration, not application code. It needs
 * a transaction per module — a half-applied seed is worse than none — and PostgREST cannot give
 * it one. It already requires DATABASE_URL, which is the migration credential. Application reads
 * and writes still go through lib/supabase/repositories/**, and scripts/db/check-data-layer.mjs
 * still forbids `.from(` outside that directory; this script calls no such thing.
 *
 * Usage:
 *   npm run seed:content -- --dry-run
 *   npm run seed:content -- --only=taxonomy
 *   npm run seed:content -- --version=rivya-v1
 *   npm run seed:content -- --force --only=taxonomy    (overwrites owner edits; always logged)
 */
import pg from 'pg'

import { seedModules, type SeedModule, type SeedRecord } from '../../content/seed/index'
import { contentHash, hashRowSubset } from './hash'

const DEFAULT_SEED_VERSION = 'rivya-v1'

type Outcome = 'inserted' | 'updated' | 'skipped_owner_edited' | 'failed'

type RecordResult = {
  seedKey: string
  table: string
  outcome: Outcome
  detail?: string
}

// --- arguments ---------------------------------------------------------------------------------

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const force = argv.includes('--force')
const only = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length)
const seedVersion =
  argv.find((a) => a.startsWith('--version='))?.slice('--version='.length) ?? DEFAULT_SEED_VERSION

/**
 * `--force` overwrites owner edits, so it must never be a broad instrument. Requiring --only
 * means a forced run names the one module it is prepared to overwrite, rather than silently
 * flattening every edit in the system because someone wanted one row back.
 */
if (force && !only) {
  console.error(
    '--force requires --only=<module>.\n' +
      'Forcing overwrites edits a human made. It has to name the module it is overwriting.',
  )
  process.exit(1)
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
  process.exit(1)
}

const modules: readonly SeedModule[] = only
  ? seedModules.filter((module) => module.name === only)
  : seedModules

if (only && modules.length === 0) {
  console.error(
    `No seed module named "${only}". Known modules: ${seedModules.map((m) => m.name).join(', ')}`,
  )
  process.exit(1)
}

// --- database ----------------------------------------------------------------------------------

const client = new pg.Client({ connectionString })

/** Identifier quoting for the table and column names a seed module supplies. The values are always
 *  bound parameters; only identifiers are interpolated, and only after this. */
function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to use "${name}" as a SQL identifier.`)
  }
  return `"${name}"`
}

async function applyRecord(record: SeedRecord): Promise<RecordResult> {
  const table = quoteIdent(record.table)
  const fieldNames = Object.keys(record.fields).sort()
  const hash = contentHash(record.fields)

  const existing = await client.query(`select * from ${table} where seed_key = $1 limit 1`, [
    record.seedKey,
  ])

  // --- rule 3: absent -> insert ---
  if (existing.rowCount === 0) {
    if (dryRun) return { seedKey: record.seedKey, table: record.table, outcome: 'inserted' }

    const columns = [
      ...fieldNames,
      'seed_key',
      'content_seed_version',
      'seed_content_hash',
      'seed_last_applied_at',
    ]
    const values = [
      ...fieldNames.map((name) => record.fields[name]),
      record.seedKey,
      seedVersion,
      hash,
      new Date().toISOString(),
    ]
    const placeholders = values.map((_, i) => `$${i + 1}`)

    await client.query(
      `insert into ${table} (${columns.map(quoteIdent).join(', ')}) values (${placeholders.join(', ')})`,
      values,
    )
    return { seedKey: record.seedKey, table: record.table, outcome: 'inserted' }
  }

  const row = existing.rows[0] as Record<string, unknown>
  const storedHash = row['seed_content_hash'] as string | null
  const currentHash = hashRowSubset(row, fieldNames)

  // --- rule 5: hashes differ -> a human edited it ---
  // A null stored hash means the row was created by something other than the runner, which is the
  // same situation: the runner does not own it.
  const runnerStillOwnsIt = storedHash !== null && storedHash === currentHash

  if (!runnerStillOwnsIt && !force) {
    return {
      seedKey: record.seedKey,
      table: record.table,
      outcome: 'skipped_owner_edited',
      detail:
        storedHash === null
          ? 'row has no seed hash (created outside the runner)'
          : 'row was edited after the last seed',
    }
  }

  // --- rule 4 (or a forced rule 5): update ---
  if (dryRun) {
    return {
      seedKey: record.seedKey,
      table: record.table,
      outcome: 'updated',
      detail: force && !runnerStillOwnsIt ? 'would be FORCE-overwritten' : undefined,
    }
  }

  // `status` is never here. Rule 7: re-seeding must not un-publish an editor's work.
  const setColumns = [
    ...fieldNames,
    'content_seed_version',
    'seed_content_hash',
    'seed_last_applied_at',
  ]
  const setValues = [
    ...fieldNames.map((name) => record.fields[name]),
    seedVersion,
    hash,
    new Date().toISOString(),
  ]
  const assignments = setColumns.map((name, i) => `${quoteIdent(name)} = $${i + 1}`)

  await client.query(
    `update ${table} set ${assignments.join(', ')} where seed_key = $${setValues.length + 1}`,
    [...setValues, record.seedKey],
  )

  return {
    seedKey: record.seedKey,
    table: record.table,
    outcome: 'updated',
    detail: force && !runnerStillOwnsIt ? 'FORCE-overwrote an owner edit' : undefined,
  }
}

// --- run ---------------------------------------------------------------------------------------

async function main(): Promise<number> {
  await client.connect()

  const results: RecordResult[] = []

  // The run record is written even for a dry run: a dry run is a thing that happened, and
  // content_seed_runs.is_dry_run exists to say which kind it was.
  const runInsert = await client.query(
    `insert into content_seed_runs (seed_version, actor, is_dry_run) values ($1, $2, $3) returning id`,
    [seedVersion, process.env.USER ?? process.env.LOGNAME ?? 'unknown', dryRun],
  )
  const runId = runInsert.rows[0].id as string

  for (const seedModule of modules) {
    // One transaction per module: a module either applies whole or not at all. A half-applied
    // module would leave rows whose stored hashes disagree with what the module now says, and
    // every subsequent run would read that as an owner edit and skip them.
    await client.query('begin')
    try {
      for (const record of seedModule.records) {
        try {
          results.push(await applyRecord(record))
        } catch (error) {
          results.push({
            seedKey: record.seedKey,
            table: record.table,
            outcome: 'failed',
            detail: error instanceof Error ? error.message : String(error),
          })
        }
      }
      // A dry run rolls back rather than committing. Nothing above mutates a content row in dry
      // mode, so this is belt and braces — and it is the belt that survives someone adding a
      // write path later and forgetting the dryRun check.
      await client.query(dryRun ? 'rollback' : 'commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }

  const counts = {
    inserted: results.filter((r) => r.outcome === 'inserted').length,
    updated: results.filter((r) => r.outcome === 'updated').length,
    skippedOwnerEdited: results.filter((r) => r.outcome === 'skipped_owner_edited').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
  }

  await client.query(
    `update content_seed_runs
        set finished_at = now(),
            inserted_count = $1, updated_count = $2,
            skipped_owner_edited_count = $3, failed_count = $4,
            report = $5
      where id = $6`,
    [
      counts.inserted,
      counts.updated,
      counts.skippedOwnerEdited,
      counts.failed,
      JSON.stringify({ modules: modules.map((m) => m.name), force, records: results }),
      runId,
    ],
  )

  await client.end()

  // --- report ---
  const label = dryRun ? 'DRY RUN — nothing was written' : 'seed applied'
  console.log(`\n${label}  (version ${seedVersion}${force ? ', FORCED' : ''})`)
  console.log(`  inserted              ${counts.inserted}`)
  console.log(`  updated               ${counts.updated}`)
  console.log(`  skipped (owner edit)  ${counts.skippedOwnerEdited}`)
  console.log(`  failed                ${counts.failed}`)

  const notable = results.filter((r) => r.outcome !== 'inserted' && r.outcome !== 'updated')
  if (notable.length > 0) {
    console.log('\n  not applied:')
    for (const r of notable)
      console.log(`    ${r.outcome.padEnd(20)} ${r.seedKey}  ${r.detail ?? ''}`)
  }
  const forced = results.filter((r) => r.detail?.includes('FORCE'))
  if (forced.length > 0) {
    console.log('\n  FORCE-overwrote owner edits:')
    for (const r of forced) console.log(`    ${r.seedKey}`)
  }

  return counts.failed > 0 ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch(async (error) => {
    console.error('\nseed:content failed\n', error)
    try {
      await client.end()
    } catch {
      // already closed
    }
    process.exit(1)
  })
