/**
 * FIRST-LOAD JAVASCRIPT, MEASURED FROM WHAT THE BROWSER IS ACTUALLY SENT — Phase 40.
 *
 * The phase document defines the budgeted quantity precisely: "gzipped, and excludes any
 * dynamically imported chunk that is not requested on load". This module produces exactly that
 * number, for one route, by asking the running production server for the page and adding up the
 * scripts the HTML tells the browser to fetch.
 *
 * WHY NOT READ THE BUILD OUTPUT. Next 16's build table no longer prints per-route JavaScript sizes,
 * and the internal manifests that used to carry them have moved twice in two majors. A number
 * derived from a bundler's private files is a number that silently stops meaning what it meant. The
 * HTML a visitor receives cannot drift from what a visitor receives.
 *
 * WHAT COUNTS: every `<script src>` and every `<link rel="preload"|"modulepreload" as="script">`
 * pointing at this origin. That is the initial graph — a chunk behind `import()` appears in neither
 * until something renders it, which is exactly the exclusion the definition asks for.
 *
 * GZIP, NOT BROTLI, and not the raw byte count. Raw bytes flatter nobody but they are not what
 * crosses the network. Brotli would be closer to what a CDN serves and is not reproducible across
 * environments — the quality level is the CDN's choice. Gzip at the default level is deterministic,
 * available everywhere, and moves in step with brotli, so a 5% growth in one is a 5% growth in the
 * other. It is a yardstick, and the point of a yardstick is that it does not change.
 */
import { gzipSync } from 'node:zlib'

/** Every same-origin script URL the HTML asks the browser to load, in document order, deduped. */
export function scriptUrlsFrom(html) {
  const urls = new Set()

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    urls.add(match[1])
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    if (!/\brel=["'](?:preload|modulepreload)["']/i.test(tag)) continue
    // `modulepreload` implies a script; `preload` must say so.
    if (/\brel=["']preload["']/i.test(tag) && !/\bas=["']script["']/i.test(tag)) continue
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)
    if (href !== null) urls.add(href[1])
  }

  // Same-origin only. A cross-origin script is a third party, which `check-third-party.mjs`
  // refuses outright — counting its bytes here would imply it was an acceptable thing to have.
  return [...urls].filter((url) => url.startsWith('/'))
}

/**
 * Fetch one route and total the gzipped bytes of its initial scripts.
 *
 * Returns `{ bytes, files, missing }`. `missing` names any script the server would not serve, which
 * is a real failure worth surfacing rather than quietly scoring as zero.
 */
export async function measureRoute(base, routeUrl) {
  const response = await fetch(new URL(routeUrl, base))
  if (!response.ok) {
    throw new Error(
      `${routeUrl} answered ${String(response.status)} — cannot measure a page that did not render`,
    )
  }
  const html = await response.text()
  const urls = scriptUrlsFrom(html)

  let bytes = 0
  const missing = []
  for (const url of urls) {
    const asset = await fetch(new URL(url, base))
    if (!asset.ok) {
      missing.push(url)
      continue
    }
    // Re-compress the bytes ourselves rather than trusting `content-length`: the dev server, a
    // proxy and a CDN each answer with a different encoding, and the comparison has to be between
    // like and like across all of them.
    bytes += gzipSync(Buffer.from(await asset.arrayBuffer())).byteLength
  }

  return { bytes, files: urls.length, missing }
}

export function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10
}

/**
 * The same measurement, broken down per chunk, for finding out WHERE a route's bytes are.
 *
 * WHY THIS AND NOT `@next/bundle-analyzer`. The analyzer is a webpack plugin and this project builds
 * with Turbopack, which has no webpack plugin pipeline — wiring it behind `ANALYZE=1` would add a
 * dependency that cannot run and a claim in the documentation that is not true. What is true is that
 * every chunk is a URL the page asked for, so it can be fetched, compressed and weighed, and a few
 * marker strings identify what is inside it. That is how Phase 40 found 83.5 kB of Zod on every CMS
 * route (PERFORMANCE.md §4.5).
 *
 * The markers are a heuristic and are labelled as one. A chunk that matches none is reported by size
 * with no guess attached, which is more useful than a confident wrong label.
 */
const MARKERS = [
  ['zod', /ZodError|ZodString|_zod/],
  ['react-dom', /react-dom|__SECRET_INTERNALS/],
  ['scheduler', /unstable_scheduleCallback/],
  ['motion', /framer-motion|useReducedMotion/],
  ['three', /THREE\.|@react-three/],
  ['next-router', /app-router|layout-router/],
]

export async function explainRoute(base, routeUrl) {
  const html = await (await fetch(new URL(routeUrl, base))).text()
  const chunks = []
  for (const url of scriptUrlsFrom(html)) {
    const asset = await fetch(new URL(url, base))
    if (!asset.ok) continue
    const raw = Buffer.from(await asset.arrayBuffer())
    const text = raw.toString('utf8')
    chunks.push({
      url,
      gzipBytes: gzipSync(raw).byteLength,
      rawBytes: raw.byteLength,
      contains: MARKERS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name),
    })
  }
  return chunks.sort((a, b) => b.gzipBytes - a.gzipBytes)
}
