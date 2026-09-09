#!/usr/bin/env node
/**
 * db:migrate — apply pending migrations forward, without dropping anything.
 *
 * This is NOT `db:reset`. Reset drops schema `public` and rebuilds from nothing, which is right for
 * a development database and catastrophic for a real one. This script only ever moves forward: it
 * records what it has applied and applies what is missing.
 *
 * Modes:
 *   --plan   (default) connect, report what would be applied, change nothing
 *   --apply            apply the pending migrations
 *
 * Plan is the default so that a mis-click, a stray dispatch, or a wrong argument does nothing.
 * Applying is always something someone had to ask for in words.
 *
 * BOOKKEEPING. `public.schema_migrations` records the version and a SHA-256 of the file. The
 * checksum is the point: it catches a migration EDITED AFTER IT WAS APPLIED, which is the failure
 * that makes a schema untrustworthy. Without it, the database and the migration set can disagree
 * while every run reports "0 pending" — the database has the old definition, the repository shows
 * the new one, and nothing anywhere says so. With it, the run fails and names the file.
 *
 * ATOMICITY. Each migration and its bookkeeping row are applied in ONE transaction — psql executes
 * `--file` and `--command` in the order given, under a single `--single-transaction`. A migration
 * that fails leaves no row, and a row never exists for a migration that did not commit. Getting
 * this wrong in the other direction (record after commit) leaves a half-migrated database claiming
 * to be finished, which is worse than an obvious failure.
 *
 * SECRETS. The connection URL carries a password and is never printed, logged, or included in an
 * error message. Only the hostname is ever shown, and only where it is needed to tell the operator
 * which database they are about to change.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', ''])

/**
 * `supabase/local/**` is NOT applied here, and that omission is load-bearing.
 *
 * `db:reset` applies it because a bare PostgreSQL has no `auth` schema and no `anon` /
 * `authenticated` / `service_role` roles, so the migrations cannot run without a shim. A hosted
 * Supabase project has all of them for real. Applying the shim there would redefine `auth.uid()`
 * and re-grant roles that Supabase manages — replacing the real authentication with a local
 * imitation, on a live database. Anyone reconciling this script against `db:reset` should read
 * this before adding the loop back.
 */

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const allowRemote = args.includes('--allow-remote')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. See docs/ops/ENVIRONMENT.md.')
  process.exit(1)
}

let parsed
try {
  parsed = new URL(url)
} catch {
  console.error('DATABASE_URL is not a valid URL.')
  process.exit(1)
}

const isRemote = !LOOPBACK.has(parsed.hostname)
if (isRemote && !allowRemote) {
  console.error(
    `Refusing to migrate a non-loopback database (host: ${parsed.hostname}).\n` +
      'Pass --allow-remote to say you mean it.',
  )
  process.exit(1)
}

/**
 * Supabase's direct endpoint (`db.<ref>.supabase.co`) resolves to IPv6 only, and GitHub-hosted
 * runners have no IPv6 route. The failure is a connection timeout several minutes in, which reads
 * like a firewall problem and is not one. Caught here so the message names the actual fix.
 */
if (/^db\.[a-z0-9]+\.supabase\.co$/.test(parsed.hostname)) {
  console.error(
    `${parsed.hostname} is Supabase's DIRECT endpoint, which is IPv6-only.\n\n` +
      'From anywhere without IPv6 — GitHub-hosted runners included — this times out rather than\n' +
      'refusing, so it looks like a firewall. Use the SESSION POOLER string instead:\n\n' +
      '  postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n\n' +
      'Session mode, not transaction mode (port 6543): migrations need a real session for DDL,\n' +
      'advisory locks and multi-statement transactions.',
  )
  process.exit(1)
}

function psql(sqlArgs, label, { capture = false } = {}) {
  try {
    const out = execFileSync(
      'psql',
      [url, '--set', 'ON_ERROR_STOP=1', '--no-psqlrc', '--quiet', ...sqlArgs],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    if (!capture && out.trim()) console.log(out.trim())
    return out
  } catch (error) {
    console.error(`\n✗ ${label} failed\n`)
    // stderr from psql can echo a failing statement but never the connection string.
    if (error.stderr) console.error(error.stderr.toString().trim())
    if (error.stdout) console.error(error.stdout.toString().trim())
    process.exit(1)
  }
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  console.error(`No migrations found in ${MIGRATIONS_DIR}`)
  process.exit(1)
}

const checksums = new Map(
  files.map((f) => [
    f,
    createHash('sha256')
      .update(readFileSync(join(MIGRATIONS_DIR, f)))
      .digest('hex'),
  ]),
)

console.log(`▸ target ${parsed.hostname} · ${files.length} migrations in ${MIGRATIONS_DIR}\n`)

// Creating the ledger is safe in plan mode: an empty bookkeeping table changes no application
// behaviour, and without it a first run could not report anything at all.
psql(
  [
    '--command',
    `create table if not exists public.schema_migrations (
       version    text primary key,
       checksum   text not null,
       applied_at timestamptz not null default now()
     );
     -- RLS ON, WITH NO POLICY, WHICH MEANS NOBODY. On Supabase \`anon\` and \`authenticated\` hold
     -- grants on every table in \`public\` — GRANT is not the security boundary there, RLS is the
     -- whole of it — so a bookkeeping table left unguarded publishes the migration filenames and
     -- their checksums to anyone with the anon key. Not catastrophic, and not nothing: it is a map
     -- of the schema's history. This runner connects as the owner and bypasses RLS, so its own
     -- reads and writes are unaffected.
     --
     -- IT IS DONE HERE RATHER THAN IN A MIGRATION because this is where the table is born. A
     -- migration could not cover a database whose ledger the runner had just created, which is
     -- exactly the case that exposed this: \`db:check-schema\` flagged the table the first time a
     -- cluster had one at all.
     alter table public.schema_migrations enable row level security;`,
  ],
  'creating schema_migrations',
  { capture: true },
)

const recorded = new Map(
  psql(
    [
      '--tuples-only',
      '--no-align',
      '--field-separator',
      '|',
      '--command',
      'select version, checksum from public.schema_migrations;',
    ],
    'reading schema_migrations',
    { capture: true },
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('|')
      return [line.slice(0, separator), line.slice(separator + 1)]
    }),
)

const drifted = []
const pending = []

for (const file of files) {
  const known = recorded.get(file)
  if (known === undefined) pending.push(file)
  else if (known !== checksums.get(file)) drifted.push(file)
}

// Applied to the database but absent from the repository: someone applied a migration from a
// branch that was never merged, or deleted a file after applying it.
const orphans = [...recorded.keys()].filter((version) => !checksums.has(version))

if (drifted.length > 0) {
  console.error('✗ these migrations were EDITED AFTER BEING APPLIED:\n')
  for (const file of drifted) console.error(`    ${file}`)
  console.error(
    '\nThe database holds the old definition; the repository shows the new one. Applying the\n' +
      'difference is not something this script can do safely — the change may already be half\n' +
      'present. Write a NEW migration that makes the change, and restore the edited file.',
  )
  process.exit(1)
}

if (orphans.length > 0) {
  console.error('✗ applied to this database but not present in the repository:\n')
  for (const version of orphans) console.error(`    ${version}`)
  console.error('\nThis database has had migrations applied from somewhere else. Stopping.')
  process.exit(1)
}

const upToDate = files.length - pending.length
console.log(`  already applied  ${upToDate}`)
console.log(`  pending          ${pending.length}\n`)

if (pending.length === 0) {
  console.log('✓ nothing to do')
  process.exit(0)
}

for (const file of pending) console.log(`    + ${file}`)
console.log('')

if (!apply) {
  console.log('This was a PLAN. Nothing was changed. Re-run with --apply to apply the above.')
  process.exit(0)
}

for (const file of pending) {
  console.log(`▸ applying ${file}`)
  // One transaction covering both the migration and its ledger row: psql runs --file and --command
  // in the order written, so the insert cannot commit unless the migration did.
  psql(
    [
      '--single-transaction',
      '--file',
      join(MIGRATIONS_DIR, file),
      '--command',
      `insert into public.schema_migrations (version, checksum)
       values ('${file}', '${checksums.get(file)}');`,
    ],
    file,
  )
}

console.log(`\n✓ ${pending.length} migration(s) applied to ${parsed.hostname}`)
