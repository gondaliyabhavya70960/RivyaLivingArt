import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { STUDIO_STRINGS } from '@/components/studio/strings'
import { PERMISSIONS } from '@/lib/auth/permissions'
import { STUDIO_LEAVES, STUDIO_NAV, leafForPath } from '@/lib/auth/studio-nav'
import { DASHBOARD_CARDS, cardTableExists, isCardAvailable } from '@/lib/analytics/dashboard-cards'

/**
 * The three-way agreement the Studio depends on: D4 ↔ the manifest ↔ the files on disk.
 *
 * WHY ALL THREE. Any two of them agreeing is not enough, and each pair fails differently:
 *
 *   manifest vs D4 only     — the sidebar matches the contract and links to routes that 404.
 *   manifest vs disk only   — every link works and the Studio has quietly grown or lost a route
 *                             that CANONICAL-DECISIONS says is fixed.
 *   D4 vs disk only         — cannot be checked without the manifest, which is what names them.
 *
 * The D4 list is parsed out of `docs/architecture/CANONICAL-DECISIONS.md` rather than transcribed
 * here. A transcription would be a fourth copy of the route map, and the whole point of the
 * manifest is that there is one. Parsing means editing the contract fails this test, which is the
 * correct direction: the contract is the thing that is supposed to be hard to change.
 */

const ROOT = resolve(__dirname, '../..')
const SHELL = join(ROOT, 'app/(studio)/studio/(shell)')

/**
 * Expand D4's notation into plain paths.
 *
 * The block is written for a human: routes carry trailing descriptions after a run of spaces, and
 * long groups wrap across lines inside their braces. Both have to be undone, and IN THAT ORDER —
 * joining the lines first merges a description into the path on the next line, which is how the
 * first version of this parser produced a route called
 * "/studio/login sign-in; the only unauthenticated Studio route".
 */
function parseD4Routes(): string[] {
  const doc = readFileSync(join(ROOT, 'docs/architecture/CANONICAL-DECISIONS.md'), 'utf8')
  const start = doc.indexOf('## D4 — Studio route map')
  expect(
    start,
    'D4 heading not found — has CANONICAL-DECISIONS been restructured?',
  ).toBeGreaterThan(-1)

  const open = doc.indexOf('```', start)
  const block = doc.slice(open + 3, doc.indexOf('```', open + 3))

  // 1. Drop each line's trailing description. A route never contains two spaces in a row.
  const cleaned = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => line.split(/\s{2,}/)[0] ?? '')

  // 2. Rejoin lines that were wrapped inside a brace group.
  const entries: string[] = []
  let buffer = ''
  for (const line of cleaned) {
    buffer += line
    const balanced = (buffer.match(/\{/g) ?? []).length === (buffer.match(/\}/g) ?? []).length
    if (!balanced) continue
    entries.push(buffer)
    buffer = ''
  }
  expect(buffer, 'D4 block has an unclosed brace group').toBe('')

  // 3. Expand `{a,b,c}`.
  const routes: string[] = []
  for (const entry of entries) {
    const brace = entry.match(/^(.*?)\{(.+)\}$/)
    if (brace === null) {
      routes.push(entry)
      continue
    }
    const [, prefix = '', inner = ''] = brace
    for (const segment of inner.split(',')) routes.push(`${prefix}${segment}`)
  }
  return routes
}

/** Every `page.tsx` under the shell group, as the route it serves. */
function routesOnDisk(dir = SHELL, prefix = '/studio'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'page.tsx') {
      found.push(prefix)
      continue
    }
    if (!statSync(full).isDirectory()) continue
    // A route group — `(shell)` — adds a layout, never a URL segment.
    const next = entry.startsWith('(') && entry.endsWith(')') ? prefix : `${prefix}/${entry}`
    found.push(...routesOnDisk(full, next))
  }
  return found
}

describe('the Studio navigation manifest', () => {
  const d4 = parseD4Routes()
  const manifest = STUDIO_LEAVES.map((leaf) => leaf.href)
  const disk = routesOnDisk()

  it('parses a D4 map that actually has leaves', () => {
    // Guards the parser itself. A regex that silently matches nothing would make every comparison
    // below pass against two empty sets — the way this whole test could be green and worthless.
    expect(d4.length).toBeGreaterThan(50)
    expect(d4).toContain('/studio/catalog/products')
    expect(d4).toContain('/studio/research/large-format')
  })

  it('covers every D4 leaf, and invents none', () => {
    // `/studio/login` is in D4 but is not a shell route: it is the unauthenticated redirect target
    // (amendment A2·b) and deliberately sits outside the authenticated group.
    const expected = d4.filter((route) => route !== '/studio/login').sort()
    expect([...manifest].sort()).toEqual(expected)
  })

  it('has a page.tsx on disk for every leaf', () => {
    for (const href of manifest) {
      expect(disk, `${href} is in the manifest with no page`).toContain(href)
    }
  })

  it('has no page on disk that the manifest does not name', () => {
    /**
     * The direction that catches a route added by hand: it would be unreachable from the sidebar,
     * ungoverned by any permission here, and invisible to every other test in this file.
     *
     * A DETAIL ROUTE IS EXEMPT, AND ONLY IF ITS PARENT IS A LEAF. `/studio/content/pages/[pageId]`
     * is not a navigation destination — nothing links to it from the sidebar, because there is no
     * one page to link to — but it must still be governed, and the way it is governed is by being
     * reachable only from a leaf that IS in the manifest. So the rule is not "dynamic routes are
     * fine", which would let anyone add an ungoverned surface by putting brackets in its name; it
     * is "a dynamic segment must sit directly beneath a route the manifest names".
     */
    for (const route of disk) {
      if (route.endsWith(']')) {
        const parent = route.slice(0, route.lastIndexOf('/'))
        expect(
          manifest,
          `${route} is a detail route whose parent ${parent} is not a leaf`,
        ).toContain(parent)
        continue
      }
      expect(manifest, `${route} exists on disk but is not in the manifest`).toContain(route)
    }
  })

  /**
   * Every detail route still runs its own permission check. `proxy.ts` decides authentication and
   * nothing else, so a page that forgot `requirePermission` would be reachable by any signed-in
   * staff member whatever their role — and being nested under a governed leaf would not save it,
   * because a URL can be typed.
   */
  it('gives every detail route its own permission check', () => {
    for (const route of disk.filter((r) => r.endsWith(']'))) {
      const file = join(SHELL, route.replace('/studio/', ''), 'page.tsx')
      const source = readFileSync(file, 'utf8')
      expect(source, `${route} does not call requirePermission`).toContain('requirePermission(')
    }
  })

  it('writes each path down exactly once', () => {
    expect(new Set(manifest).size).toBe(manifest.length)
  })

  it('governs every leaf by a permission that exists', () => {
    for (const leaf of STUDIO_LEAVES) {
      expect(PERMISSIONS, leaf.href).toContain(leaf.permission)
    }
  })

  it('resolves every label through the strings module', () => {
    // A missing key renders as the key — which reads like a typo rather than a bug, and would ship.
    for (const leaf of STUDIO_LEAVES) {
      expect(STUDIO_STRINGS, leaf.href).toHaveProperty(leaf.labelKey)
    }
    for (const group of STUDIO_NAV) {
      expect(STUDIO_STRINGS, group.id).toHaveProperty(group.labelKey)
    }
  })

  it('names an owning phase for every leaf', () => {
    for (const leaf of STUDIO_LEAVES) {
      expect(leaf.phases.length, leaf.href).toBeGreaterThan(0)
      for (const phase of leaf.phases) {
        expect(phase, leaf.href).toBeGreaterThanOrEqual(1)
        expect(phase, leaf.href).toBeLessThanOrEqual(46)
      }
    }
  })

  it('resolves a nested detail route to its leaf, not to /studio', () => {
    // Phases 14–35 add `[id]` routes below these leaves. Shortest-prefix matching would gate them
    // on `studio.access`, which every role holds — a product editor any viewer could open.
    expect(leafForPath('/studio/catalog/products/abc')?.href).toBe('/studio/catalog/products')
    expect(leafForPath('/studio/research/compare/set-1')?.href).toBe('/studio/research/compare')
    expect(leafForPath('/studio')?.href).toBe('/studio')
    expect(leafForPath('/product/public-slug')).toBeNull()
  })
})

describe('the dashboard card registry', () => {
  it('never marks a card available whose table does not exist', () => {
    // The rule the registry exists for. A card that queries a missing relation does not render a
    // zero — it throws, or worse, is "fixed" by rendering a zero, which asserts a business fact
    // that is not true.
    for (const card of DASHBOARD_CARDS) {
      if (!isCardAvailable(card)) continue
      expect(cardTableExists(card), `${card.id} counts ${card.table}, which does not exist`).toBe(
        true,
      )
    }
  })

  it('gives every card an owning phase and a label that resolves', () => {
    for (const card of DASHBOARD_CARDS) {
      expect(card.availableFromPhase, card.id).toBeGreaterThanOrEqual(3)
      expect(STUDIO_STRINGS, card.id).toHaveProperty(card.labelKey)
      expect(PERMISSIONS, card.id).toContain(card.permission)
    }
  })

  it('covers all twenty FEAT §17 cards', () => {
    expect(DASHBOARD_CARDS).toHaveLength(20)
    expect(new Set(DASHBOARD_CARDS.map((card) => card.id)).size).toBe(20)
  })
})
