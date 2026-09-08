#!/usr/bin/env node
/**
 * ISLAND BUDGET GATE (Phase 11)
 *
 * The homepage's performance budget names four client component islands and only four:
 * `MegaMenu`, `MobileNav`, `HeroMotion` and `MaterialSequence`. This walks the import graph from
 * `app/(site)/page.tsx` and fails the build on a fifth.
 *
 * WHY COUNT MODULES AND NOT BUNDLE CHUNKS. A chunk count can be gamed by merging two client
 * components into one file, which changes nothing about what the browser downloads, parses and
 * hydrates. It also cannot be read before a build. Counting `'use client'` modules that a Server
 * Component imports counts the thing that actually matters: each one is a hydration boundary with
 * its own React tree, its own props serialised into the RSC payload, and its own share of the
 * route's JavaScript.
 *
 * AN ISLAND IS A CLIENT MODULE A SERVER MODULE IMPORTS. That definition is doing real work:
 *
 *   * `MediaVideo` is a Client Component and is NOT an island of this page. `HeroMotion` imports
 *     it, and `HeroMotion` is already a client module — so it is part of that island's bundle
 *     rather than a boundary of its own. Counting every reachable `'use client'` file would report
 *     nine here (the four islands, `MediaVideo`, and the four motion hooks) and would punish
 *     splitting a client component into readable pieces.
 *   * The direction matters too. Until Phase 11 `MediaSlot` — a Server Component that nearly every
 *     section renderer imports — imported `MediaVideo` directly, which made it a fifth island on
 *     every route with any section at all, whether or not a video was ever rendered. Moving
 *     `BlockVideo` into its own module is what fixed that, and this gate is what would have caught
 *     it.
 *
 * THE SET IS ASSERTED BY NAME, NOT JUST BY COUNT. A count passes when one island is swapped for
 * another, which is exactly the change worth reading a diff for: it means a piece of the page
 * became interactive. Adding to `ALLOWED` is a deliberate edit with the phase document's budget
 * open beside it.
 *
 * Exit 1 on any violation. Runs in `npm run check` and in CI.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const ROOT = process.cwd()

/**
 * THREE ENTRIES, BECAUSE A ROUTE'S CLIENT BUNDLE IS THE UNION OF ITS LAYOUTS AND ITS PAGE.
 *
 * The phase document says "reachable from `app/(site)/page.tsx`" and then, two lines later, that
 * three of the four islands "come from the shell" — which is the layout, not the page. A walk from
 * the page alone would report one island and pass while the shell grew four more. Next composes
 * `app/layout.tsx` -> `app/(site)/layout.tsx` -> `app/(site)/page.tsx` for this route and hydrates
 * all three, so all three are walked.
 */
const ENTRIES = [
  join(ROOT, 'app', 'layout.tsx'),
  join(ROOT, 'app', '(site)', 'layout.tsx'),
  join(ROOT, 'app', '(site)', 'page.tsx'),
]

/**
 * The islands the homepage is allowed, and why each one cannot be a Server Component.
 *
 * FOUR OF THE FIVE ARE THE ONES PHASE 11 NAMES. Two arrive from the site shell, two from this
 * phase, and every one of them exists because something on the page has to respond to the visitor
 * — an open panel, a drawer, a clip that may only play under conditions the server cannot know, a
 * stage that brightens as it passes the middle of the viewport.
 *
 * THE FIFTH IS `SiteErrorCopyProvider`, AND THE PHASE DOCUMENT DID NOT KNOW ABOUT IT. It was
 * written before Phase 10 shipped, and this provider is Phase 10's answer to a collision between
 * two rules that both hold: Next REQUIRES `app/(site)/error.tsx` to be a Client Component because
 * it takes `reset`, and D2 forbids a visitor-readable literal anywhere on the public site. A
 * Client Component cannot read `global_content`, so the layout reads the five error strings on the
 * server and hands them across the boundary through a provider that renders `children` unchanged.
 * It has no DOM node, no state and no event handler — but it IS a hydration boundary, and a gate
 * that quietly excluded it would be measuring something other than what ships.
 *
 * So the budget here is five, the fifth is named, and the deviation from the phase document is
 * recorded rather than hidden. Removing it would mean five English sentences hard-coded into the
 * error boundary that the owner could never edit.
 */
const ALLOWED = new Map([
  ['components/patterns/MegaMenu/index.tsx', 'open state and roving focus for the header panel'],
  ['components/patterns/MobileNav/index.tsx', 'the drawer, its focus trap and its dismissal'],
  [
    'components/patterns/HeroMotion/index.tsx',
    'mounts the hero clip after paint, behind five gates',
  ],
  ['components/patterns/MaterialSequence/index.tsx', 'observes scroll to mark the stage in view'],
  [
    'components/patterns/SiteErrorCopy/index.tsx',
    "carries the error boundary's seeded copy across a boundary Next requires",
  ],
])

/**
 * The number, kept separate from `ALLOWED.size` on purpose.
 *
 * Deriving it would make the budget whatever the allowlist happens to contain, so adding an island
 * would raise the budget in the same edit and nothing would ever fail. Written out, a sixth island
 * fails this gate even if somebody remembered to list it.
 */
const BUDGET = 5

const EXTENSIONS = ['.tsx', '.ts', '.mjs', '.js', '.jsx']

/** `@/x` is the repository root, per tsconfig's paths. Anything else bare is a package. */
function resolveSpecifier(specifier, fromFile) {
  const base = specifier.startsWith('@/')
    ? join(ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
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

/**
 * Every module specifier in a file.
 *
 * Comments are stripped and string literals kept — the specifier IS a string literal, and a
 * commented-out import must not pull a module into the graph. `import type` is included on
 * purpose: a type-only import of a client module is erased by the compiler and cannot make an
 * island, but excluding it here would need this script to parse TypeScript. Including it can only
 * over-report, and an over-report is a conversation rather than a silent pass.
 */
function specifiersOf(source) {
  const masked = stripCommentsAndStrings(source, { strings: false })
  const found = new Set()
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
  ]
  for (const pattern of patterns) {
    for (const match of masked.matchAll(pattern)) found.add(match[1])
  }
  return [...found]
}

/** The directive, if the file opens with one. Anything after the first statement is not one. */
function directiveOf(source) {
  const head = source.slice(0, 400)
  if (/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(head)) return 'client'
  if (/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use server['"]/.test(head))
    return 'server-action'
  return 'server'
}

const islands = new Map()
const seen = new Set()

/** Depth-first, and it does not stop at a client module: a client file may import another. */
function walk(file, parentIsClient) {
  const key = relative(ROOT, file)
  const source = readFileSync(file, 'utf8')
  const kind = directiveOf(source)
  const isClient = kind === 'client' || parentIsClient

  // A client module imported by a SERVER module is a hydration boundary. The same module reached
  // through another client module is not — it is already inside that island's bundle.
  if (kind === 'client' && !parentIsClient && !islands.has(key)) {
    islands.set(key, relative(ROOT, file))
  }

  if (seen.has(`${key}:${isClient}`)) return
  seen.add(`${key}:${isClient}`)

  for (const specifier of specifiersOf(source)) {
    const resolved = resolveSpecifier(specifier, file)
    if (resolved === null) continue
    // Tests are not shipped, and a test importing a client component is not an island.
    if (/\.(?:test|spec)\.[jt]sx?$/.test(resolved)) continue
    walk(resolved, isClient)
  }
}

for (const entry of ENTRIES) {
  if (!existsSync(entry)) {
    console.error(`✗ no entry at ${relative(ROOT, entry)} — the homepage route has moved`)
    process.exit(1)
  }
  walk(entry, false)
}

const problems = []
for (const key of islands.keys()) {
  if (!ALLOWED.has(key)) {
    problems.push(`${key} — a client component the homepage did not have a budget for`)
  }
}
for (const [key, why] of ALLOWED) {
  if (!islands.has(key)) {
    problems.push(
      `${key} is in the budget but is no longer reachable from the homepage (${why}) — ` +
        'remove it from ALLOWED, or find out what stopped importing it',
    )
  }
}
if (islands.size > BUDGET) {
  problems.push(`${islands.size} islands, budget is ${BUDGET}`)
}

if (problems.length > 0) {
  console.error(
    `✗ island budget: ${problems.length} problem(s):\n` +
      problems.map((problem) => `    ${problem}`).join('\n'),
  )
  process.exit(1)
}

console.log(
  `✓ island budget: ${islands.size} client island(s) across the homepage's layouts and page — ` +
    [...islands.keys()].map((key) => key.split('/').at(-2)).join(', '),
)
