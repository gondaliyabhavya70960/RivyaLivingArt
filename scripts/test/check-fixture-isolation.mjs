#!/usr/bin/env node
/**
 * THE FIXTURE STAYS IN THE TESTS — Phase 42, preflight gate 9.
 *
 * `scripts/test/seed-fixture.ts` writes rows that are, by any honest reading, fabricated business
 * facts: four products with invented prices marked VERIFIED, five enquirers with names and phone
 * numbers, a research source and twenty competitor listings. That is the correct content for a
 * throwaway test database and a straight breach of the house rules anywhere else.
 *
 * Two directions, and BOTH are needed:
 *
 *   1. NO FIXTURE ID IN THE PRODUCT. A literal `f0000000-0000-4000-8000-…` under `app/`, `lib/`,
 *      `components/`, `content/` or a non-test script means a page, a query or a seed now depends
 *      on a row that only exists because a test put it there. The failure it produces in production
 *      is an empty page nobody can explain; the failure it produces in a demo is a fabricated
 *      product presented as inventory.
 *
 *   2. NO `tests/` IMPORT IN THE PRODUCT. `tests/fixtures/ids.ts` is a module like any other, and a
 *      component importing `FIXTURE_PRODUCTS` to "make the page render in development" is exactly
 *      how the first rule gets broken without a literal ever being typed.
 *
 * IT IS A TEXT SCAN, DELIBERATELY. A type-aware check would follow re-exports and miss a string
 * built by concatenation; a grep for the prefix catches both, and the prefix exists to be grepped.
 *
 * IT ALSO CHECKS THE FIXTURE IS INTERNALLY HONEST: every id the seeder writes must carry the
 * prefix. A fixture row with an ordinary id cannot be cleaned up by the wipe, so it survives
 * `--reset` and accumulates across runs until some unrelated suite fails on a duplicate slug.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

/** The literal from `tests/fixtures/ids.ts`. Kept here as a literal on purpose: this file must not
 *  import from `tests/`, which is the very thing it forbids of everything else. */
const FIXTURE_PREFIX = 'f0000000-0000-4000-8000-'

/**
 * Where the product lives. A fixture id or a `tests/` import in any of these is a finding.
 *
 * `scripts/` IS IN THE LIST, and it matters: `scripts/db/check-data-layer.mjs` learned the same
 * lesson in Phase 41 — a seed script is not "just tooling" when what it writes lands in the
 * database the site reads.
 */
const PRODUCT_DIRS = ['app', 'lib', 'components', 'content', 'scripts', 'supabase']

/**
 * Allowed to name the fixture, each for a reason.
 *
 * A path here is test tooling: it exists to write, clean up or reason about the fixture, and could
 * not do its job without naming it. Nothing that renders, queries or seeds the real site is on this
 * list, and nothing should be added to it without one.
 */
const ALLOWED = new Map([
  ['scripts/test/seed-fixture.ts', 'writes the fixture; naming it is the whole job'],
  ['scripts/test/check-fixture-isolation.mjs', 'this file'],
  ['scripts/test/build-fixture-media.ts', 'builds the committed derivatives the fixture binds'],
])

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|sql)$/
const SKIP_DIR = new Set(['node_modules', '.next', '.git', 'dist', 'coverage', 'test-results'])

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIR.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full))
      continue
    }
    if (SOURCE.test(entry)) out.push(full)
  }
  return out
}

/** `from 'tests/…'`, `from '@/tests/…'`, `require('../../tests/…')` and dynamic `import()`. */
const TESTS_IMPORT =
  /(?:from|import|require)\s*\(?\s*['"](?:@\/tests\/|\.{1,2}\/(?:\.{2}\/)*tests\/|tests\/)/

const findings = []

for (const dir of PRODUCT_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const path = relative(ROOT, file)
    if (ALLOWED.has(path)) continue

    const source = readFileSync(file, 'utf8')

    if (source.includes(FIXTURE_PREFIX)) {
      const line = source.split('\n').findIndex((text) => text.includes(FIXTURE_PREFIX)) + 1
      findings.push({
        path,
        line,
        problem: 'names a fixture id',
        why: 'that row exists only because a test wrote it, and only in a test database',
      })
    }

    const importLine = source.split('\n').findIndex((text) => TESTS_IMPORT.test(text))
    if (importLine >= 0) {
      findings.push({
        path,
        line: importLine + 1,
        problem: 'imports from tests/',
        why: 'test data reaching the product is how a fabricated row becomes a real one',
      })
    }
  }
}

/**
 * THE OTHER DIRECTION: every id the seeder writes carries the prefix.
 *
 * Read from the seeder's source rather than by running it, because a gate that needs a database is
 * a gate that gets skipped. Any UUID-shaped literal in that file that is not a fixture id is a row
 * the wipe cannot reach.
 */
const SEEDER = 'scripts/test/seed-fixture.ts'
const UUID = /['"]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})['"]/gi
let seederSource = ''
try {
  seederSource = readFileSync(join(ROOT, SEEDER), 'utf8')
} catch {
  console.error(`✗ fixture isolation: ${SEEDER} is missing. Gate 9 has nothing to check.`)
  process.exit(1)
}

for (const match of seederSource.matchAll(UUID)) {
  const id = match[1]
  if (id.toLowerCase().startsWith(FIXTURE_PREFIX)) continue
  findings.push({
    path: SEEDER,
    line: seederSource.slice(0, match.index).split('\n').length,
    problem: `writes the id ${id}, which is not a fixture id`,
    why: 'the wipe matches on the prefix, so this row would survive --reset and accumulate',
  })
}

if (findings.length > 0) {
  console.error(`✗ fixture isolation: ${String(findings.length)} finding(s):\n`)
  for (const finding of findings) {
    console.error(`    ${finding.path}:${String(finding.line)} ${finding.problem}`)
    console.error(`      ${finding.why}`)
  }
  console.error(
    '\n  The fixture is test data. If the product needs a row to render, seed it through\n' +
      '  content/seed/** where a person can read what it claims — or fix the empty state.',
  )
  process.exit(1)
}

console.log(
  `✓ fixture isolation: no fixture id and no tests/ import in ${PRODUCT_DIRS.join(', ')}; ` +
    `every id ${SEEDER} writes carries the prefix`,
)
