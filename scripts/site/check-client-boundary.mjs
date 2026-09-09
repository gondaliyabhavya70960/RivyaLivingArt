#!/usr/bin/env node
/**
 * site:check-client-boundary — Server Components by default, enforced.
 *
 * THREE RULES, AND THEY FAIL IN DIFFERENT DIRECTIONS.
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
 *   3. Nothing a client component imports, at any depth, may import `server-only`. This one is
 *      about a build that fails rather than a design that erodes, and it is here because it cost
 *      a deploy: `lib/cms/media.ts` opens with `import 'server-only'` — correctly, it queries
 *      Supabase — and the product gallery's client components imported one pure helper out of it.
 *      `next build` rejected the whole route with
 *
 *          Error: 'server-only' cannot be imported from a Client Component module
 *
 *      NOTHING ELSE IN `npm run check` SEES THIS. `tsc` does not model the RSC boundary,
 *      `vitest.config.ts` deliberately aliases `server-only` to an empty module so unit tests can
 *      import server modules at all, and rules 1 and 2 above only ever read the directive. That
 *      left `next build` — three minutes, and on CI rather than before the push — as the only
 *      thing standing between a pure-helper import and a red deploy. So rule 3 walks the import
 *      graph out of every client component and reports the chain, in about a second.
 *
 *      THE FIX IS ALWAYS TO MOVE THE HELPER, NOT TO DROP THE `server-only`. `mediaRefOf` now lives
 *      in `lib/media/ref.ts`, which has no server dependency, and `lib/cms/media.ts` re-exports it
 *      so its server-side callers did not change. An exemption list would be the wrong shape here:
 *      the import either happens at runtime or it does not, and if it does the build fails.
 *
 * `app/(site)/error.tsx` IS EXEMPT FROM RULE 1, and cannot not be: Next requires an error boundary
 * to be a Client Component because it takes `reset`, a callback. `app/global-error.tsx` is exempt
 * for the same reason. Both exemptions are listed by name rather than by pattern, so a third one
 * cannot appear without editing this file and saying why.
 *
 * Exit 1 on any violation. Runs in `npm run check` and in CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

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
 * The file's opening directive, if it has one.
 *
 * A DIRECTIVE IS ONLY A DIRECTIVE AT THE TOP OF THE FILE — after an import it is an expression
 * statement that does nothing. Matching `'use client'` anywhere would report a file that merely
 * mentions it in a comment, which several in this repository do, including this one.
 */
function topDirective(source) {
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
    const match = /^['"](use client|use server)['"]$/.exec(trimmed)
    return match === null ? null : match[1]
  }
  return null
}

function isClientComponent(source) {
  return topDirective(source) === 'use client'
}

/**
 * A `'use server'` module is where the client graph ENDS, not somewhere it continues.
 *
 * Next compiles a Server Actions file into an RPC stub on the client side: importing one from a
 * Client Component ships an id and a fetch, never the module. So `content/actions.ts` may import
 * `lib/supabase/admin.ts`, and through it the service-role key, while being imported by
 * `PageEditor.tsx` — and that is the whole design of Server Actions rather than a leak. Descending
 * through it reported five such modules as violations on the first run of this rule.
 */
function isServerActions(source) {
  return topDirective(source) === 'use server'
}

/**
 * Following an import the way the bundler does, and only that far.
 *
 * `@/x` is the tsconfig alias for the repository root; a relative specifier resolves from the
 * importing file. A bare specifier is a package, so it leaves the graph — `server-only` itself is
 * one, which is why it is detected by name below rather than by resolution.
 *
 * Returns null for anything that does not land on a file we can read, and that is deliberate: an
 * unresolvable specifier is not a violation this script can prove, and guessing would turn a
 * missing file into a boundary error and send the reader to the wrong problem.
 */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']

function resolveImport(specifier, fromFile) {
  let base
  if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier)
  else return null

  const candidates = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ]
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      // Not a path — try the next shape.
    }
  }
  return null
}

/**
 * The specifiers a module pulls in AT RUNTIME.
 *
 * `import type` and `export type` are excluded because SWC erases them entirely: a type-only edge
 * puts nothing in the bundle, so following it would report a violation that cannot happen. A MIXED
 * import (`import { type A, b } from …`) is NOT type-only and is followed — the statement survives
 * for `b`, and with it everything the module does on the way in.
 *
 * Regex rather than a parser, matching this repository's other gates. Import statements here are
 * prettier-formatted and start their line, which is what the `m` anchor relies on; a specifier
 * mentioned inside a comment or a string resolves to nothing and drops out at `resolveImport`.
 */
const FROM_RE = /^\s*(?:import|export)\s+([\s\S]*?)\bfrom\s*['"]([^'"]+)['"]/gm
const SIDE_EFFECT_RE = /^\s*import\s*['"]([^'"]+)['"]/gm
const DYNAMIC_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g

function importSpecifiers(source) {
  const found = new Set()
  for (const [, clause, specifier] of source.matchAll(FROM_RE)) {
    if (/^type\b/.test(clause.trim())) continue
    found.add(specifier)
  }
  for (const [, specifier] of source.matchAll(SIDE_EFFECT_RE)) found.add(specifier)
  for (const [, specifier] of source.matchAll(DYNAMIC_RE)) found.add(specifier)
  return found
}

/** Does this module poison a client graph? `server-only` throws at import time in the browser. */
function isServerOnly(source) {
  return /^\s*import\s*['"]server-only['"]/m.test(source)
}

const violations = []

/**
 * `lib` is walked as well, and only for rule 3. Rules 1 and 2 are about where a client component
 * may LIVE and neither prefix matches `lib/`, so those files fall past both tests; what matters is
 * that `lib/supabase/browser.ts` carries the directive, and a graph seeded only from `components`
 * and `app` would not start from it.
 */
const clientSeeds = []

for (const file of [
  ...walk(join(ROOT, 'app')),
  ...walk(join(ROOT, 'components')),
  ...walk(join(ROOT, 'lib')),
]) {
  const rel = relative(ROOT, file)
  const source = readFileSync(file, 'utf8')
  if (!isClientComponent(source)) continue

  clientSeeds.push(file)

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

/**
 * Rule 3. One breadth-first walk out of every client component at once.
 *
 * The queue is seeded with all of them rather than run per-seed because the answer wanted is "is
 * this module reachable from ANY client component", and a shared `parent` map both prevents
 * re-walking a module that forty components import and records the shortest chain to it — which is
 * the chain worth printing, since a longer one through the same module says nothing extra.
 */
const parent = new Map()
const queue = []
for (const seed of clientSeeds) {
  if (parent.has(seed)) continue
  parent.set(seed, null)
  queue.push(seed)
}

/** The import chain from a client component down to `file`, repo-relative, outermost first. */
function chainTo(file) {
  const chain = []
  for (let at = file; at !== undefined && at !== null; at = parent.get(at)) {
    chain.unshift(relative(ROOT, at))
  }
  return chain
}

for (let head = 0; head < queue.length; head += 1) {
  const file = queue[head]
  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    continue
  }

  // The seeds themselves are client components, so the boundary only applies below them.
  if (parent.get(file) !== null && isServerActions(source)) continue

  if (isServerOnly(source) && parent.get(file) !== null) {
    violations.push(
      `${relative(ROOT, file)}: imports 'server-only' but is reachable from a Client Component\n` +
        `        ${chainTo(file).join('\n          → ')}`,
    )
    // Not descending. Everything below is reachable only THROUGH this module, so reporting it too
    // would bury the one import that has to move under a list of its consequences.
    continue
  }

  for (const specifier of importSpecifiers(source)) {
    const target = resolveImport(specifier, file)
    if (target === null || parent.has(target)) continue
    parent.set(target, file)
    queue.push(target)
  }
}

if (violations.length > 0) {
  console.error('✗ client boundary violations:\n')
  for (const violation of violations) console.error(`    ${violation}`)
  console.error('')
  process.exit(1)
}

console.log(
  `✓ client boundary: no "use client" in a public route file, and no 'server-only' module ` +
    `among the ${parent.size} reachable from ${clientSeeds.length} client components`,
)
