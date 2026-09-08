import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { STATIC_PUBLIC_PATHS } from '@/lib/site/routes'

/**
 * The route map and the file system agree, exactly.
 *
 * WHY THIS TEST EXISTS RATHER THAN A CATCH-ALL ROUTE. `app/(site)/[[...path]]/page.tsx` would
 * serve all thirteen paths from one file and make this test unnecessary — and would also swallow
 * every future route: `/product/x` would resolve there, find no `pages` row and 404, instead of
 * failing loudly when Phase 15 forgets to add it. One file per path keeps D3's map in the file
 * system, and this asserts the two have not drifted.
 *
 * IT FAILS IN BOTH DIRECTIONS ON PURPOSE. A missing route file is a page that 404s for everyone; an
 * undeclared one is a URL nobody wrote down, which is how a route ships that no test covers and no
 * document mentions.
 */

const SITE = join(process.cwd(), 'app', '(site)')

/**
 * D3's static public paths.
 *
 * IMPORTED RATHER THAN RESTATED. `lib/site/routes.ts` is the declaration the application itself
 * uses — `/studio/content/navigation` checks an editor's href against it — and a second copy here
 * would let the two drift while both looked correct. What this test compares is the declaration
 * against the FILE SYSTEM, which is the fact; a list checked against itself would prove nothing.
 */
const D3_STATIC_PATHS = STATIC_PUBLIC_PATHS

/** Route-group and Next convention files are not routes. */
const NON_ROUTE = new Set([
  'layout.tsx',
  'error.tsx',
  'not-found.tsx',
  'template.tsx',
  'loading.tsx',
])

/** Every `page.tsx` under app/(site), as the URL path it serves. */
function routePaths(dir: string, prefix = ''): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // A parenthesised segment is a route group and contributes nothing to the URL.
      const segment = entry.startsWith('(') && entry.endsWith(')') ? '' : `/${entry}`
      found.push(...routePaths(full, `${prefix}${segment}`))
      continue
    }
    if (entry === 'page.tsx') found.push(prefix === '' ? '/' : prefix)
    else if (!NON_ROUTE.has(entry) && entry.endsWith('.tsx')) {
      // A stray component file inside the route tree. Not a failure by itself, but worth knowing.
      continue
    }
  }
  return found
}

describe('public route parity', () => {
  const actual = routePaths(SITE).sort()
  // Widened to `string[]`: the literal union from `as const` is what makes the list readable in a
  // diff, but comparing it against paths discovered on disk needs plain strings on both sides.
  const expected: string[] = [...D3_STATIC_PATHS].sort()

  it('has a route file for every D3 static path', () => {
    const missing = expected.filter((path) => !actual.includes(path))
    expect(missing).toEqual([])
  })

  it('has no route file for a path D3 does not declare', () => {
    const undeclared = actual.filter((path) => !expected.includes(path))
    expect(undeclared).toEqual([])
  })

  it('declares exactly thirteen static paths', () => {
    // A number, so that adding a path to D3_STATIC_PATHS without amending D3 is a visible change
    // in the diff rather than a quiet one.
    expect(expected).toHaveLength(13)
  })
})

describe('the site shell', () => {
  const files = readdirSync(SITE)

  it('has a layout', () => {
    expect(files).toContain('layout.tsx')
  })

  it('has its own not-found, so a 404 keeps the site chrome', () => {
    expect(files).toContain('not-found.tsx')
  })

  it('has an error boundary', () => {
    expect(files).toContain('error.tsx')
  })
})
