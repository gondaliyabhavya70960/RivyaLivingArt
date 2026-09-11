#!/usr/bin/env node
/**
 * THE CACHING CONTRACT, ASSERTED AGAINST A RUNNING PRODUCTION BUILD (Phase 40)
 *
 * Until this phase the caching strategy was decided route by route and written down nowhere. The
 * table below is that decision, in one place, checked. PHASE-39-46.md §Phase 40 is its source and
 * `docs/ops/PERFORMANCE.md` §5 renders it for people.
 *
 * IT RUNS AGAINST A SERVER, NOT AGAINST SOURCE, because `export const revalidate` is an intention
 * and a `Cache-Control` header is what a CDN acts on. The two come apart quietly: a route that
 * reads `searchParams` becomes dynamic for every request no matter what it exported, and nothing
 * in the source says so.
 *
 *   npm start                                          (or `next start` against a built app)
 *   node scripts/perf/check-cache-headers.mjs --base http://127.0.0.1:3000
 *
 * WHAT "ISR" LOOKS LIKE ON THE WIRE. Next answers a revalidating route with
 * `s-maxage=<revalidate>, stale-while-revalidate=…`. The assertion below checks the `s-maxage`
 * because that is the number the contract fixes; the stale window is Next's own and moves between
 * versions.
 *
 * THE DEVIATION ROW IS IN THE TABLE, NOT IN A COMMENT SOMEWHERE ELSE. Three listing routes are
 * dynamic where the contract asks for ISR, for one reason that is the same in all three: each reads
 * `searchParams` — a page number, a filter tuple — and in Next 16 awaiting `searchParams` opts the
 * whole route into dynamic rendering, including the unfiltered request. Serving the unfiltered case
 * from ISR would mean a second route, or a parallel route, and that is an architecture change
 * rather than tuning. It is recorded here with `why`, tracked in PERFORMANCE.md §5, and this gate
 * asserts what the site actually does so that a change to it is still caught.
 */
import { argv, exit } from 'node:process'

const baseArg = argv.find((argument) => argument.startsWith('--base='))
const baseIndex = argv.indexOf('--base')
const base =
  baseArg !== undefined
    ? baseArg.slice('--base='.length)
    : baseIndex !== -1
      ? argv[baseIndex + 1]
      : 'http://127.0.0.1:3000'

/** `isr(n)` — revalidating with `s-maxage=n`. */
const isr = (seconds) => ({
  describe: `ISR, s-maxage=${String(seconds)}`,
  test: (value) => new RegExp(`\\bs-maxage=${String(seconds)}\\b`).test(value),
})

const noStore = {
  describe: 'no-store',
  test: (value) => /\bno-store\b/.test(value),
}

const privateNoStore = {
  describe: 'private, no-store',
  test: (value) => /\bprivate\b/.test(value) && /\bno-store\b/.test(value),
}

const immutable = {
  describe: 'public, max-age=31536000, immutable',
  test: (value) => /\bimmutable\b/.test(value) && /\bmax-age=31536000\b/.test(value),
}

const swr = (sMaxAge, stale) => ({
  describe: `public, s-maxage=${String(sMaxAge)}, stale-while-revalidate=${String(stale)}`,
  test: (value) =>
    /\bpublic\b/.test(value) &&
    new RegExp(`\\bs-maxage=${String(sMaxAge)}\\b`).test(value) &&
    new RegExp(`\\bstale-while-revalidate=${String(stale)}\\b`).test(value),
})

/**
 * The contract. `url` is a concrete request; `expect` is the rule; `why` is present only on a row
 * that departs from PHASE-39-46.md, and its presence is what makes the departure visible.
 */
const CONTRACT = [
  { url: '/', expect: isr(3600), note: 'CMS page' },
  { url: '/about', expect: isr(3600), note: 'CMS page' },
  { url: '/portfolio', expect: isr(3600), note: 'CMS page' },
  { url: '/search', expect: noStore, note: 'Dynamic; a result set is never cached' },
  {
    url: '/journal',
    expect: noStore,
    why: 'The contract asks for ISR. The listing reads `searchParams` for its page number, which in Next 16 makes the route dynamic for every request including page 1. Serving the unpaginated case from ISR needs a second route — architecture, not tuning. Tracked in PERFORMANCE.md §5.',
  },
  {
    url: '/collection',
    expect: noStore,
    why: 'As /journal: the store listing reads filter and sort parameters.',
  },
  {
    url: '/api/search/suggest?q=table',
    expect: swr(60, 300),
    note: 'Phase 23 rule, unchanged',
  },
  { url: '/studio', expect: privateNoStore, note: 'Never cached by anything, anywhere' },
]

/** Rows whose URL has to be discovered from the sitemap, because they need a live slug. */
const DYNAMIC_CONTRACT = [
  { prefix: '/product/', expect: isr(3600), label: '/product/[slug]' },
  { prefix: '/journal/', expect: isr(3600), label: '/journal/[slug]' },
]

async function cacheControl(url) {
  const response = await fetch(new URL(url, base), { redirect: 'manual' })
  return {
    status: response.status,
    value: response.headers.get('cache-control') ?? '',
  }
}

const problems = []
const skipped = []
let checked = 0

for (const row of CONTRACT) {
  const { status, value } = await cacheControl(row.url)
  // A redirect or an auth bounce still carries the header, and for /studio that is exactly the
  // response worth checking — the signed-out redirect must not be cached either.
  if (status >= 400) {
    skipped.push(`${row.url} (${String(status)})`)
    continue
  }
  checked += 1
  if (!row.expect.test(value)) {
    problems.push(
      `${row.url}: expected ${row.expect.describe}, got ${value === '' ? '(no Cache-Control header)' : value}`,
    )
  }
}

// One live URL per dynamic template, from the site's own sitemap.
const sitemapUrls = []
try {
  const index = await (await fetch(new URL('/sitemap.xml', base))).text()
  for (const child of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const body = await (await fetch(child[1])).text()
    for (const url of body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      sitemapUrls.push(new URL(url[1]).pathname)
    }
  }
} catch {
  skipped.push('the sitemap could not be read, so no dynamic route was checked')
}

for (const row of DYNAMIC_CONTRACT) {
  const sample = sitemapUrls.find(
    (url) => url.startsWith(row.prefix) && url.split('/').length === row.prefix.split('/').length,
  )
  if (sample === undefined) {
    skipped.push(`${row.label} (no live URL in the sitemap)`)
    continue
  }
  const { status, value } = await cacheControl(sample)
  if (status >= 400) {
    skipped.push(`${row.label} (${String(status)})`)
    continue
  }
  checked += 1
  if (!row.expect.test(value)) {
    problems.push(`${row.label} (${sample}): expected ${row.expect.describe}, got ${value}`)
  }
}

// A hashed build asset, taken from whatever the homepage happens to load.
const home = await (await fetch(new URL('/', base))).text()
const asset = /src="(\/_next\/static\/[^"]+)"/.exec(home)?.[1]
if (asset === undefined) {
  skipped.push('no /_next/static asset found on the homepage')
} else {
  const { value } = await cacheControl(asset)
  checked += 1
  if (!immutable.test(value)) {
    problems.push(`${asset}: expected ${immutable.describe}, got ${value}`)
  }
}

if (checked === 0) {
  console.error(`✗ caching contract: nothing was reachable at ${base}`)
  exit(1)
}

if (problems.length > 0) {
  console.error(`✗ caching contract: ${String(problems.length)} row(s) do not match:`)
  for (const problem of problems) console.error(`    ${problem}`)
  console.error('\n  The contract is PHASE-39-46.md §Phase 40 and docs/ops/PERFORMANCE.md §5.')
  exit(1)
}

const deviations = CONTRACT.filter((row) => row.why !== undefined).length
console.log(
  `✓ caching contract: ${String(checked)} row(s) match` +
    (deviations > 0 ? `, ${String(deviations)} recorded deviation(s)` : '') +
    (skipped.length > 0 ? `; ${String(skipped.length)} not checked (${skipped.join(', ')})` : ''),
)
