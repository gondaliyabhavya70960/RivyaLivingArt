#!/usr/bin/env node
/**
 * site:check-client-boundary — Server Components by default, enforced.
 *
 * TWO RULES, AND THEY FAIL IN DIFFERENT DIRECTIONS.
 *
 *   1. No `'use client'` in any `page.tsx`, `layout.tsx`, `not-found.tsx` or `template.tsx` under
 *      `app/(site)/`. One directive at the top of a layout turns the entire public site into a
 *      client bundle: every Server Component beneath it becomes a client component, none of them
 *      can query the database any more, and the failure presents as "supabase is not defined in
 *      the browser" three files away from the cause.
 *   2. A client component may live only in `components/patterns/**`, `components/three/**`,
 *      `components/studio/**` or `components/primitives/**`. Anywhere else — `components/sections`
 *      especially — it is a renderer that has quietly acquired state, which is how a section stops
 *      being renderable in the Studio preview.
 *
 * `app/(site)/error.tsx` IS EXEMPT FROM RULE 1, and cannot not be: Next requires an error boundary
 * to be a Client Component because it takes `reset`, a callback. `app/global-error.tsx` is exempt
 * for the same reason. Both exemptions are listed by name rather than by pattern, so a third one
 * cannot appear without editing this file and saying why.
 *
 * Exit 1 on any violation. Runs in `npm run check` and in CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()

/** Route files that must never be client components. */
const ROUTE_FILES = new Set([
  'page.tsx',
  'layout.tsx',
  'not-found.tsx',
  'template.tsx',
  'default.tsx',
])

/**
 * The two files Next itself requires to be Client Components. Named individually: a pattern would
 * let `app/(site)/collection/error.tsx` appear later with no discussion.
 */
const CLIENT_REQUIRED = new Set([
  join('app', '(site)', 'error.tsx'),
  join('app', 'global-error.tsx'),
])

/** Where a client component may live. */
const CLIENT_ALLOWED_PREFIXES = [
  join('components', 'patterns') + sep,
  join('components', 'three') + sep,
  join('components', 'studio') + sep,
  join('components', 'primitives') + sep,
]

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])

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
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) found.push(full)
  }
  return found
}

/**
 * Is the first meaningful line `'use client'`?
 *
 * The directive is only a directive at the top of the file — after an import it is an expression
 * statement that does nothing. Matching it anywhere would report a file that mentions it in a
 * comment, which several in this repository do, including this one.
 */
function isClientComponent(source) {
  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (
      trimmed === '' ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    ) {
      continue
    }
    return trimmed === "'use client'" || trimmed === '"use client"'
  }
  return false
}

const violations = []

for (const file of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'components'))]) {
  const rel = relative(ROOT, file)
  const source = readFileSync(file, 'utf8')
  if (!isClientComponent(source)) continue

  if (CLIENT_REQUIRED.has(rel)) continue

  const basename = rel.split(sep).pop() ?? ''
  if (rel.startsWith(join('app', '(site)') + sep) && ROUTE_FILES.has(basename)) {
    violations.push(`${rel}: a public route file may not be a Client Component`)
    continue
  }

  if (
    rel.startsWith('components' + sep) &&
    !CLIENT_ALLOWED_PREFIXES.some((p) => rel.startsWith(p))
  ) {
    violations.push(
      `${rel}: a Client Component may live only in components/{patterns,three,studio,primitives}`,
    )
  }
}

if (violations.length > 0) {
  console.error('✗ client boundary violations:\n')
  for (const violation of violations) console.error(`    ${violation}`)
  console.error('')
  process.exit(1)
}

console.log('✓ client boundary: no "use client" in a public route file')
