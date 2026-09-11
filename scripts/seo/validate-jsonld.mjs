#!/usr/bin/env node
/**
 * seo:validate-jsonld — crawl a running build, parse every `application/ld+json` block on every
 * route it can reach, and fail on any forbidden key or type.
 *
 *   node scripts/seo/validate-jsonld.mjs --base http://localhost:3000
 *
 * WHAT IT VISITS: the thirteen D3 static paths, `/search`, every URL in every child of
 * `/sitemap.xml` (when the build has an origin and therefore a sitemap), and `/robots.txt` for the
 * `Disallow` lines the phase document names. A route that answers 404 is fine — the seeded state
 * has most pages unpublished — and its body is still parsed, because a 404 page with structured
 * data would be its own kind of wrong.
 *
 * WHAT IT REFUSES: every key in FORBIDDEN_KEYS and every `@type` in FORBIDDEN_TYPES from
 * lib/seo/jsonld/guard.ts (mirrored here so this script needs no TypeScript), an `Offer` whose
 * `price` is missing, and more than one `application/ld+json` block on a page — the JsonLd
 * component emits one graph per route, and a second block means a second emitter.
 *
 * The list is duplicated rather than imported deliberately: this script runs against a BUILD, in
 * CI, after `next start`, where importing the TypeScript source would need a loader the gate
 * should not depend on. `tests/unit/jsonld-guard.test.ts` asserts the two lists agree.
 */
import { pathToFileURL } from 'node:url'

export const FORBIDDEN_KEYS = [
  'aggregateRating',
  'review',
  'reviews',
  'award',
  'awards',
  'hasCredential',
  'foundingDate',
  'numberOfEmployees',
  'address',
  'telephone',
  'openingHours',
  'openingHoursSpecification',
  'priceRange',
  'gtin',
  'gtin8',
  'gtin12',
  'gtin13',
  'gtin14',
  'mpn',
  'shippingDetails',
  'hasMerchantReturnPolicy',
  'returnPolicy',
  'deliveryTime',
  'areaServed',
  'availability',
]
export const FORBIDDEN_TYPES = [
  'LocalBusiness',
  'Store',
  'Review',
  'Rating',
  'AggregateRating',
  'Award',
  'Certification',
  'OpeningHoursSpecification',
  'OfferShippingDetails',
  'MerchantReturnPolicy',
  'Service',
]

const STATIC_PATHS = [
  '/',
  '/about',
  '/process',
  '/large-format',
  '/collection',
  '/custom-commissions',
  '/portfolio',
  '/journal',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/search',
]

const keySet = new Set(FORBIDDEN_KEYS)
const typeSet = new Set(FORBIDDEN_TYPES)

/** Every forbidden key or type in `node`, as JSON-path strings. Mirrors forbiddenKeysIn(). */
export function forbiddenIn(node, at = '$') {
  const found = []
  const walk = (value, path, parentType) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${String(index)}]`, parentType))
      return
    }
    if (value === null || typeof value !== 'object') return
    const type = typeof value['@type'] === 'string' ? value['@type'] : null
    if (type !== null && typeSet.has(type)) found.push(`${path}.@type=${type}`)
    if (type === 'Offer' && (typeof value.price !== 'string' || value.price === '')) {
      found.push(`${path}.Offer-without-price`)
    }
    for (const [key, child] of Object.entries(value)) {
      const here = `${path}.${key}`
      const exempt = key === 'telephone' && type === 'ContactPoint'
      if (keySet.has(key) && !exempt) found.push(here)
      walk(child, here, type ?? parentType)
    }
  }
  walk(node, at, null)
  return found
}

/** The JSON-LD blocks in an HTML document, parsed. A block that does not parse is a finding. */
export function blocksIn(html) {
  const blocks = []
  const problems = []
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  let match
  while ((match = pattern.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1]))
    } catch (error) {
      problems.push(`unparseable block: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { blocks, problems }
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'manual', headers: { accept: 'text/html,*/*' } })
  return { status: response.status, text: await response.text(), headers: response.headers }
}

function sitemapLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

async function main() {
  const args = process.argv.slice(2)
  const baseIndex = args.indexOf('--base')
  const base =
    (baseIndex >= 0 ? args[baseIndex + 1] : process.env.BASE_URL) ?? 'http://localhost:3000'
  const origin = new URL(base).origin

  const problems = []
  let pages = 0
  let blocksSeen = 0

  // Everything the sitemap index lists, when there is one.
  const paths = new Set(STATIC_PATHS)
  const index = await fetchText(`${origin}/sitemap.xml`)
  if (index.status === 200) {
    for (const child of sitemapLocs(index.text)) {
      const childDoc = await fetchText(child)
      if (childDoc.status !== 200) {
        problems.push(`${child}: sitemap child answered ${String(childDoc.status)}`)
        continue
      }
      for (const loc of sitemapLocs(childDoc.text)) paths.add(new URL(loc).pathname)
    }
  }

  for (const path of paths) {
    const page = await fetchText(`${origin}${path}`)
    pages += 1
    const { blocks, problems: parse } = blocksIn(page.text)
    for (const problem of parse) problems.push(`${path}: ${problem}`)
    if (blocks.length > 1) {
      problems.push(
        `${path}: ${String(blocks.length)} application/ld+json blocks — one graph per route`,
      )
    }
    for (const block of blocks) {
      blocksSeen += 1
      for (const hit of forbiddenIn(block)) problems.push(`${path}: forbidden ${hit}`)
    }
  }

  // robots.txt and the X-Robots-Tag on /studio and /api, per the route-class table.
  const robots = await fetchText(`${origin}/robots.txt`)
  for (const line of ['Disallow: /studio', 'Disallow: /api']) {
    if (!robots.text.includes(line)) problems.push(`/robots.txt: missing "${line}"`)
  }
  for (const path of ['/studio', '/api/revalidate']) {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual' })
    const tag = response.headers.get('x-robots-tag') ?? ''
    if (!/noindex/.test(tag) || !/nofollow/.test(tag)) {
      problems.push(`${path}: X-Robots-Tag is "${tag}", expected noindex, nofollow`)
    }
  }

  if (problems.length > 0) {
    console.error(`\n✗ structured data on ${String(pages)} routes:\n`)
    for (const problem of problems) console.error(`    ${problem}`)
    console.error('')
    process.exit(1)
  }
  console.log(
    `✓ structured data: ${String(pages)} routes, ${String(blocksSeen)} graphs, no forbidden key or type; robots.txt and X-Robots-Tag as the route-class table says`,
  )
}

// Run only as a script; the unit test imports the two lists and `forbiddenIn`.
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
