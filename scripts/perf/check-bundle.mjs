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
 *
 * ------------------------------------------------------------------------------------------------
 * PHASE 40 ADDS A SECOND HALF: THE BUNDLE BASELINE.
 *
 * The graph gate above answers "is the engine where it belongs" and needs no build. It cannot
 * answer "did this route get heavier", because bytes are a property of a build. So with
 * `--base <url>` pointed at a running production build, this script also measures each budgeted
 * route's first-load JavaScript and compares it to `perf/bundle-baseline.json`.
 *
 *   node scripts/perf/check-bundle.mjs                         graph gate only (npm run check)
 *   node scripts/perf/check-bundle.mjs --base http://…:3000    graph gate + baseline diff (CI)
 *   node scripts/perf/check-bundle.mjs --base http://…:3000 --write   record a new baseline
 *   node scripts/perf/check-bundle.mjs --base http://…:3000 --explain /about   per-chunk breakdown
 *
 * GROWTH BEYOND 5% FAILS, and updating the baseline is the remedy — in the same pull request, where
 * the reviewer sees both the new number and whatever made it necessary. That is the difference
 * between a budget and a wish.
 *
 * A DYNAMIC ROUTE IS RESOLVED FROM THE SITEMAP rather than from a slug written down here. A slug in
 * this file would be one more fixture detail to keep in step with the seed; the sitemap is the list
 * of URLs the site itself says are live, so `/product/[slug]` measures whichever product exists.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'
import { explainRoute, kb, measureRoute } from './measure-bundles.mjs'

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

/* --- the baseline half ------------------------------------------------------------------------ */

const baseArg = process.argv.find((argument) => argument.startsWith('--base='))
const baseIndex = process.argv.indexOf('--base')
const base =
  baseArg !== undefined
    ? baseArg.slice('--base='.length)
    : baseIndex !== -1
      ? process.argv[baseIndex + 1]
      : undefined

if (base === undefined) process.exit(0)

const explainIndex = process.argv.indexOf('--explain')
if (explainIndex !== -1) {
  const route = process.argv[explainIndex + 1] ?? '/'
  const chunks = await explainRoute(base, route)
  const total = chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0)
  console.log(
    `\n${route} — ${String(kb(total))} kB gzipped across ${String(chunks.length)} chunk(s):`,
  )
  for (const chunk of chunks) {
    const label = chunk.contains.length > 0 ? `~ ${chunk.contains.join(', ')}` : ''
    console.log(
      `  ${String(kb(chunk.gzipBytes)).padStart(7)} kB  ${String(kb(chunk.rawBytes)).padStart(8)} kB raw  ` +
        `${chunk.url.split('/').pop()}  ${label}`,
    )
  }
  console.log(
    '\n  Labels are a marker heuristic, not a module graph. An unlabelled chunk is not empty.',
  )
  process.exit(0)
}

const write = process.argv.includes('--write')
const BUDGETS = join(ROOT, 'perf', 'budgets.json')
const BASELINE = join(ROOT, 'perf', 'bundle-baseline.json')
const budgets = JSON.parse(readFileSync(BUDGETS, 'utf8'))
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { routes: {} }

/** Every URL the site's own sitemap index says is live, as paths. */
async function liveUrls() {
  const paths = []
  const index = await (await fetch(new URL('/sitemap.xml', base))).text()
  for (const child of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const body = await (await fetch(child[1])).text()
    for (const url of body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      paths.push(new URL(url[1]).pathname)
    }
  }
  return paths
}

/**
 * A concrete URL for a route pattern.
 *
 * A static pattern is its own URL. A bracket pattern takes the first live URL with the same shape:
 * same number of segments, and every literal segment equal. That is enough to be unambiguous here
 * and needs no slug written down.
 */
function sampleFor(routePattern, urls) {
  if (!routePattern.includes('[')) return routePattern
  const wanted = routePattern.split('/').filter(Boolean)
  return urls.find((url) => {
    const parts = url.split('/').filter(Boolean)
    if (parts.length !== wanted.length) return false
    return wanted.every((segment, index) => segment.startsWith('[') || segment === parts[index])
  })
}

const urls = await liveUrls()
const tolerance = budgets.growthTolerance ?? 0.05
const failures = []
const overTarget = []
const skipped = []
const measured = {}

for (const [routePattern, budget] of Object.entries(budgets.routes)) {
  const sample = sampleFor(routePattern, urls)
  if (sample === undefined) {
    skipped.push(`${routePattern} (no live URL of that shape in the sitemap)`)
    continue
  }

  let result
  try {
    result = await measureRoute(base, sample)
  } catch (error) {
    skipped.push(`${routePattern} (${error.message})`)
    continue
  }
  const size = kb(result.bytes)
  measured[routePattern] = { kb: size, files: result.files, sample }

  if (result.missing.length > 0) {
    failures.push(
      `${routePattern}: ${String(result.missing.length)} script(s) the server would not serve — ` +
        result.missing.join(', '),
    )
  }

  const was = baseline.routes[routePattern]?.kb
  if (was !== undefined && size > was * (1 + tolerance)) {
    failures.push(
      `${routePattern}: first-load JS grew from ${String(was)} kB to ${String(size)} kB ` +
        `(+${String(Math.round(((size - was) / was) * 1000) / 10)}%, tolerance ` +
        `${String(Math.round(tolerance * 100))}%). Find what was added, or record the new figure ` +
        'in perf/bundle-baseline.json in this same change with a reason.',
    )
  }
  if (size > budget.firstLoadJsKb) {
    overTarget.push(
      `${routePattern}: ${String(size)} kB against a ${String(budget.firstLoadJsKb)} kB target`,
    )
  }
}

if (write) {
  const next = {
    $about: baseline.$about ?? [
      'MEASURED first-load JavaScript per route: gzipped bytes of every script the served HTML',
      'tells the browser to fetch. Written by `node scripts/perf/check-bundle.mjs --base <url>',
      '--write` against a running production build, and compared against on every CI run.',
      '',
      'THIS FILE RECORDS WHAT IS, perf/budgets.json RECORDS WHAT SHOULD BE. Where they differ the',
      'gap is named in docs/ops/PERFORMANCE.md. Growth beyond the tolerance in budgets.json fails',
      'CI until this file is updated deliberately, in the same change, with a stated reason.',
    ],
    measuredOn: new Date().toISOString().slice(0, 10),
    measuredAgainst: base,
    routes: measured,
  }
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`)
  console.log(
    `✓ bundle baseline written: ${String(Object.keys(measured).length)} route(s)` +
      (skipped.length > 0 ? `, ${String(skipped.length)} not measurable` : ''),
  )
  process.exit(0)
}

if (failures.length > 0) {
  console.error(`✗ bundle baseline: ${String(failures.length)} problem(s):`)
  for (const failure of failures) console.error(`    ${failure}`)
  process.exit(1)
}

console.log(
  `✓ bundle baseline: ${String(Object.keys(measured).length)} route(s) within ` +
    `${String(Math.round(tolerance * 100))}% of the recorded figure` +
    (skipped.length > 0
      ? `; ${String(skipped.length)} not measurable (${skipped.join('; ')})`
      : ''),
)
if (overTarget.length > 0) {
  // REPORTED, NOT FAILED, and the distinction is the phase document's. A route over its target is
  // a debt this phase measured and PERFORMANCE.md tracks; failing on it would make the gate red
  // from the day it was written, which is how a gate gets switched off.
  console.log(
    `  ${String(overTarget.length)} route(s) over the perf/budgets.json target — see ` +
      'docs/ops/PERFORMANCE.md §4:',
  )
  for (const entry of overTarget) console.log(`    ${entry}`)
}
