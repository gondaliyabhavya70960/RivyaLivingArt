#!/usr/bin/env node
/**
 * db:reset — drop every object in the target database and re-apply the migration set in order.
 *
 * This is the command CI and local development both use to prove that `supabase/migrations/**`
 * still applies cleanly to an EMPTY database. That property is what makes the migrations
 * forward-only in practice rather than only in policy: if applying 0001..NNNN from nothing ever
 * stops working, this fails.
 *
 * It reads DATABASE_URL from the environment and nothing else — deliberately. It does not load
 * .env.local, because .env.local points at the hosted Supabase project and a reset is the one
 * operation that must never reach it by accident.
 *
 * Safety: refuses any host that is not loopback unless --allow-remote is passed explicitly. There
 * is no supported reason to reset a remote database from this script; the flag exists so the
 * refusal can be overridden deliberately and visibly, never silently.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'
const LOCAL_BOOTSTRAP_DIR = 'supabase/local'
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', ''])

const args = process.argv.slice(2)
const allowRemote = args.includes('--allow-remote')

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL is not set.\n' +
      'For local verification, point it at the local cluster, e.g.\n' +
      '  export DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5433/rivya"\n' +
      'See docs/ops/ENVIRONMENT.md.',
  )
  process.exit(1)
}

let parsed
try {
  parsed = new URL(url)
} catch {
  console.error('DATABASE_URL is not a valid URL.')
  process.exit(1)
}

if (!LOOPBACK.has(parsed.hostname) && !allowRemote) {
  // Never print the URL: it carries a password.
  console.error(
    `Refusing to reset a non-loopback database (host: ${parsed.hostname}).\n` +
      'db:reset DROPS EVERY OBJECT in the target schema. If you genuinely mean to do that to a\n' +
      'remote database, re-run with --allow-remote.',
  )
  process.exit(1)
}

/** Run one psql command, streaming its output, and fail the process on any SQL error. */
function psql(sqlArgs, label) {
  try {
    const out = execFileSync(
      'psql',
      [url, '--set', 'ON_ERROR_STOP=1', '--quiet', '--no-psqlrc', ...sqlArgs],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    if (out.trim()) console.log(out.trim())
  } catch (error) {
    console.error(`\n✗ ${label} failed\n`)
    if (error.stderr) console.error(error.stderr.toString().trim())
    if (error.stdout) console.error(error.stdout.toString().trim())
    process.exit(1)
  }
}

console.log('▸ dropping and recreating schema public + auth')
// `drop schema public cascade` also removes the enums and functions, so a reset genuinely starts
// from nothing rather than from "no tables but yesterday's enum values".
psql(
  [
    '--command',
    'drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;',
  ],
  'schema drop',
)

if (existsSync(LOCAL_BOOTSTRAP_DIR)) {
  for (const file of readdirSync(LOCAL_BOOTSTRAP_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    console.log(`▸ local bootstrap ${basename(file)}`)
    psql(['--file', join(LOCAL_BOOTSTRAP_DIR, file)], file)
  }
}

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

if (migrations.length === 0) {
  console.error(`No migrations found in ${MIGRATIONS_DIR}`)
  process.exit(1)
}

for (const file of migrations) {
  console.log(`▸ ${file}`)
  // Each migration runs in its own transaction. `alter type ... add value` cannot run in a
  // transaction that later uses the new value, which is why enum extensions get their own
  // migration file rather than being appended to an existing one.
  psql(['--single-transaction', '--file', join(MIGRATIONS_DIR, file)], file)
}

console.log(`\n✓ ${migrations.length} migrations applied to an empty database`)
