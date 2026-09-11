#!/usr/bin/env node
/**
 * PER-ROUTE ISLAND CENSUS (Phase 40)
 *
 * `perf/budgets.json` gives every route an island budget. This walks each route's import graph and
 * fails when a route hydrates more client component roots than it is allowed.
 *
 * WHY A SECOND ISLAND GATE. Phase 11's `scripts/site/check-island-budget.mjs` asserts WHICH islands
 * the homepage has, by name, against a hand-maintained allowlist — so swapping one island for
 * another has to be read in a diff. That is a strong check and it covers one route. This one is
 * weaker per route and covers all of them: a count, everywhere, so a new island on `/faq` cannot
 * arrive unnoticed just because nobody wrote an allowlist for `/faq`.
 *
 * THEY SHARE THE WALK (`scripts/perf/island-graph.mjs`) so they cannot disagree about what an
 * island is. See that file for the definition; the short version is that an island is a
 * `'use client'` module a SERVER module imports, statically.
 *
 * WHAT A BUDGET MISS MEANS, because the number is not sacred. An island is a hydration boundary
 * with its own React tree, its own props serialised into the RSC payload and its own share of the
 * route's JavaScript. Adding one is sometimes exactly right — a route became interactive. The gate
 * is not there to forbid that; it is there to make it a decision somebody took, in a diff, with
 * `perf/budgets.json` open. Raising a budget is a one-line edit with a `why` beside it.
 *
 * ROUTES NOT IN THE BUDGET FILE FAIL, and that is the important half. A budget table that silently
 * ignores what it does not know about is a budget table that covers whatever was written the day it
 * was made. Every `page.tsx` under `app/` must be either budgeted or explicitly excluded.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ROOT, discoverRoutes, islandsOf } from './island-graph.mjs'

const budgets = JSON.parse(readFileSync(join(ROOT, 'perf', 'budgets.json'), 'utf8'))
const routes = discoverRoutes()

/**
 * The group rule for a route, if one covers it.
 *
 * EIGHTY-TWO STUDIO ROUTES ARE ONE SURFACE, NOT EIGHTY-TWO BUDGETS. The phase document budgets
 * `/studio/**` as a single row for the same reason: it is an authenticated staff tool where the
 * cost that matters is the shell everybody loads, not the difference between two list pages. A
 * per-route table there would be eighty-two lines nobody reads and nobody maintains.
 *
 * Longest prefix wins, so a specific rule can be added later without rewriting this.
 */
function groupFor(routePattern) {
  let best
  let bestLength = -1
  for (const [prefix, rule] of Object.entries(budgets.groups ?? {})) {
    if (routePattern !== prefix && !routePattern.startsWith(`${prefix}/`)) continue
    if (prefix.length > bestLength) {
      best = rule
      bestLength = prefix.length
    }
  }
  return best
}

const problems = []
const report = []
const seen = new Set()

for (const { routePattern, entries } of routes) {
  seen.add(routePattern)

  const excluded = budgets.excluded[routePattern]
  if (excluded !== undefined) continue

  const budget = budgets.routes[routePattern] ?? groupFor(routePattern)
  if (budget === undefined) {
    problems.push(
      `${routePattern} has no entry in perf/budgets.json — every route is budgeted or explicitly ` +
        'excluded; add it to `routes` with an islands budget, to a prefix in `groups`, or to ' +
        '`excluded` with a reason',
    )
    continue
  }

  const { islands, lazyIslands } = islandsOf(entries)
  report.push({ routePattern, count: islands.length, budget: budget.islands, lazyIslands })

  if (islands.length > budget.islands) {
    const names = islands.map((key) =>
      key.replace(/^components\//, '').replace(/\/index\.tsx$/, ''),
    )
    problems.push(
      `${routePattern}: ${String(islands.length)} islands, budget is ${String(budget.islands)} — ` +
        names.join(', '),
    )
  }
}

// A budget for a route that no longer exists is a stale line that will quietly stop protecting
// anything, so it is a failure rather than a warning.
for (const routePattern of Object.keys(budgets.routes)) {
  if (!seen.has(routePattern)) {
    problems.push(
      `perf/budgets.json budgets ${routePattern}, which no longer exists under app/ — remove it, ` +
        'or find out what happened to the route',
    )
  }
}
for (const routePattern of Object.keys(budgets.excluded)) {
  if (!seen.has(routePattern)) {
    problems.push(`perf/budgets.json excludes ${routePattern}, which no longer exists under app/`)
  }
}

if (problems.length > 0) {
  console.error(`✗ island budgets: ${String(problems.length)} problem(s):`)
  for (const problem of problems) console.error(`    ${problem}`)
  process.exit(1)
}

const worst = [...report].sort((a, b) => b.count - a.count)[0]
const lazy = new Set(report.flatMap((entry) => entry.lazyIslands))
console.log(
  `✓ island budgets: ${String(report.length)} route(s) within budget; the heaviest is ` +
    `${worst?.routePattern ?? '—'} at ${String(worst?.count ?? 0)}/${String(worst?.budget ?? 0)}; ` +
    `${String(lazy.size)} island(s) load on demand across the site`,
)
