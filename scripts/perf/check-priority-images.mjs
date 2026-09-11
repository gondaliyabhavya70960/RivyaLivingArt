#!/usr/bin/env node
/**
 * EXACTLY ONE PRIORITY IMAGE PER ROUTE (Phase 40)
 *
 * Phase 11's rule, generalised to the whole site: the largest contentful paint element is chosen
 * rather than discovered, it is always an `<img>`, and there is exactly one of it.
 *
 * WHY ONE AND NOT "AT LEAST ONE". Two images marked `fetchpriority="high"` are worth about as much
 * as none: the browser has a finite number of connections and resolves the tie by document order,
 * so the second one demotes the first. The failure mode is invisible — the page still works, the
 * hero simply paints later than it would have — which is exactly the kind of regression that needs
 * a gate rather than a code review.
 *
 * WHY NONE IS ALSO A FAILURE. Without a priority hint the hero is fetched at the browser's default
 * priority, behind every stylesheet and script the parser has already found, and `loading="lazy"`
 * (this product's default, correctly) defers it further. Before this phase, no `MediaImage` usage
 * anywhere in the tree set an eager or priority hint, so every hero on the site was lazily loaded
 * at low priority. That is the defect this gate exists to keep fixed.
 *
 * IT READS THE RENDERED HTML, NOT THE SOURCE, and that is the only way to answer the question. The
 * priority image is chosen by the section renderer from `isFirst`, which `SectionList` computes at
 * render time from the page's live sections — so which image carries it depends on what the CMS
 * says today, and no static scan of the JSX can know. Asking the built site is both simpler and
 * true.
 *
 *   node scripts/perf/check-priority-images.mjs --base http://127.0.0.1:3000
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const baseArg = process.argv.find((argument) => argument.startsWith('--base='))
const baseIndex = process.argv.indexOf('--base')
const base =
  baseArg !== undefined
    ? baseArg.slice('--base='.length)
    : baseIndex !== -1
      ? process.argv[baseIndex + 1]
      : 'http://127.0.0.1:3000'

const budgets = JSON.parse(readFileSync(join(ROOT, 'perf', 'budgets.json'), 'utf8'))

/** Every element carrying a high fetch priority, with its tag name. */
function highPriorityElements(html) {
  const found = []
  for (const match of html.matchAll(/<([a-z]+)\b([^>]*)>/gi)) {
    if (!/\bfetchpriority=["']high["']/i.test(match[2])) continue
    found.push({ tag: match[1].toLowerCase(), markup: match[0].slice(0, 160) })
  }
  return found
}

const problems = []
const skipped = []
let checked = 0

for (const [routePattern, budget] of Object.entries(budgets.routes)) {
  // A bracket route needs a live slug; the sitemap gives one, but the LCP rule is a property of the
  // template rather than of the row, and every template is reachable through a static route or
  // through the sample the bundle guard already resolves. Static routes here; `tests/e2e` covers a
  // product page with a real product open.
  if (routePattern.includes('[')) continue

  const response = await fetch(new URL(routePattern, base))
  if (!response.ok) {
    skipped.push(`${routePattern} (${String(response.status)})`)
    continue
  }
  checked += 1
  const elements = highPriorityElements(await response.text())

  if (elements.length === 0) {
    /*
     * ZERO IS ONLY A FAILURE WHERE THE ROUTE CLAIMS AN LCP IMAGE.
     *
     * `/search` and `/journal/category/[slug]` are listings whose largest contentful paint is text,
     * and requiring a priority image everywhere would mean inventing a decorative hero for them —
     * a bigger page, to satisfy a gate, on the routes with the tightest budgets. `lcpImage` in
     * perf/budgets.json is where that is declared, per route, so the exemption is a line somebody
     * wrote rather than a silence.
     */
    if (budget.lcpImage === true) {
      problems.push(
        `${routePattern}: declares lcpImage but renders no <img fetchpriority="high">. Pass ` +
          '`priority` to the MediaImage the visitor sees first — the section renderers derive it ' +
          'from `isFirst`.',
      )
    }
    continue
  }
  if (elements.length > 1) {
    problems.push(
      `${routePattern}: ${String(elements.length)} elements carry fetchpriority="high" — two ` +
        'priority hints are worth about as much as none. Tags: ' +
        elements.map((element) => element.tag).join(', '),
    )
    continue
  }
  if (elements[0].tag !== 'img') {
    problems.push(
      `${routePattern}: the priority element is a <${elements[0].tag}>, not an <img>. The LCP ` +
        'element is always an image — never a video, never a canvas (Phase 11).',
    )
  }
}

if (checked === 0) {
  console.error(
    `✗ priority images: no budgeted static route rendered at ${base} — nothing was checked` +
      (skipped.length > 0 ? `\n    skipped: ${skipped.join(', ')}` : ''),
  )
  process.exit(1)
}

if (problems.length > 0) {
  console.error(`✗ priority images: ${String(problems.length)} problem(s):`)
  for (const problem of problems) console.error(`    ${problem}`)
  process.exit(1)
}

console.log(
  `✓ priority images: ${String(checked)} route(s); every route with an LCP image has exactly one ` +
    '<img fetchpriority="high"> and no route has two' +
    (skipped.length > 0
      ? `; ${String(skipped.length)} did not render (${skipped.join(', ')})`
      : ''),
)
