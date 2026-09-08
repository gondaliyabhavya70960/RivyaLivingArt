#!/usr/bin/env node
/**
 * db:check-hosted-layout — apply every migration to a database laid out the way Supabase lays one
 * out, not the way a plain local cluster does.
 *
 * WHY THIS EXISTS
 * ---------------
 * Local development installs `citext`, `unaccent` and `pg_trgm` into `public`, because that is
 * where `create extension` puts them when nothing says otherwise. A hosted Supabase project
 * installs them into a dedicated `extensions` schema, and `create extension if not exists` is a
 * NO-OP there — it will not move them, and it will not fail.
 *
 * So a migration that resolves an extension object through an unqualified name works perfectly
 * locally and fails on the real project. That is not hypothetical: migration 0003's
 * `rivya_slugify` pinned `search_path = pg_catalog, public` and called
 * `unaccent('unaccent'::regdictionary, …)`. Under the hosted layout it failed at CREATE time with
 *
 *     ERROR:  text search dictionary "unaccent" does not exist
 *
 * The whole Phase 03 migration set was therefore un-appliable to the project it was written for,
 * and every local check passed. `citext` (a column TYPE on eight columns) and `gin_trgm_ops` (two
 * indexes) had the same exposure.
 *
 * This check makes that failure mode reproducible on demand. It creates a scratch database, puts
 * the extensions where Supabase puts them, applies the real migration set unmodified, and drops
 * the database again.
 *
 * It is deliberately NOT a substitute for applying the migrations to the real project — it proves
 * only that extension placement is handled. See docs/ops/ENVIRONMENT.md.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SCRATCH_DB = 'rivya_hosted_layout_check'
const MIGRATIONS_DIR = 'supabase/migrations'
const LOCAL_BOOTSTRAP_DIR = 'supabase/local'

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL is not set. db:check-hosted-layout needs a cluster it can create a scratch\n' +
      'database on:\n  npm run db:reset && npm run db:check-hosted-layout',
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

// Same loopback guard as db:reset: this creates and DROPS a database.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', ''])
if (!LOOPBACK.has(parsed.hostname)) {
  console.error(
    `Refusing to run against a non-loopback host (${parsed.hostname}). This check creates and\n` +
      `drops a scratch database.`,
  )
  process.exit(1)
}

/** A URL for a sibling database on the same cluster. */
function siblingUrl(dbName) {
  const u = new URL(url)
  u.pathname = `/${dbName}`
  return u.toString()
}

const adminUrl = siblingUrl('postgres')
const scratchUrl = siblingUrl(SCRATCH_DB)

function psql(target, args, label, { quiet = false } = {}) {
  try {
    return execFileSync(
      'psql',
      [target, '--no-psqlrc', '--quiet', '--set', 'ON_ERROR_STOP=1', ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (error) {
    if (quiet) return null
    console.error(`\n✗ ${label} failed\n`)
    const stderr = error.stderr?.toString().trim()
    if (stderr) console.error(stderr)
    throw error
  }
}

function dropScratch() {
  psql(adminUrl, ['--command', `drop database if exists ${SCRATCH_DB} with (force);`], 'drop', {
    quiet: true,
  })
}

let failed = false
try {
  dropScratch()
  psql(adminUrl, ['--command', `create database ${SCRATCH_DB};`], 'create scratch database')

  // The whole point: extensions go where Supabase puts them, NOT where `create extension` would
  // put them by default. Migration 0001's `create extension if not exists` then becomes a no-op,
  // exactly as it is on the real project.
  console.log('▸ installing extensions into schema "extensions", as a hosted project does')
  psql(
    scratchUrl,
    [
      '--command',
      `create schema extensions;
       create extension citext   schema extensions;
       create extension unaccent schema extensions;
       create extension pg_trgm  schema extensions;
       create extension pgcrypto schema extensions;`,
    ],
    'extension placement',
  )

  // Prove the premise rather than assuming it: nothing may be left in public.
  const stray = psql(
    scratchUrl,
    [
      '--tuples-only',
      '--no-align',
      '--command',
      `select e.extname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
        where n.nspname = 'public' and e.extname <> 'plpgsql';`,
    ],
    'placement check',
  ).trim()
  if (stray) {
    console.error(`\n✗ setup is wrong: ${stray} landed in public, so this check proves nothing.`)
    process.exit(1)
  }

  if (existsSync(LOCAL_BOOTSTRAP_DIR)) {
    for (const file of readdirSync(LOCAL_BOOTSTRAP_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      psql(scratchUrl, ['--file', join(LOCAL_BOOTSTRAP_DIR, file)], file)
    }
  }

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of migrations) {
    console.log(`▸ ${file}`)
    psql(scratchUrl, ['--single-transaction', '--file', join(MIGRATIONS_DIR, file)], file)
  }

  // A migration applying is necessary but not sufficient — the function must also RUN, because a
  // search_path problem can hide until first call.
  const slug = psql(
    scratchUrl,
    ['--tuples-only', '--no-align', '--command', `select public.rivya_slugify('Résine Écru');`],
    'rivya_slugify smoke test',
  ).trim()
  if (slug !== 'resine-ecru') {
    console.error(`\n✗ rivya_slugify returned "${slug}", expected "resine-ecru"`)
    failed = true
  }

  if (!failed) {
    console.log(
      `\n✓ ${migrations.length} migrations apply with extensions in the "extensions" schema, ` +
        `and rivya_slugify runs`,
    )
  }
} catch {
  failed = true
} finally {
  dropScratch()
}

process.exit(failed ? 1 : 0)
