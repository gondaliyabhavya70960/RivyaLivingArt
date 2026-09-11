/**
 * THE ISLAND WALK, IN ONE PLACE — Phase 40.
 *
 * Two gates need the same answer to the same question, and before this module they each had their
 * own copy of the walk:
 *
 *   * `scripts/site/check-island-budget.mjs` (Phase 11) asserts WHICH islands the homepage has, by
 *     name, against a hand-maintained allowlist. Swapping one island for another must be read in a
 *     diff, so a count alone would not do.
 *   * `scripts/perf/count-islands.mjs` (this phase) asserts HOW MANY islands EVERY route has,
 *     against `perf/budgets.json`.
 *
 * Two walks over the same graph drift — one learns about a new module convention, the other does
 * not, and the two gates start disagreeing about what an island is. So the walk lives here and
 * both import it. The POLICY stays in each gate: this module answers "what does this route
 * hydrate", and says nothing about whether that is allowed.
 *
 * WHAT AN ISLAND IS, and the definition is doing real work (it is Phase 11's, unchanged):
 *
 *   AN ISLAND IS A CLIENT MODULE THAT A SERVER MODULE IMPORTS. A `'use client'` file reached
 *   through another `'use client'` file is not a boundary of its own — it is already inside that
 *   island's bundle. Counting every reachable client file would report nine on the homepage (the
 *   islands, plus `MediaVideo` and four motion hooks) and would punish splitting a client
 *   component into readable pieces.
 *
 *   STATIC AND DYNAMIC ARE DIFFERENT FACTS. A static `import` of a client component puts it in the
 *   route's INITIAL JavaScript, downloaded and hydrated whether or not the branch that renders it
 *   ever runs. An `import()` leaves a stub. A module imported dynamically in one place and
 *   statically in another is static, which the walk catches by following both edge kinds and
 *   letting the static reading win.
 *
 *   A ROUTE IS ITS LAYOUTS PLUS ITS PAGE. Next composes `app/layout.tsx` → the group layout → any
 *   nested layout → the page, and hydrates all of them, so the entry set is all of them.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const ROOT = process.cwd()
const EXTENSIONS = ['.tsx', '.ts', '.mjs', '.js', '.jsx']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])

/** `@/x` is the repository root, per tsconfig's paths. Anything else bare is a package. */
export function resolveSpecifier(specifier, fromFile) {
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
 * Every module specifier in a file, split by how it is loaded.
 *
 * Comments are stripped and string literals kept — the specifier IS a string literal, and a
 * commented-out import must not pull a module into the graph. `import type` is included on
 * purpose: erasing it correctly would need this script to parse TypeScript, and including it can
 * only over-report, which is a conversation rather than a silent pass.
 */
export function specifiersOf(source) {
  const masked = stripCommentsAndStrings(source, { strings: false })
  const dynamicSpecifiers = new Set()
  for (const match of masked.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    dynamicSpecifiers.add(match[1])
  }

  const staticSpecifiers = new Set()
  for (const pattern of [/\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g]) {
    for (const match of masked.matchAll(pattern)) {
      if (!dynamicSpecifiers.has(match[1])) staticSpecifiers.add(match[1])
    }
  }

  return { static: [...staticSpecifiers], dynamic: [...dynamicSpecifiers] }
}

/** The directive, if the file opens with one. Anything after the first statement is not one. */
export function directiveOf(source) {
  const head = source.slice(0, 400)
  if (/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(head)) return 'client'
  if (/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use server['"]/.test(head))
    return 'server-action'
  return 'server'
}

/**
 * Walk a route's entry files and report its islands.
 *
 * Returns `{ islands, lazyIslands }`, both arrays of repository-relative paths. `islands` is the
 * initial bundle's hydration boundaries; `lazyIslands` are the ones reached only through an
 * `import()` and are reported rather than hidden, because "loaded on demand" is a claim worth
 * being able to check.
 */
export function islandsOf(entries) {
  const islands = new Map()
  const lazyIslands = new Map()
  const seen = new Set()

  function walk(file, parentIsClient, lazy) {
    const key = relative(ROOT, file)
    let source
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      return
    }
    const kind = directiveOf(source)
    const isClient = kind === 'client' || parentIsClient

    // A client module imported by a SERVER module is a hydration boundary. The same module reached
    // through another client module is not — it is already inside that island's bundle.
    if (kind === 'client' && !parentIsClient) {
      if (lazy) {
        if (!islands.has(key)) lazyIslands.set(key, key)
      } else {
        islands.set(key, key)
        lazyIslands.delete(key)
      }
    }

    if (seen.has(`${key}:${isClient}:${lazy}`)) return
    seen.add(`${key}:${isClient}:${lazy}`)

    const specifiers = specifiersOf(source)
    for (const [list, isLazy] of [
      [specifiers.static, lazy],
      [specifiers.dynamic, true],
    ]) {
      for (const specifier of list) {
        const resolved = resolveSpecifier(specifier, file)
        if (resolved === null) continue
        // Tests are not shipped, and a test importing a client component is not an island.
        if (/\.(?:test|spec)\.[jt]sx?$/.test(resolved)) continue
        walk(resolved, isClient, isLazy)
      }
    }
  }

  for (const entry of entries) {
    if (!existsSync(entry)) continue
    walk(entry, false, false)
  }

  return { islands: [...islands.keys()], lazyIslands: [...lazyIslands.keys()] }
}

/**
 * Every `page.tsx` under `app/`, as `{ routePattern, entries }`.
 *
 * THE ROUTE PATTERN IS THE DIRECTORY PATH WITH GROUPS REMOVED. `app/(site)/product/[slug]/page.tsx`
 * is `/product/[slug]`: a parenthesised segment is a Next route group, which organises files and
 * contributes nothing to the URL. `[slug]` is kept verbatim — it is the pattern, and the pattern is
 * exactly what `perf/budgets.json` is keyed by and what `web_vitals_samples.route_pattern` stores.
 *
 * THE ENTRIES ARE EVERY LAYOUT ON THE PATH, ROOT FIRST, then the page: that is the set Next
 * composes and hydrates for the route.
 */
export function discoverRoutes(appDir = join(ROOT, 'app')) {
  const pages = []

  function walkDir(dir) {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walkDir(full)
      else if (entry === 'page.tsx') pages.push(full)
    }
  }
  walkDir(appDir)

  return pages
    .map((page) => {
      const entries = []
      // Every directory from `app/` down to the page's own, root first.
      let dir = appDir
      const tail = relative(appDir, dirname(page))
      const segments = tail === '' ? [] : tail.split(sep)
      for (const segment of ['', ...segments]) {
        if (segment !== '') dir = join(dir, segment)
        const layout = join(dir, 'layout.tsx')
        if (existsSync(layout)) entries.push(layout)
      }
      entries.push(page)

      const routePattern =
        '/' +
        segments.filter((segment) => !(segment.startsWith('(') && segment.endsWith(')'))).join('/')
      return { routePattern: routePattern === '/' ? '/' : routePattern.replace(/\/$/, ''), entries }
    })
    .sort((a, b) => a.routePattern.localeCompare(b.routePattern))
}

export { ROOT }
