#!/usr/bin/env node
/**
 * The `unit` vitest project must run with NO DATABASE. This fails the build if one of its files
 * reaches for a cluster.
 *
 * WHY THIS GATE EXISTS: IT IS A DEFECT THAT SHIPPED, TWICE, AND STAYED RED THROUGH THREE MERGES.
 * `.github/workflows/ci.yml` runs `npm run test:unit` as step five — before `db:reset` — and sets
 * `DATABASE_URL` for the WHOLE job so the database gates further down can use it. A unit test that
 * reads that variable therefore does not skip: it connects to a database with no migrations in it,
 * finds nothing, and fails. Phase 26 added two such files, both of them reasoning carefully about
 * the advisory lock and neither about the ordering, and `main` was red from the moment they merged.
 *
 * The invariant was written down in a comment in `ci.yml`, which is exactly why it was broken
 * quietly. A comment describes; a gate enforces.
 *
 * WHAT COUNTS AS REACHING FOR A DATABASE: importing `pg`, or reading `process.env.DATABASE_URL`.
 * Those are the two things a test cannot do without a cluster. Anything else — a repository module
 * imported for its types, a Supabase client that is never called — is fine and is not matched.
 *
 * `tests/unit/rls/**` IS THE EXEMPTION, and it is the whole point: that directory IS the `rls`
 * project, which CI runs at the very end, after the migrations and the seed, with
 * `RLS_TESTS_REQUIRED=1` so a missing database is a failure rather than a skip. Moving a database
 * test there is the fix this gate points at.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** The globs `vitest.config.ts` gives the `unit` project, as roots to walk. */
const ROOTS = ['components', 'lib', 'tests/unit']

/** The one directory inside those roots that IS the other project. */
const RLS_DIR = join('tests', 'unit', 'rls')

const OFFENCES = [
  {
    pattern: /^\s*import\s[^\n]*\bfrom\s+['"]pg['"]/m,
    what: "imports 'pg'",
  },
  {
    pattern: /process\.env\.DATABASE_URL/,
    what: 'reads process.env.DATABASE_URL',
  },
]

function walk(dir) {
  let out = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules') continue
      out = out.concat(walk(path))
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

const offenders = []
for (const root of ROOTS) {
  let files
  try {
    files = walk(root)
  } catch {
    continue
  }
  for (const file of files) {
    const rel = relative(process.cwd(), file)
    if (rel.startsWith(RLS_DIR + sep)) continue

    // A `type` import cannot open a connection, and the moved suites keep one for their signatures.
    const source = readFileSync(file, 'utf8').replace(/^\s*import\s+type\s[^\n]*\n/gm, '')
    for (const { pattern, what } of OFFENCES) {
      if (pattern.test(source)) offenders.push(`${rel} — ${what}`)
    }
  }
}

if (offenders.length > 0) {
  console.error('\n✗ the unit project must run without a database:\n')
  for (const offence of offenders) console.error(`    ${offence}`)
  console.error(
    '\n  CI runs `npm run test:unit` BEFORE `db:reset`, with DATABASE_URL set for the whole job.\n' +
      '  A unit test that connects finds an empty database and fails.\n' +
      '  Move the file (or the block) to tests/unit/rls/, which runs after the migrations.\n',
  )
  process.exit(1)
}

const scanned = ROOTS.flatMap((root) => {
  try {
    return walk(root)
  } catch {
    return []
  }
}).filter((file) => !relative(process.cwd(), file).startsWith(RLS_DIR + sep))

console.log(`✓ unit project is offline: none of its ${scanned.length} test files opens a database`)
