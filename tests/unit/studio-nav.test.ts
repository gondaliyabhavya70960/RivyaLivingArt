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

  /**
   * The D4 routes that are in the contract but not in the shell: the three unauthenticated ones.
   *
   * Each exists FOR somebody with no session (amendments A2·b and A43), so none of them can sit
   * inside the authenticated group or appear in a sidebar that is only rendered to staff. Named
   * here rather than filtered by a pattern, because "every route with `password` in it is exempt"
   * is the shape that would one day exempt a route somebody meant to govern.
   */
  const UNAUTHENTICATED = ['/studio/login', '/studio/forgot-password', '/studio/reset-password']

  it('covers every D4 leaf, and invents none', () => {
    const expected = d4.filter((route) => !UNAUTHENTICATED.includes(route)).sort()
    expect([...manifest].sort()).toEqual(expected)
  })

  it('keeps every unauthenticated route out of the shell group and in the contract', () => {
    // Both directions. In D4, because a route the contract does not name is one nobody agreed to;
    // outside `(shell)`, because the shell's layout is the signed-in Studio chrome and a sign-in
    // page rendered inside it would be a page that assumes the session it exists to obtain.
    for (const route of UNAUTHENTICATED) {
      expect(d4, `${route} is missing from D4`).toContain(route)
      expect(disk, `${route} must not be a (shell) route`).not.toContain(route)
      expect(manifest, `${route} must not be a sidebar leaf`).not.toContain(route)
    }
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
     *
     * A `/new` ROUTE IS EXEMPT ON THE SAME TERMS AND FOR THE SAME REASON. `/studio/catalog/products/new`
     * is an ACTION on the products list, not a place in the sidebar: a permanent "New product" entry
     * in the navigation would suggest the catalogue has two destinations when it has one, and every
     * other create surface in the Studio (a section, a menu item, a material) is a control on its
     * list rather than a leaf of its own. The segment is matched exactly — `new`, not any static
     * child — so this cannot be used to smuggle in an ungoverned surface by naming it `/settings`.
     *
     * A TAB OF A DETAIL ROUTE IS EXEMPT ON THE SAME PRINCIPLE, added in Phase 15 for
     * `/studio/catalog/products/[productId]/{media,materials,specifications,related}`. These are
     * sections of one record, not destinations: the sidebar cannot link to "the Media tab" any more
     * than it can link to "the product", because in both cases there is no one record to link to.
     *
     * THE PRINCIPLE IS UNCHANGED AND THE RULE IS NOT LOOSER. Governance still flows from a leaf —
     * the tab is exempt only because its parent is a detail route whose OWN parent the manifest
     * names, so the chain from a governed leaf is unbroken. It cannot be used to add an ungoverned
     * top-level surface: a static route whose parent is static must still be in the manifest, and
     * every route reached this way is required to call `requirePermission` by the test below, which
     * was widened to cover them rather than left checking detail routes alone.
     */
    const isDetail = (route: string): boolean => route.endsWith(']')
    const parentOf = (route: string): string => route.slice(0, route.lastIndexOf('/'))

    for (const route of disk) {
      if (isDetail(route) || route.endsWith('/new')) {
        const parent = parentOf(route)
        expect(
          manifest,
          `${route} is a detail or create route whose parent ${parent} is not a leaf`,
        ).toContain(parent)
        continue
      }

      const parent = parentOf(route)
      if (isDetail(parent)) {
        const leaf = parentOf(parent)
        expect(
          manifest,
          `${route} is a tab of detail route ${parent}, whose parent ${leaf} is not a leaf`,
        ).toContain(leaf)
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
  it('gives every detail route and every tab of one its own permission check', () => {
    // Tabs are included because the exemption above lets them exist without a manifest entry. An
    // exemption that did not carry this obligation would be a way to add an unguarded Studio page.
    const governed = disk.filter(
      (r) => r.endsWith(']') || r.slice(0, r.lastIndexOf('/')).endsWith(']'),
    )
    for (const route of governed) {
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
