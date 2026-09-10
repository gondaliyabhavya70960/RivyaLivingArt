/**
 * VIEWER BUNDLE GATE (Phase 21, PERFORMANCE.md §4.3)
 *
 * THE RULE: `three`, `@react-three/*` and `meshoptimizer` may not be reachable from any route's
 * first-load CLIENT graph. The viewer is imported once, dynamically, with `ssr: false`, from the
 * island in `components/patterns/ModelViewerMount/Island.tsx` — and from the Studio drawer, the
 * same way. Every other path to the engine is a regression that would put ~200 kB of WebGL in
 * front of a product photograph.
 *
 * HOW IT IS CHECKED, WITHOUT A BUILD. A `next build` cannot run in every environment this gate
 * must run in, and a chunk name is a bundler detail. What can always be read is the import graph:
 * starting from every `page.tsx` and `layout.tsx` under `app/`, follow STATIC imports (`import x
 * from`, `export ... from`, side-effect imports) and never dynamic `import()` — the boundary that
 * makes the viewer a separate chunk is exactly a dynamic import, so a walk that stops there sees
 * what the first load sees.
 *
 * WHAT COUNTS AS CLIENT. A module is in the client graph once the walk has passed through a file
 * that declares `'use client'`; everything it imports statically ships to the browser. A file that
 * declares `'use server'` or imports `server-only` never does — Next refuses to bundle it for the
 * client — so the walk stops there. The server-side inspector imports the same meshopt decoder the
 * viewer bundles, and that is a Node cost, not a first-load one. A forbidden specifier is a failure
 * ONLY in the client graph; on the server it is tolerated and reported nowhere, because nothing
 * about the visitor's first load changes.
 *
 * TWO MORE FACTS ARE ASSERTED because the viewer is useless without them: the vendored decoders
 * exist under `public/draco/` and `public/basis/`, and the island's import of the viewer is the
 * dynamic form with `ssr: false`.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const ROOT = process.cwd()
const FORBIDDEN = [/^three(\/|$)/, /^@react-three\//, /^meshoptimizer(\/|$)/]
const EXTENSIONS = ['.tsx', '.ts', '.mjs', '.js', '.jsx']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])

function walkDir(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walkDir(full, out)
    else if (/^(page|layout)\.tsx$/.test(entry)) out.push(full)
  }
  return out
}

function resolveSpecifier(specifier, from) {
  const base = specifier.startsWith('@/')
    ? join(ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : null
  if (base === null) return null
  for (const candidate of [base, ...EXTENSIONS.map((extension) => base + extension)]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  for (const extension of EXTENSIONS) {
    const indexFile = join(base, `index${extension}`)
    if (existsSync(indexFile)) return indexFile
  }
  return null
}

/** Static specifiers only. Dynamic `import()` is the chunk boundary and is not followed. */
function staticSpecifiers(source) {
  const masked = stripCommentsAndStrings(source, { strings: false })
  const found = new Set()
  for (const pattern of [
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
  ]) {
    for (const match of masked.matchAll(pattern)) found.add(match[1])
  }
  // `import type` is erased at compile time and ships nothing.
  const typeOnly = new Set()
  for (const match of masked.matchAll(/\bimport\s+type\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g)) {
    typeOnly.add(match[1])
  }
  return [...found].filter((specifier) => !typeOnly.has(specifier))
}

const problems = []
/** file → true once it has been walked as CLIENT; a server-only walk may be upgraded later. */
const seen = new Map()

function directiveOf(source) {
  const head = source.slice(0, 600)
  if (/^\s*['"]use client['"]/m.test(head)) return 'client'
  if (/^\s*['"]use server['"]/m.test(head)) return 'server'
  if (/import\s+['"]server-only['"]/.test(head)) return 'server'
  return null
}

function walk(file, chain, parentIsClient) {
  const key = relative(ROOT, file)
  const source = readFileSync(file, 'utf8')
  const directive = directiveOf(source)
  // A server module never reaches the browser; nothing below it is a first-load cost.
  if (directive === 'server') return
  const isClient = directive === 'client' || parentIsClient
  const before = seen.get(key)
  if (before === true || (before === false && !isClient)) return
  seen.set(key, isClient)
  for (const specifier of staticSpecifiers(source)) {
    if (FORBIDDEN.some((pattern) => pattern.test(specifier))) {
      if (isClient) {
        problems.push(
          `${key} imports \`${specifier}\` statically in the client graph — reached from ` +
            `${chain.join(' → ')}. The engine may only arrive through the dynamic import in ` +
            'ModelViewerMount/Island.tsx.',
        )
      }
      continue
    }
    const resolved = resolveSpecifier(specifier, file)
    if (resolved !== null) walk(resolved, [...chain, relative(ROOT, resolved)], isClient)
  }
}

for (const entry of walkDir(join(ROOT, 'app'))) {
  walk(entry, [relative(ROOT, entry)], false)
}

// The decoders the viewer serves from the origin.
for (const file of [
  'public/draco/draco_wasm_wrapper.js',
  'public/draco/draco_decoder.wasm',
  'public/basis/basis_transcoder.js',
  'public/basis/basis_transcoder.wasm',
]) {
  if (!existsSync(join(ROOT, file)))
    problems.push(`${file} is missing — the viewer cannot decode without it`)
}

// The boundary itself.
const island = readFileSync(
  join(ROOT, 'components', 'patterns', 'ModelViewerMount', 'Island.tsx'),
  'utf8',
)
if (
  !/import\(\s*['"]@\/components\/three\/ModelViewer['"]\s*\)/.test(island) ||
  !/ssr:\s*false/.test(island)
) {
  problems.push(
    'components/patterns/ModelViewerMount/Island.tsx must import the viewer with `import()` and `ssr: false`',
  )
}

if (problems.length > 0) {
  console.error('✗ viewer bundle gate:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

const routes = [...seen.keys()].filter((key) => /^app\/.*\/(page|layout)\.tsx$/.test(key)).length
const clientModules = [...seen.values()].filter(Boolean).length
console.log(
  `✓ viewer bundle gate: no three, @react-three or meshoptimizer import in the client graph of ` +
    `${routes} route files (${seen.size} modules walked, ${clientModules} client); decoders ` +
    `present under public/; the viewer is reached only through the dynamic boundary`,
)
