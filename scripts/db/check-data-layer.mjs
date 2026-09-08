#!/usr/bin/env node
/**
 * db:check-data-layer — the query layering gate.
 *
 * RULE: `.from(` may appear only inside lib/supabase/repositories/**.
 *
 * WHY: a `.from('products')` in a component is a query with no Zod validation at its boundary, no
 * mapping from PostgREST error codes to something a caller can act on, and no single place to fix
 * either. One such call is harmless; the tenth is a data layer nobody designed. This gate is what
 * keeps the count at zero, and it has to run in CI because the tenth one is always added by
 * someone in a hurry.
 *
 * Comments and string literals are stripped before searching, so the doc comments in this
 * repository that discuss `.from(` — including the ones explaining this very rule — do not trip
 * it. See scripts/db/strip-code.mjs.
 */
import { readFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { stripCommentsAndStrings } from './strip-code.mjs'

/** Directories searched. Anything outside these is not application code. */
const ROOTS = ['app', 'lib', 'components', 'content', 'scripts', 'tests']

/** The one place `.from(` is allowed. */
const ALLOWED_PREFIX = join('lib', 'supabase', 'repositories') + sep

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const found = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return found
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...walk(full))
    } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      found.push(full)
    }
  }
  return found
}

/**
 * Built-ins with a legitimate static `from`. These are NOT database queries and must not be
 * reported — Array.from alone appears four times in the Phase 02 component code.
 *
 * A denylist rather than an allowlist of "client-looking" receivers, deliberately. An allowlist
 * would silently miss a real violation whenever a Supabase client is held under an unexpected
 * name; a denylist can only ever fail in the loud direction — a new built-in shows up as a false
 * positive, which someone fixes, instead of a real query slipping past unnoticed.
 */
const BUILT_IN_FROM = new Set([
  'Array',
  'Buffer',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
])

/** Captures the receiver so it can be checked against BUILT_IN_FROM. */
const CALL_PATTERN = /([A-Za-z_$][\w$.]*)?\.from\s*\(/g

const violations = []

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(process.cwd(), file)
    if (rel.startsWith(ALLOWED_PREFIX)) continue

    const code = stripCommentsAndStrings(readFileSync(file, 'utf8'))
    const lines = code.split('\n')
    lines.forEach((line, index) => {
      // `.from(` as a method call. Not `from(` alone: that would match an import statement's
      // `from` and any local helper of that name.
      for (const match of line.matchAll(CALL_PATTERN)) {
        const receiver = match[1]?.split('.').pop() ?? ''
        if (BUILT_IN_FROM.has(receiver)) continue
        violations.push({ file: rel, line: index + 1, snippet: line.trim().slice(0, 90) })
      }
    })
  }
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} query call(s) outside the repository layer:\n`)
  for (const v of violations) {
    console.error(`    ${v.file}:${v.line}\n        ${v.snippet}`)
  }
  console.error(
    `\n  Every read and write goes through lib/supabase/repositories/**, which is where the Zod\n` +
      `  schema and the error mapping live. Add a function there and call that instead.\n`,
  )
  process.exit(1)
}

console.log('✓ no .from( outside lib/supabase/repositories/**')
