import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { connect, disconnect } from '../unit/rls/harness'

/**
 * THE MIGRATION SET AND WHAT THE DATABASE ACTUALLY HAS — Phase 42.
 *
 * `scripts/db/check-migrations.mjs` reads the FILES: no content rows, no duplicate numbers, no
 * gaps. It cannot see a database. `scripts/db/migrate.mjs` reads BOTH but only when somebody runs
 * it, and the case that matters is the one where nobody does: a migration edited after it was
 * applied. The file and the database then disagree forever, `db:reset` produces a schema the
 * production database does not have, and the difference surfaces as an inexplicable failure weeks
 * later.
 *
 * So this compares the two, every run, with the same SHA-256 the runner records.
 *
 * IT DOES NOT REPLAY FROM EMPTY, and the distinction matters: preflight gate 12 does that, because
 * it DROPS EVERY TABLE and must only ever be pointed at a throwaway database. This suite runs
 * beside every other suite on a database with rows in it, so it asserts the properties a replay
 * would prove without doing the dropping: every file applied, every checksum matching, nothing
 * applied that is not on disk, and an ordering that makes a replay deterministic.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error('DATABASE_URL is not set and this environment requires the database suite to run.')
}
const describeDb = HAVE_DB ? describe : describe.skip

const DIR = 'supabase/migrations'

/** The same digest `scripts/db/migrate.mjs` records: SHA-256 of the file's bytes, hex. */
function checksumOf(file: string): string {
  return createHash('sha256').update(readFileSync(join(DIR, file))).digest('hex')
}

const onDisk = readdirSync(DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()

describeDb('the ledger and the files agree', () => {
  let applied = new Map<string, string>()

  beforeAll(async () => {
    const db = await connect()
    const rows = await db.query<{ version: string; checksum: string }>(
      'select version, checksum from public.schema_migrations',
    )
    applied = new Map(rows.rows.map((row) => [row.version, row.checksum]))
  })

  afterAll(async () => {
    await disconnect()
  })

  it('has migrations on disk to compare', () => {
    expect(onDisk.length).toBeGreaterThan(100)
  })

  it('has applied every migration on disk', () => {
    const missing = onDisk.filter((file) => !applied.has(file))
    expect(
      missing,
      'these exist as files and have never been applied here — run `npm run db:migrate -- --apply`',
    ).toEqual([])
  })

  it('has no migration applied that is not on disk', () => {
    /*
     * AN ORPHAN IS A DELETED OR RENAMED MIGRATION. Whatever it did is in this database and in no
     * file, so a fresh `db:reset` produces a different schema and nobody can tell what the
     * difference is.
     */
    const orphans = [...applied.keys()].filter((version) => !onDisk.includes(version))
    expect(orphans, 'applied here, present in no file').toEqual([])
  })

  it('has no migration edited after it was applied', () => {
    /*
     * THE ONE THIS FILE EXISTS FOR. Migrations are forward-only: correcting a mistake means writing
     * the next number, never rewriting the last one. An edit is invisible until somebody resets a
     * database and gets a different schema from production's.
     */
    const drifted = onDisk
      .filter((file) => applied.has(file) && applied.get(file) !== checksumOf(file))
      .map((file) => file)
    expect(
      drifted,
      'the file no longer matches what was applied — migrations are forward-only; write the next number',
    ).toEqual([])
  })

  it('orders by filename the way it orders by number', () => {
    /*
     * A REPLAY APPLIES FILES IN `sort()` ORDER, and the numbers are what a person reasons about. A
     * file named `999_x.sql` beside `0999_y.sql` sorts before every four-digit name and would
     * replay first on a fresh database and second in somebody's head.
     */
    const numbered = onDisk.map((file) => ({ file, n: Number.parseInt(file.slice(0, 4), 10) }))
    for (const entry of numbered) {
      expect(/^\d{4}_/.test(entry.file), `${entry.file} is not NNNN_name.sql`).toBe(true)
    }
    const byNumber = [...numbered].sort((a, b) => a.n - b.n).map((entry) => entry.file)
    expect(byNumber).toEqual(onDisk)
  })

  it('numbers every migration exactly once', () => {
    const numbers = onDisk.map((file) => file.slice(0, 4))
    expect(new Set(numbers).size, 'two migrations share a number').toBe(numbers.length)
  })

  it('passes every parameter an RPC does not default', async () => {
    /*
     * THE DATABASE HALF OF `tests/unit/system-log-rpc.test.ts`, and the gate that would have caught
     * the defect that test was written for.
     *
     * PostgREST resolves an RPC by matching the JSON keys it receives against a signature, and
     * `supabase-js` DROPS a key whose value is `undefined` before serialising. So a call site that
     * omits a parameter the function does not default — or passes `?? undefined` for it, which is
     * the same thing on the wire — fails at runtime with PGRST202 and never at build time.
     *
     * `writeSystemLog` did exactly that for four phases: `system_log_write` defaults none of its
     * thirteen parameters, seven were sent as `?? undefined`, and every write to `system_logs`
     * failed into a caught error that printed one word.
     *
     * SO THE CHECK IS PER CALL SITE, NOT PER FUNCTION. A partially defaulted function is fine —
     * `search_documents_query` takes a query and six optional filters and is used correctly. What
     * is never fine is omitting something with no default.
     */
    const db = await connect()

    /*
     * INPUT PARAMETERS ONLY, AND THE DISTINCTION BIT ONCE ALREADY. `proargnames` also holds the OUT
     * column names of a `returns table` function, so a naive read of it reported
     * `search_documents_query` as requiring `id`, `title`, `body` and six other things that are its
     * RESULT. `proargmodes` is null when every parameter is IN, and otherwise marks each one —
     * `i` in, `b` inout, `v` variadic — so the filter is on that.
     *
     * The trailing `pronargdefaults` input parameters carry a default; the rest are required.
     */
    const functions = await db.query<{ name: string; args: string[] | null; ndefaults: number }>(`
      select p.proname as name,
             (select coalesce(array_agg(name order by ord), '{}')
                from unnest(p.proargnames, coalesce(p.proargmodes, array_fill('i'::"char", array[array_length(p.proargnames, 1)])))
                     with ordinality as a(name, mode, ord)
               where a.mode in ('i', 'b', 'v')) as args,
             p.pronargdefaults as ndefaults
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f' and p.pronargs > 0
         and p.proargnames is not null
    `)
    const required = new Map<string, string[]>()
    for (const row of functions.rows) {
      const names = row.args ?? []
      required.set(row.name, names.slice(0, Math.max(0, names.length - row.ndefaults)))
    }

    /** Every `.rpc('name', { … })` in the data layer, with the keys it passes. */
    const callSites: { file: string; fn: string; keys: string[]; undefinedKeys: string[] }[] = []
    const dir = 'lib/supabase/repositories'
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(join(dir, file), 'utf8')
      const pattern = /\.rpc\(\s*'([a-z0-9_]+)'\s*,\s*\{/g
      let match: RegExpExecArray | null
      while ((match = pattern.exec(source)) !== null) {
        // Walk to the matching brace so a nested object inside the payload does not end it early.
        let depth = 1
        let index = pattern.lastIndex
        while (index < source.length && depth > 0) {
          if (source[index] === '{') depth += 1
          else if (source[index] === '}') depth -= 1
          index += 1
        }
        const body = source.slice(pattern.lastIndex, index - 1)
        const keys = [...body.matchAll(/(?:^|[,{])\s*([a-z0-9_]+)\s*:/gi)].map(
          (entry) => entry[1] as string,
        )
        const undefinedKeys = [
          ...body.matchAll(/([a-z0-9_]+)\s*:[^,]*\bundefined\b/gi),
        ].map((entry) => entry[1] as string)
        callSites.push({ file, fn: match[1] as string, keys, undefinedKeys })
      }
    }

    expect(callSites.length, 'no RPC call sites were found — the scan is broken').toBeGreaterThan(2)

    const problems: string[] = []
    for (const site of callSites) {
      const needed = required.get(site.fn)
      if (needed === undefined || needed.length === 0) continue
      for (const parameter of needed) {
        if (!site.keys.includes(parameter)) {
          problems.push(`${site.file}: ${site.fn} omits ${parameter}, which has no default`)
        } else if (site.undefinedKeys.includes(parameter)) {
          problems.push(
            `${site.file}: ${site.fn} may send undefined for ${parameter}, which has no default — supabase-js drops the key`,
          )
        }
      }
    }
    expect(problems, 'each of these is a PGRST202 at runtime and nothing at build time').toEqual([])
  })

  it('carries a header comment on every migration', () => {
    /*
     * NOT STYLE. A migration is the one artefact nobody can change later, so the reason it exists
     * has to travel with it. A file that opens with DDL and no sentence is one nobody can safely
     * reason about in two years.
     */
    const bare = onDisk.filter((file) => !readFileSync(join(DIR, file), 'utf8').startsWith('--'))
    expect(bare, 'these open with no comment explaining what they change and why').toEqual([])
  })
})
