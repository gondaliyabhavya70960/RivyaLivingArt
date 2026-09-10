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
 * IT IS THE IMPORT CLOSURE THAT IS SCANNED, NOT THE TEST FILE. A first version of this gate read
 * `*.test.ts` and nothing else, which made it enforce a rule one `import './helper'` away from
 * being false — and the same change that added the gate also added a shared module beside the
 * tests, so the hole was not hypothetical. `pg` in a helper connects exactly as `pg` in the test
 * does. So each unit test is walked through its RELATIVE and `@/`-aliased imports, and every
 * first-party module it can reach is scanned; an offence in a helper is reported with the test
 * that reaches it, because that is the file whose author has to act.
 *
 * Package imports other than `pg` are not followed: `node_modules` cannot be fixed from here, and
 * a dependency that opens a connection at import time would break far more than this project.
 *
 * `tests/unit/rls/**` IS THE EXEMPTION, and it is the whole point: that directory IS the `rls`
 * project, which CI runs at the very end, after the migrations and the seed, with
 * `RLS_TESTS_REQUIRED=1` so a missing database is a failure rather than a skip. Moving a database
 * test there is the fix this gate points at.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

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

/** Extensions tried when a specifier names a module without one, in resolution order. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx']

function walk(dir, keep) {
  let out = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules') continue
      out = out.concat(walk(path, keep))
    } else if (keep(entry)) {
      out.push(path)
    }
  }
  return out
}

const isTest = (entry) => /\.test\.(ts|tsx)$/.test(entry)

/** Every `from '…'` specifier in a source, including bare `import '…'` side-effect imports. */
function specifiers(source) {
  const found = []
  for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) found.push(match[1])
  for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) found.push(match[1])
  return found
}

/** A first-party specifier resolved to a file on disk, or null when it is a package or missing. */
function resolveSpecifier(specifier, fromFile) {
  let base
  if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else if (specifier.startsWith('@/')) base = resolve(process.cwd(), specifier.slice(2))
  else return null

  const candidates = [
    base,
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/** A `type` import cannot open a connection, and the moved suites keep one for their signatures. */
const readCode = (file) => readFileSync(file, 'utf8').replace(/^\s*import\s+type\s[^\n]*\n/gm, '')

/**
 * Everything `entry` can reach through first-party imports, entry included.
 *
 * `seen` is shared across entries so a helper imported by twenty suites is read once; the walk
 * itself is per-entry so the report can name the test that pulls an offending module in.
 */
function closure(entry, cache) {
  const reached = []
  const queue = [resolve(entry)]
  const visited = new Set()
  while (queue.length > 0) {
    const file = queue.pop()
    if (visited.has(file)) continue
    visited.add(file)
    if (file.includes(`${sep}node_modules${sep}`)) continue

    let source = cache.get(file)
    if (source === undefined) {
      source = readCode(file)
      cache.set(file, source)
    }
    reached.push({ file, source })
    for (const specifier of specifiers(source)) {
      const resolved = resolveSpecifier(specifier, file)
      if (resolved !== null) queue.push(resolved)
    }
  }
  return reached
}

const tests = ROOTS.flatMap((root) => {
  try {
    return walk(root, isTest)
  } catch {
    return []
  }
}).filter((file) => !relative(process.cwd(), file).startsWith(RLS_DIR + sep))

const cache = new Map()
const offenders = []
let modules = 0
const scannedModules = new Set()

for (const test of tests) {
  const rel = relative(process.cwd(), test)
  for (const { file, source } of closure(test, cache)) {
    const via = relative(process.cwd(), file)
    scannedModules.add(via)
    for (const { pattern, what } of OFFENCES) {
      if (!pattern.test(source)) continue
      offenders.push(via === rel ? `${rel} — ${what}` : `${rel} — via ${via}, which ${what}`)
    }
  }
}
modules = scannedModules.size

if (offenders.length > 0) {
  console.error('\n✗ the unit project must run without a database:\n')
  for (const offence of [...new Set(offenders)]) console.error(`    ${offence}`)
  console.error(
    '\n  CI runs `npm run test:unit` BEFORE `db:reset`, with DATABASE_URL set for the whole job.\n' +
      '  A unit test that connects finds an empty database and fails.\n' +
      '  Move the file (or the block) to tests/unit/rls/, which runs after the migrations.\n',
  )
  process.exit(1)
}

console.log(
  `✓ unit project is offline: ${tests.length} test files, ${modules} modules in their import closure, none opens a database`,
)
