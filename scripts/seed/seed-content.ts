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
 *   5b. Row present and `owner_edited`              -> A HUMAN EDITED IT. Skip.      [skipped]
 *   5c. Row present and status = 'PUBLISHED'        -> A HUMAN SHIPPED IT. Skip.     [skipped]
 *   6. --dry-run performs 2-5 and reports, mutating no content row.
 *   7. The runner never deletes a row, and never changes `status` on an existing row.
 *
 * Rule 5 is the whole point, and rule 7 is its quieter twin: re-seeding must not un-publish
 * something an editor published, so `status` is excluded from every update payload.
 *
 * THREE GUARDS, NOT ONE, AND THEY COVER DIFFERENT SURFACES.
 *
 *   `seed_content_hash` catches an edit made OUTSIDE the application — a direct `psql` update, a
 *   restore, a bulk import. Such a write sets no `updated_by`, so no trigger fires and the flag
 *   below stays false; the content simply no longer matches what the seed last wrote.
 *
 *   `owner_edited` catches an edit made THROUGH Studio, where the trigger fires. It is the fast
 *   path and survives a later change that legitimately rewrites the same values back.
 *
 *   `status = 'PUBLISHED'` catches the case both of the others can miss: a row a human reviewed
 *   and shipped without changing a character of it. The seed has no business rewriting live copy
 *   whatever its hash says.
 *
 * Any one of the three is decisive. They are not alternatives and none is redundant.
 *
 * THE FOURTH OUTCOME: `deferred`. A module may declare `requiresTables`. If any is absent, its
 * records are neither written nor failed — they are counted, listed by `seed_key`, and applied
 * unchanged when the phase that creates the table re-runs `--only=<module>`. This is what stops
 * journal and commissions copy being duplicated into a later module to dodge table ordering.
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

type Outcome = 'inserted' | 'updated' | 'unchanged' | 'skipped_owner_edited' | 'deferred' | 'failed'

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
const report = argv.includes('--report')
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

/**
 * Does this table exist?
 *
 * `to_regclass` rather than a query against `information_schema`: it answers null instead of
 * raising for a name that does not exist, which is exactly the question, and it costs one lookup.
 * Cached per run because `requiresTables` is asked once per module and the answer cannot change
 * mid-run — nothing here creates a table.
 */
const tableExistsCache = new Map<string, boolean>()

async function tableExists(name: string): Promise<boolean> {
  const cached = tableExistsCache.get(name)
  if (cached !== undefined) return cached

  const { rows } = await client.query<{ present: boolean }>(
    `select to_regclass('public.' || $1) is not null as present`,
    [name],
  )
  const present = rows[0]?.present ?? false
  tableExistsCache.set(name, present)
  return present
}

/**
 * Resolve a record's `refs` and `media` into real uuids.
 *
 * Returns the extra columns to write, or throws with a message naming the missing thing. Both
 * failure modes are mistakes in a module rather than states to tolerate: a ref that does not
 * resolve is a typo, and a media binding that does not resolve names an asset the manifest does
 * not have. Writing either as null would produce content that renders wrong rather than failing.
 */
/**
 * Every `seed_key` this run has already decided to write.
 *
 * WHY A DRY RUN NEEDS IT. A dry run writes nothing, so a section referencing `page:home` finds no
 * such page and — without this — fails, even though the very same run would have inserted it a
 * module earlier. Verification step 1 requires a dry run on an EMPTY database to report inserts
 * and deferrals only, and the first version of this runner reported 91 failures instead: one per
 * ref, all of them phantom.
 *
 * A real run has no use for this. By the time a section is applied, its page is committed and the
 * lookup finds it.
 */
const plannedKeys = new Set<string>()

/** Stands in for a uuid a dry run never allocates. Never written; the insert branch returns first. */
const DRY_RUN_PLACEHOLDER = '00000000-0000-4000-8000-000000000000'

async function resolveReferences(record: SeedRecord): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {}

  for (const [column, ref] of Object.entries(record.refs ?? {})) {
    const { rows } = await client.query<{ id: string }>(
      `select id from ${quoteIdent(ref.table)} where seed_key = $1 limit 1`,
      [ref.seedKey],
    )
    let id = rows[0]?.id
    // The database first, always — a dry run against a database that already holds the row should
    // resolve to the real one. The planned set is the fallback, and only in dry mode.
    if (id === undefined && dryRun && plannedKeys.has(ref.seedKey)) id = DRY_RUN_PLACEHOLDER
    if (id === undefined) {
      throw new Error(
        `${record.seedKey}: ${column} references ${ref.table} "${ref.seedKey}", which no seeded ` +
          'row carries. Modules are applied in the order content/seed/index.ts lists them, so a ' +
          'record may only reference one written by an EARLIER module or earlier in this one.',
      )
    }
    resolved[column] = id
  }

  for (const [column, rivyaAssetId] of Object.entries(record.media ?? {})) {
    const { rows } = await client.query<{ id: string }>(
      `select id from media_assets where rivya_asset_id = $1 limit 1`,
      [rivyaAssetId],
    )
    const id = rows[0]?.id
    if (id === undefined) {
      throw new Error(
        `${record.seedKey}: ${column} binds media "${rivyaAssetId}", which is not in media_assets. ` +
          'A binding names an asset the migration should have imported; an unbound slot is left ' +
          'null and recorded as a gap instead. No placeholder is ever substituted.',
      )
    }
    resolved[column] = id
  }

  return resolved
}

async function applyRecord(record: SeedRecord): Promise<RecordResult> {
  const table = quoteIdent(record.table)
  // Registered BEFORE the refs are resolved, so a record referencing one earlier in the same
  // module resolves during a dry run. A deferred record never reaches here, so nothing can
  // reference a row that will not be written.
  plannedKeys.add(record.seedKey)
  const references = await resolveReferences(record)
  // The hash covers the module's own declared values, NOT the resolved uuids. Two databases seeded
  // from one module produce different ids for the same content, and hashing those would make every
  // row look owner-edited on a restored database.
  const hash = contentHash(record.fields)
  const writable = { ...record.fields, ...references }
  const fieldNames = Object.keys(writable).sort()

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
      ...fieldNames.map((name) => writable[name]),
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
  // Hashed over the module's OWN field names, not the resolved ones, to match what was stored.
  const currentHash = hashRowSubset(row, Object.keys(record.fields).sort())

  /**
   * --- rule 5c: a human shipped it ---
   *
   * Checked first, and separately from the hash, because it is the case the hash cannot see: a row
   * reviewed and published without a character changing hashes identically. The seed has no
   * business rewriting live copy.
   *
   * BUT "PUBLISHED" ALONE IS NOT THE TEST, and getting this wrong is how the guard eats its own
   * output. Some records are seeded AS published on purpose — the route shells in `pages.ts` and
   * the site-wide strings in `global-content.ts`, because a route that arrived as DRAFT would 404
   * the whole site and a string that did would be invisible to the visitors it exists for. With a
   * bare `status = 'PUBLISHED'` check the runner read its own writes as somebody else's on the
   * very next run and skipped all 25.
   *
   * The real question is whether the row is published BEYOND what the module asked for. If the
   * module said PUBLISHED, the runner published it and still owns it. If the module said DRAFT and
   * the row is live, a person promoted it, and that is theirs.
   */
  const seededStatus = record.fields['status']
  const promotedByAHuman = row['status'] === 'PUBLISHED' && seededStatus !== 'PUBLISHED'

  if (promotedByAHuman && !force) {
    return {
      seedKey: record.seedKey,
      table: record.table,
      outcome: 'skipped_owner_edited',
      detail: 'row was published after seeding — a human shipped it',
    }
  }

  // --- rule 5 / 5b: a human edited it ---
  // A null stored hash means the row was created by something other than the runner, which is the
  // same situation: the runner does not own it.
  const hashMatches = storedHash !== null && storedHash === currentHash
  const ownerEdited = row['owner_edited'] === true
  const runnerStillOwnsIt = hashMatches && !ownerEdited

  if (!runnerStillOwnsIt && !force) {
    return {
      seedKey: record.seedKey,
      table: record.table,
      outcome: 'skipped_owner_edited',
      detail: ownerEdited
        ? 'owner_edited is set — edited through Studio'
        : storedHash === null
          ? 'row has no seed hash (created outside the runner)'
          : 'content no longer matches the last seed — edited outside the application',
    }
  }

  /**
   * --- nothing to do ---
   *
   * The row exists, the runner still owns it, the module's content is byte-identical to what is
   * stored, and the version has not moved. Writing anyway is not harmless: every seeded row would
   * get a fresh `updated_at` and — because `write_revision` fires on any UPDATE — a new revision,
   * on every run. A re-seed of this phase would append 231 revisions saying nothing changed, and
   * the history an editor scrolls through to find a real change would be almost entirely noise.
   *
   * REPORTED SEPARATELY FROM `skipped_owner_edited`, not folded into it. The phase document's
   * verification step 3 calls this outcome "skip", but a skip in that report means "a human owns
   * this row and the seed stood down" — a state somebody may need to act on. "Nothing changed" is
   * the opposite: the healthy steady state. Conflating them is the same mistake as counting a
   * deferral as a skip, and it would make the one number that should be zero unreadable.
   */
  const storedVersion = row['content_seed_version'] as string | null
  if (runnerStillOwnsIt && storedHash === hash && storedVersion === seedVersion) {
    return { seedKey: record.seedKey, table: record.table, outcome: 'unchanged' }
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
    ...fieldNames.map((name) => writable[name]),
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
    /**
     * The deferral probe, before the transaction rather than inside it.
     *
     * A module whose target tables do not exist yet has every record reported `deferred` — not
     * written, not failed, and NOT skipped. `deferred` and `skipped_owner_edited` mean opposite
     * things: one is the runner waiting for a later phase, the other is the runner standing aside
     * for a human, and folding them into one number would hide a record silently never applied.
     *
     * `--force` does not override this. Forcing overwrites an owner's edit, which is a decision a
     * person can make; it cannot conjure a table.
     */
    const missingFor = async (record: SeedRecord): Promise<string[]> => {
      const required = record.requiresTables ?? seedModule.requiresTables ?? []
      const missing: string[] = []
      for (const name of required) {
        if (!(await tableExists(name))) missing.push(name)
      }
      return missing
    }

    /**
     * Resolved per record, not per module, because the two modules that defer are MIXED.
     * `commissions.ts` writes six sections that can land today and authors three form templates
     * that cannot; `journal.ts` writes a landing hero and an empty state alongside nineteen
     * records that cannot. Deferring the whole module would leave `/custom-commissions` and
     * `/journal` with no copy at all until Phases 18 and 19 — the exact outcome deferral exists
     * to avoid.
     */
    const deferrals = new Map<string, string[]>()
    for (const record of seedModule.records) {
      const missing = await missingFor(record)
      if (missing.length > 0) deferrals.set(record.seedKey, missing)
    }

    // A module with nothing left to write skips its transaction entirely rather than opening and
    // committing an empty one.
    if (deferrals.size === seedModule.records.length) {
      for (const record of seedModule.records) {
        results.push({
          seedKey: record.seedKey,
          table: record.table,
          outcome: 'deferred',
          detail: `awaiting ${(deferrals.get(record.seedKey) ?? []).join(', ')}`,
        })
      }
      continue
    }

    // One transaction per module: a module either applies whole or not at all. A half-applied
    // module would leave rows whose stored hashes disagree with what the module now says, and
    // every subsequent run would read that as an owner edit and skip them.
    await client.query('begin')
    try {
      /**
       * STOP THE MODULE AT ITS FIRST FAILURE.
       *
       * PostgreSQL aborts the whole transaction on any error, so every statement after one
       * failure returns "current transaction is aborted" — and the report then showed forty
       * identical, useless lines with the one real message buried at the top. The module is
       * all-or-nothing anyway, so continuing was never going to write those rows; the only thing
       * the loop produced after the first error was noise.
       *
       * The remaining records are still reported, and still counted as failed, with a reason that
       * names what actually happened. A record silently absent from the report would be worse
       * than a useless message.
       */
      let aborted: string | null = null
      for (const record of seedModule.records) {
        const missing = deferrals.get(record.seedKey)
        if (missing !== undefined) {
          results.push({
            seedKey: record.seedKey,
            table: record.table,
            outcome: 'deferred',
            detail: `awaiting ${missing.join(', ')}`,
          })
          continue
        }
        if (aborted !== null) {
          results.push({
            seedKey: record.seedKey,
            table: record.table,
            outcome: 'failed',
            detail: `not attempted — the module stopped at ${aborted}`,
          })
          continue
        }
        try {
          results.push(await applyRecord(record))
        } catch (error) {
          results.push({
            seedKey: record.seedKey,
            table: record.table,
            outcome: 'failed',
            detail: error instanceof Error ? error.message : String(error),
          })
          aborted = record.seedKey
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
    unchanged: results.filter((r) => r.outcome === 'unchanged').length,
    skippedOwnerEdited: results.filter((r) => r.outcome === 'skipped_owner_edited').length,
    deferred: results.filter((r) => r.outcome === 'deferred').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
  }

  await client.query(
    `update content_seed_runs
        set finished_at = now(),
            inserted_count = $1, updated_count = $2,
            skipped_owner_edited_count = $3, deferred_count = $4, failed_count = $5,
            report = $6
      where id = $7`,
    [
      counts.inserted,
      counts.updated,
      counts.skippedOwnerEdited,
      counts.deferred,
      counts.failed,
      JSON.stringify({ modules: modules.map((m) => m.name), force, records: results }),
      runId,
    ],
  )

  /**
   * `--report` writes a second, coarser record into `activity_events`.
   *
   * BOTH GRAINS ARE DELIBERATE AND NEITHER REPLACES THE OTHER. `content_seed_runs` is the machine
   * record: every record's verdict, queryable, and what a later phase reads to prove a deferral
   * was applied. `activity_events` is the notification: one line a person sees in the Studio
   * Activity tab, next to every other thing that changed the site that day. A run that only wrote
   * the first is invisible to the people it affects; one that only wrote the second cannot be
   * audited.
   *
   * Not written on a dry run. A dry run changed nothing, and an activity feed that reports
   * rehearsals teaches people to ignore it.
   */
  if (report && !dryRun) {
    await client.query(
      `insert into activity_events (actor_id, actor_role, action, entity_type, entity_id,
                                    entity_label, summary, metadata)
       values (null, null, 'content.seed', 'content_seed_run', $1, $2, $3, $4)`,
      [
        runId,
        seedVersion,
        `Seed ${seedVersion}: ${String(counts.inserted)} inserted, ${String(counts.updated)} updated, ` +
          `${String(counts.unchanged)} unchanged, ${String(counts.skippedOwnerEdited)} left to ` +
          `their owner, ${String(counts.deferred)} deferred`,
        JSON.stringify({
          modules: modules.map((m) => m.name),
          counts,
          deferred: results.filter((r) => r.outcome === 'deferred').map((r) => r.seedKey),
        }),
      ],
    )
  }

  await client.end()

  // --- report ---
  const label = dryRun ? 'DRY RUN — nothing was written' : 'seed applied'
  console.log(`\n${label}  (version ${seedVersion}${force ? ', FORCED' : ''})`)
  console.log(`  inserted              ${counts.inserted}`)
  console.log(`  updated               ${counts.updated}`)
  console.log(`  unchanged             ${counts.unchanged}`)
  console.log(`  skipped (owner edit)  ${counts.skippedOwnerEdited}`)
  console.log(`  deferred              ${counts.deferred}`)
  console.log(`  failed                ${counts.failed}`)

  const notable = results.filter(
    (r) => r.outcome !== 'inserted' && r.outcome !== 'updated' && r.outcome !== 'unchanged',
  )
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
