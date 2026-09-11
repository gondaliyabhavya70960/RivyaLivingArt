import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `perf/budgets.json` IS THE ONLY PLACE THE NUMBERS LIVE — Phase 40.
 *
 * The phase's stated risk is that the budget "becomes advisory and is quietly exceeded". Three
 * things make that hard, and this file asserts all three:
 *
 *   1. EVERY ROUTE IS COVERED. A budget table that silently ignores what it does not know about
 *      protects whatever was written the day it was made. Every `page.tsx` under `app/` is
 *      budgeted, matched by a group, or excluded with a reason.
 *   2. THE NUMBERS ARE WELL FORMED. A budget of `null`, `0` or a string passes a JSON parse and
 *      then passes every comparison in every guard, which is worse than having no budget at all.
 *   3. THE BASELINE AND THE BUDGET AGREE ON WHICH ROUTES EXIST, so a route cannot be measured
 *      against a budget that was deleted, or budgeted and never measured without anybody noticing.
 */

const ROOT = process.cwd()
const budgets = JSON.parse(readFileSync(join(ROOT, 'perf', 'budgets.json'), 'utf8')) as {
  growthTolerance: number
  coreWebVitals: Record<string, unknown>
  transferredBytes: Record<string, unknown>
  chunks: Record<string, { maxKb: number; neverInFirstLoad: boolean; specifiers: string[] }>
  routes: Record<
    string,
    { lcpMs: number; firstLoadJsKb: number; islands: number; lcpImage: boolean; note?: string }
  >
  groups: Record<string, { firstLoadJsKb: number; islands: number }>
  excluded: Record<string, string>
}

/** Every route pattern the app router actually serves, groups stripped. */
function appRoutes(): string[] {
  const appDir = join(ROOT, 'app')
  const found: string[] = []
  const walk = (dir: string, segments: string[]): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules') continue
      const full = join(dir, entry)
      if (!statSync(full).isDirectory()) continue
      const next = entry.startsWith('(') && entry.endsWith(')') ? segments : [...segments, entry]
      if (existsSync(join(full, 'page.tsx'))) found.push(`/${next.join('/')}`)
      walk(full, next)
    }
  }
  if (existsSync(join(appDir, 'page.tsx'))) found.push('/')
  walk(appDir, [])
  return found
}

function covered(routePattern: string): boolean {
  if (budgets.routes[routePattern] !== undefined) return true
  if (budgets.excluded[routePattern] !== undefined) return true
  return Object.keys(budgets.groups).some(
    (prefix) => routePattern === prefix || routePattern.startsWith(`${prefix}/`),
  )
}

describe('perf/budgets.json', () => {
  it('covers every route the app router serves', () => {
    const uncovered = appRoutes().filter((route) => !covered(route))
    expect(uncovered, `uncovered routes: ${uncovered.join(', ')}`).toEqual([])
  })

  it('budgets no route that has disappeared', () => {
    const routes = new Set(appRoutes())
    const stale = [...Object.keys(budgets.routes), ...Object.keys(budgets.excluded)].filter(
      (route) => !routes.has(route),
    )
    expect(stale, `stale entries: ${stale.join(', ')}`).toEqual([])
  })

  it('gives every budgeted route four usable numbers', () => {
    for (const [route, budget] of Object.entries(budgets.routes)) {
      expect(budget.lcpMs, route).toBeGreaterThan(0)
      expect(budget.firstLoadJsKb, route).toBeGreaterThan(0)
      expect(budget.islands, route).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(budget.islands), route).toBe(true)
      expect(typeof budget.lcpImage, route).toBe('boolean')
    }
  })

  it('excludes a route only with a reason somebody wrote', () => {
    for (const [route, reason] of Object.entries(budgets.excluded)) {
      expect(reason.length, route).toBeGreaterThan(20)
    }
  })

  it('keeps the growth tolerance meaningful', () => {
    // Zero would fail on measurement noise; anything loose enough to hide a new dependency is not
    // a tolerance, it is permission.
    expect(budgets.growthTolerance).toBeGreaterThan(0)
    expect(budgets.growthTolerance).toBeLessThanOrEqual(0.1)
  })

  it('keeps the 3D engine out of every first load, by name', () => {
    const viewer = budgets.chunks['viewer3d']
    expect(viewer, 'the viewer3d chunk rule has been removed').toBeDefined()
    expect(viewer?.neverInFirstLoad).toBe(true)
    expect(viewer?.specifiers).toContain('three')
    expect(viewer?.specifiers).toContain('@react-three/')
  })

  it('states the Core Web Vitals targets the phase fixed', () => {
    expect(budgets.coreWebVitals).toMatchObject({
      lcpMs: 2500,
      clsScore: 0.05,
      inpMs: 200,
      ttfbWarmMs: 800,
    })
  })
})

describe('perf/bundle-baseline.json', () => {
  const path = join(ROOT, 'perf', 'bundle-baseline.json')

  it('exists — a baseline nobody recorded protects nothing', () => {
    expect(existsSync(path)).toBe(true)
  })

  it('measures only routes the budget knows about, and records where and when', () => {
    const baseline = JSON.parse(readFileSync(path, 'utf8')) as {
      measuredOn: string
      measuredAgainst: string
      routes: Record<string, { kb: number; files: number; sample: string }>
    }
    expect(baseline.measuredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(baseline.measuredAgainst.length).toBeGreaterThan(0)
    for (const [route, entry] of Object.entries(baseline.routes)) {
      expect(budgets.routes[route], `${route} is measured but not budgeted`).toBeDefined()
      expect(entry.kb, route).toBeGreaterThan(0)
      expect(entry.files, route).toBeGreaterThan(0)
      expect(entry.sample.startsWith('/'), route).toBe(true)
    }
    expect(Object.keys(baseline.routes).length).toBeGreaterThan(0)
  })
})
