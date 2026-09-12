#!/usr/bin/env node
/**
 * THE DOCUMENTATION CONTRACT, AS A GATE — Phase 44, gate 5 of `scripts/ops/preflight.ts`.
 *
 * `ENVIRONMENT.md` §1 states a four-step contract for adding an environment variable, and step 4 is
 * the one nobody does: the name goes into `.env.example` and into the code, and the document that
 * explains what it is for and who rotates it never changes. Six months later somebody finds a
 * variable in a Vercel dashboard with no record of why it exists or whether it is safe to remove.
 *
 * SO THIS COMPARES TWO SETS. Every variable name in `.env.example` must appear somewhere in
 * `docs/ops/ENVIRONMENT.md`, and every variable the code READS must appear in `.env.example`. Both
 * directions matter: the first catches a name nobody documented, the second catches a name nobody
 * declared.
 *
 * IT IS DELIBERATELY THE MINIMUM. Phase 01 named this script, and the sentence that used to sit
 * here said Phase 46 would extend it with the D7 document map, front-matter checks and the claim
 * vocabulary. IT DID NOT, AND ON PURPOSE — those three live in `scripts/docs/audit-docs.mjs`
 * instead, and the reason is blast radius. THIS script is gate 5 of `scripts/ops/preflight.ts` and
 * runs inside `npm run check` on every commit, so it must stay fast and must never fail for a
 * reason unrelated to the environment contract. The audit walks all of `docs/**` twice, parses the
 * D7 map out of the binding contract, and is run deliberately — by a phase, by CI, by a person
 * about to hand the repository over. One script doing both would make every commit wait for a
 * documentation audit, and would make a documentation problem look like an environment problem.
 *
 * WHAT PHASE 46 DID ADD HERE is the OTHER half of the claim work, because it belongs beside the
 * contract it resembles: `--claims` asserts that **a documented capability names the file or route
 * that implements it**. Same shape as the four-step environment contract — a claim in prose, an
 * artefact in the repository, and a gate that refuses to let them drift apart.
 *
 * IT NEVER READS A VALUE. `.env.example` carries names with empty values by construction, and this
 * script takes the part before the `=` and discards the rest before anything else happens.
 *
 * Exit 1 on any variable that is used but not declared, or declared but not documented; with
 * `--claims`, on any capability claim whose section names nothing that resolves.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/*
 * The brace expander is D7's, imported rather than copied: both gates have to agree about what
 * `lib/scraper/core/{a,b}.ts` means, and two copies of that logic would eventually not. Importing
 * `audit-docs.mjs` runs nothing — its CLI is behind the `import.meta.url` guard.
 */
import { expandBraces, listDocFiles, READ_ONLY_PREFIX } from './audit-docs.mjs'

const ROOT = process.cwd()
const EXAMPLE = '.env.example'
const DOC = 'docs/ops/ENVIRONMENT.md'

/**
 * Names that are read but are not ours to declare.
 *
 * `NODE_ENV` and `CI` come from the toolchain. The `VERCEL_*` family is injected by the platform and
 * `ENVIRONMENT.md` says so in its own section — D8 lists what the PROJECT sets, and asking the owner
 * to declare a variable they cannot set would be asking for a lie.
 */
const PLATFORM =
  /^(?:NODE_ENV|CI|VERCEL(?:_|$)|npm_|ANALYZE$|RLS_TESTS_REQUIRED$|PLAYWRIGHT|STUDIO_STORAGE_STATE$|DATABASE_URL$|PGPASSWORD$|POSTGREST|LOCAL_REST_PORT$|PRODUCTION_WHATSAPP_NUMBER$)/

const SOURCE_DIRS = ['app', 'lib', 'components', 'content', 'proxy.ts', 'next.config.ts']

function walk(entry, out = []) {
  const full = join(ROOT, entry)
  let stats
  try {
    stats = statSync(full)
  } catch {
    return out
  }
  if (stats.isFile()) {
    if (/\.(?:ts|tsx|mjs)$/.test(entry)) out.push(entry)
    return out
  }
  for (const child of readdirSync(full)) {
    if (child === 'node_modules' || child.startsWith('.')) continue
    walk(join(entry, child), out)
  }
  return out
}

/** The names declared in `.env.example`, ignoring comments and every value. */
function declaredNames() {
  const names = new Set()
  for (const line of readFileSync(join(ROOT, EXAMPLE), 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const name = trimmed.split('=')[0]?.trim()
    if (name !== undefined && name !== '') names.add(name)
  }
  return names
}

/** Every `process.env.X` and `process.env['X']` the product reads. */
function usedNames() {
  const names = new Map()
  for (const entry of SOURCE_DIRS) {
    for (const file of walk(entry)) {
      const source = readFileSync(join(ROOT, file), 'utf8')
      for (const match of source.matchAll(
        /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\])/g,
      )) {
        const name = match[1] ?? match[2]
        if (name === undefined || PLATFORM.test(name)) continue
        if (!names.has(name)) names.set(name, file)
      }
      // `requiredEnv('X')` is the project's own accessor and is the common form.
      for (const match of source.matchAll(/required(?:Env)?\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g)) {
        const name = match[1]
        if (name === undefined || PLATFORM.test(name)) continue
        if (!names.has(name)) names.set(name, file)
      }
    }
  }
  return names
}

/* ============================ `--claims`: a capability claim names its implementation ==========
 *
 * PHASE 46, VERIFICATION STEP 2. "A documented capability must name the file or route that
 * implements it." The failure this prevents is the one Phase 46's goal statement calls out: a
 * document that describes a feature nobody built. Prose cannot be compiled, so the only mechanical
 * purchase on it is the reference — if the paragraph that says a thing is built also names the
 * route or the module, the claim can be checked; if it names nothing, nobody can tell the
 * difference between a shipped feature and a sentence.
 *
 * WHAT COUNTS AS A CLAIM. This repository already marks built capability with a house marker, in
 * three shapes, and all three are taken as claims:
 *
 *   `### 7.5 /studio/catalog/relationships — **BUILT, Phase 23**`   a heading marker
 *   `**As built in Phase 16, with three departures worth knowing.**`  a bolded sentence
 *   `As built, categoryInLargeFormatSet means …`                      a sentence-initial marker
 *
 * `**BUILT` is matched case-SENSITIVELY, because "A URL is **built** by `MediaProvider`" is a
 * sentence about a URL, not a capability claim. "rewritten as built" mid-sentence is likewise not a
 * claim — the marker has to open its line or stand inside a bold span.
 *
 * WHERE IT LOOKS FOR THE REFERENCE, in two tiers. First the claim's own paragraph. Failing that,
 * the enclosing SECTION — from the nearest preceding heading to the next heading at the same or a
 * higher level, capped at 200 lines. Both tiers are legitimate documentation: `STUDIO_GUIDE.md`
 * names the route once in the heading (`### 12.5 /studio/research/explorer`) and then writes six
 * paragraphs about it, and demanding the path again in every paragraph would make worse prose. What
 * fails is a claim whose section names nothing that resolves at all.
 *
 * WHAT RESOLVES. Four kinds of reference, each checked against the repository as it is:
 *
 *   a route      `/studio/system/flags` → a directory under `app/` with a page or route file,
 *                comparing segments with route groups `(site)`/`(studio)`/`(shell)` removed, so the
 *                document never has to know the grouping. `[slug]` matches any dynamic segment.
 *   a path       `lib/site/menu.ts`, `components/three/**`, `lib/scraper/core/{a,b}.ts` — brace
 *                groups expanded, a `/**` or `*` suffix truncated to the directory.
 *   a module     `StudioPage` → a file of that basename anywhere in the source tree. Naming the
 *                component IS naming the implementation.
 *   an identifier  `categoryInLargeFormatSet`, `research_product_versions` — camelCase or
 *                snake_case, at least eight characters, occurring verbatim in the source tree.
 *                Eight characters and a case transition or an underscore, so that an English word
 *                that happens to appear in the code ("products") never counts as evidence.
 *
 * IT IS NOT A SPELL-CHECKER FOR PROSE. A claim needs ONE resolving reference in its section, not
 * one per sentence. The gate's question is "is there anything in the repository this paragraph
 * could be talking about", and the answer is either a path somebody can open or a finding.
 */

/** Where implementation lives. `docs/` is deliberately absent: a document is not an implementation. */
const CODE_DIRS = ['app', 'lib', 'components', 'content', 'scripts', 'supabase', 'tests', 'perf']

/** Files worth indexing for basenames and identifiers. */
const CODE_FILE = /\.(?:ts|tsx|mjs|cjs|js|sql|py|json|css)$/

function walkFiles(entry, out = []) {
  const full = join(ROOT, entry)
  let stats
  try {
    stats = statSync(full)
  } catch {
    return out
  }
  if (stats.isFile()) {
    if (CODE_FILE.test(entry)) out.push(entry)
    return out
  }
  for (const child of readdirSync(full)) {
    if (child === 'node_modules' || child.startsWith('.')) continue
    walkFiles(join(entry, child), out)
  }
  return out
}

/**
 * Every public route, as a path with its route groups removed.
 *
 * A directory alone is not a route: `app/(studio)/studio/(shell)` is a layout, and a route exists
 * where a `page` or `route` file does. Building the set once is what lets the resolver answer
 * `/studio/system/flags` without the document ever naming `(studio)` or `(shell)`.
 */
function routeIndex() {
  const routes = new Set()
  const visit = (dir) => {
    const entries = readdirSync(join(ROOT, dir), { withFileTypes: true })
    if (
      entries.some(
        (entry) => entry.isFile() && /^(?:page|route)\.(?:tsx?|js|mjs)$/.test(entry.name),
      )
    ) {
      const segments = dir
        .split('/')
        .slice(1)
        .filter((segment) => !segment.startsWith('(') && !segment.startsWith('@'))
      routes.add(`/${segments.join('/')}`.replace(/\/+$/, '') || '/')
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) visit(`${dir}/${entry.name}`)
    }
  }
  visit('app')
  return routes
}

/** Basenames of every source file, and every code-shaped identifier that occurs in one. */
function codeIndex() {
  const basenames = new Set()
  const identifiers = new Set()
  for (const dir of CODE_DIRS) {
    for (const file of walkFiles(dir)) {
      basenames.add(
        file
          .split('/')
          .pop()
          .replace(/\.[a-z]+$/, ''),
      )
      for (const match of readFileSync(join(ROOT, file), 'utf8').matchAll(/[A-Za-z_$][\w$]{7,}/g)) {
        identifiers.add(match[0])
      }
    }
  }
  return { basenames, identifiers }
}

/** A reference that is a route, with route groups ignored and dynamic segments tolerated. */
function resolvesAsRoute(routes, reference) {
  const clean = reference.replace(/\/+$/, '') || '/'
  if (routes.has(clean)) return true
  const wanted = clean.split('/').filter(Boolean)
  for (const candidate of routes) {
    const have = candidate.split('/').filter(Boolean)
    if (have.length !== wanted.length) continue
    const same = have.every(
      (segment, index) =>
        segment === wanted[index] ||
        (segment.startsWith('[') && (wanted[index] ?? '').startsWith('[')),
    )
    if (same) return true
  }
  return false
}

/** A code-shaped identifier: eight characters or more, with a case transition or an underscore. */
function isIdentifierShaped(token) {
  if (token.length < 8) return false
  if (!/^[A-Za-z_$][\w$]*$/.test(token)) return false
  return /[a-z][A-Z]/.test(token) || token.includes('_')
}

function resolvesAsReference(index, routes, token) {
  const reference = token.replace(/^[([<'"]+/, '').replace(/[)\]>'",.;:]+$/, '')
  if (reference === '') return false
  if (reference.startsWith('/')) return resolvesAsRoute(routes, reference)
  if (CODE_DIRS.includes(reference.split('/')[0]) || reference.startsWith('.github/')) {
    for (const expanded of expandBraces(reference)) {
      const path = expanded.replace(/\/\*\*?$/, '').replace(/\*.*$/, '')
      if (path !== '' && existsSync(join(ROOT, path))) return true
    }
    return false
  }
  if (/^[A-Z][A-Za-z0-9]{2,}$/.test(reference) && index.basenames.has(reference)) return true
  if (isIdentifierShaped(reference) && index.identifiers.has(reference)) return true
  return false
}

/** Every reference-shaped token in a block: backticked spans first, then bare routes. */
function referencesIn(block) {
  const tokens = []
  for (const span of block.matchAll(/`([^`]+)`/g)) {
    for (const piece of span[1].split(/[\s,;·|]+/)) if (piece !== '') tokens.push(piece)
  }
  for (const bare of block.matchAll(/(?<![`\w])(\/[A-Za-z0-9[\]_./-]{2,})/g)) tokens.push(bare[1])
  return tokens
}

/** The three shapes of the house marker. See the block comment above for why each is what it is. */
const CLAIM_MARKERS = [
  /^#{1,6}\s.*(?:\bas[- ]built\b|\*\*BUILT\b)/i,
  /\*\*[^*]*\b(?:as[- ]built|built in phase\s*\d+)\b[^*]*\*\*/i,
  /^\s*(?:>\s*)?(?:[-*]\s*)?\*{0,2}as[- ]built\b/i,
  /\*\*BUILT\b/,
]

const SECTION_CAP = 200

function claimProblems(index, routes, path, text) {
  const lines = text.split('\n')
  const problems = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!CLAIM_MARKERS.some((marker) => marker.test(lines[i]))) continue

    let start = i
    while (start > 0 && lines[start - 1].trim() !== '') start -= 1
    let end = i
    while (end + 1 < lines.length && lines[end + 1].trim() !== '') end += 1
    let resolved = referencesIn(lines.slice(start, end + 1).join('\n')).some((token) =>
      resolvesAsReference(index, routes, token),
    )

    if (!resolved) {
      let heading = -1
      for (let k = i; k >= 0; k -= 1) {
        if (/^#{1,6}\s/.test(lines[k])) {
          heading = k
          break
        }
      }
      if (heading !== -1) {
        const level = /^(#{1,6})\s/.exec(lines[heading])[1].length
        let sectionEnd = heading
        while (sectionEnd + 1 < lines.length && sectionEnd - heading < SECTION_CAP) {
          const next = /^(#{1,6})\s/.exec(lines[sectionEnd + 1])
          if (next !== null && next[1].length <= level) break
          sectionEnd += 1
        }
        resolved = referencesIn(lines.slice(heading, sectionEnd + 1).join('\n')).some((token) =>
          resolvesAsReference(index, routes, token),
        )
      }
    }

    if (resolved) continue
    problems.push(
      `${path}:${String(i + 1)} claims a built capability and names nothing that resolves:\n` +
        `      ${lines[i].trim().slice(0, 150)}\n` +
        `      Looked in the paragraph and then the whole section for: a route under app/ (route\n` +
        `      groups ignored), a repository path that exists, a source file basename, or a code\n` +
        `      identifier that occurs in the source tree. Name the file or the route — or, if it is\n` +
        `      not built, say so instead of saying it is.`,
    )
  }
  return problems
}

function runClaimCheck() {
  const index = codeIndex()
  const routes = routeIndex()
  const documents = listDocFiles(ROOT).filter((path) => !path.startsWith(READ_ONLY_PREFIX))
  const problems = []
  let claims = 0
  for (const path of documents) {
    const text = readFileSync(join(ROOT, path), 'utf8')
    claims += text
      .split('\n')
      .filter((line) => CLAIM_MARKERS.some((marker) => marker.test(line))).length
    problems.push(...claimProblems(index, routes, path, text))
  }
  if (problems.length > 0) {
    console.error(`✗ capability claims: ${String(problems.length)} problem(s):\n`)
    for (const problem of problems) console.error(`    ${problem}\n`)
    process.exit(1)
  }
  console.log(
    `✓ capability claims: ${String(claims)} claim(s) across ${String(documents.length)} document(s), ` +
      `each naming a route, a path, a module or an identifier that resolves ` +
      `(${String(routes.size)} routes, ${String(index.basenames.size)} source files indexed)`,
  )
}

if (process.argv.slice(2).includes('--claims')) {
  runClaimCheck()
  process.exit(0)
}

/* ============================ the environment-variable contract (unchanged) ==================== */

const declared = declaredNames()
const used = usedNames()
const documentation = readFileSync(join(ROOT, DOC), 'utf8')

const undeclared = [...used.entries()].filter(([name]) => !declared.has(name))
const undocumented = [...declared].filter((name) => !documentation.includes(name))

const problems = []

for (const [name, file] of undeclared) {
  problems.push(
    `${name} is read in ${file} but is not in ${EXAMPLE}.\n` +
      `      ENVIRONMENT.md §1 step 2: the name, with an EMPTY value, committed. It is the only\n` +
      `      committed reference anybody has.`,
  )
}

for (const name of undocumented) {
  problems.push(
    `${name} is declared in ${EXAMPLE} but is named nowhere in ${DOC}.\n` +
      `      ENVIRONMENT.md §1 step 4: purpose, scope, where it is set, what reads it, what breaks\n` +
      `      without it, and who rotates it.`,
  )
}

if (problems.length > 0) {
  console.error(`✗ documentation contract: ${String(problems.length)} problem(s):\n`)
  for (const problem of problems) console.error(`    ${problem}\n`)
  process.exit(1)
}

console.log(
  `✓ documentation contract: ${String(declared.size)} declared variable(s), all documented; ` +
    `${String(used.size)} read by the product, all declared`,
)
