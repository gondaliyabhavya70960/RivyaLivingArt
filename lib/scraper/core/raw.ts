import { z } from 'zod'

/**
 * The shape of a RAW item, and the reason it is this small.
 *
 * THIS SCHEMA IS A COMMITMENT DEVICE. Phase 27 builds the adapter architecture that extracts
 * structured fields — price, dimensions, materials, availability — from a page. The failure this
 * schema exists to prevent is the ordinary one: somebody, in this phase, adds "just a quick price
 * regex" because the page is right there and the value is easy, and by the time Phase 27 arrives
 * there is a parser in production that half-works, that something depends on, and that nobody
 * wants to be the one to delete. Accepting only `{ title, canonicalUrl, links }` and rejecting
 * anything richer makes that shortcut fail at the write rather than at review.
 *
 * IT IS ALSO A TRUST BOUNDARY, AND THE MOST HOSTILE ONE IN THE SYSTEM (D1, and the Phases 25–30
 * conventions say so explicitly). Everything in a `raw` payload came from a third party's HTML.
 * `.strict()` is doing real work here: without it, a page could contribute keys nobody designed
 * for into a jsonb column that later phases read.
 */

/** Roughly a paragraph. A `<title>` longer than this is a page doing something else. */
const MAX_TITLE = 500

/**
 * How many link candidates one page may contribute.
 *
 * A CAP RATHER THAN A HOPE. A category page on a large catalogue can carry thousands of anchors,
 * and a discovery run that queued every one of them from every page would grow super-linearly and
 * take the politeness budget with it. Two hundred is generous for a real product listing and
 * bounded enough that a pathological page cannot flood the queue.
 */
export const MAX_LINKS_PER_PAGE = 200

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Only http and https URLs are stored.',
  })

export const rawItemSchema = z
  .object({
    title: z.string().trim().max(MAX_TITLE).nullable(),
    canonicalUrl: httpUrl.nullable(),
    links: z.array(httpUrl).max(MAX_LINKS_PER_PAGE),
  })
  // STRICT, DELIBERATELY. See the header: an extra key here is a Phase 27 shortcut landing early.
  .strict()

export type RawItem = z.infer<typeof rawItemSchema>

/**
 * Read a page body into a RAW item.
 *
 * A REGEX PARSER RATHER THAN AN HTML LIBRARY, and that is a decision rather than a shortcut. What
 * this phase needs from a page is a title and a list of hrefs; a DOM parser would add a dependency
 * that runs a third party's markup through a much larger attack surface for two fields, and — more
 * to the point — it would put a general-purpose extraction tool in the codebase one import away
 * from every "just a quick price regex" this file exists to prevent. Phase 27 chooses that
 * dependency deliberately, with the adapter architecture around it.
 *
 * EVERY URL IS RESOLVED AND FILTERED. Relative hrefs are resolved against the page's own URL,
 * anything that is not http(s) is dropped (`mailto:`, `javascript:`, `tel:`, `data:`), off-host
 * links are dropped — a discovery run follows one site, and following an outbound link is how a
 * crawler ends up somewhere nobody approved — and fragments are stripped so `/p/1` and `/p/1#spec`
 * do not become two work items for one page.
 */
export function readRawItem(html: string, pageUrl: string): RawItem {
  const title = matchTitle(html)
  const canonical = matchCanonical(html, pageUrl)

  let host: string
  try {
    host = new URL(pageUrl).host.toLowerCase()
  } catch {
    return { title, canonicalUrl: canonical, links: [] }
  }

  const links = new Set<string>()
  for (const match of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    if (links.size >= MAX_LINKS_PER_PAGE) break
    const href = (match[2] ?? match[3] ?? match[4] ?? '').trim()
    if (href === '') continue

    const resolved = resolveSameHost(href, pageUrl, host)
    if (resolved !== null) links.add(resolved)
  }

  return { title, canonicalUrl: canonical, links: [...links] }
}

function resolveSameHost(href: string, pageUrl: string, host: string): string | null {
  let url: URL
  try {
    url = new URL(href, pageUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.host.toLowerCase() !== host) return null
  // `/p/1` and `/p/1#specifications` are one page. Keeping both would double the queue and fetch
  // the same document twice, which is the politeness budget spent on nothing.
  url.hash = ''
  return url.toString()
}

function matchTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (match?.[1] === undefined) return null
  const text = decodeBasicEntities(match[1]).replace(/\s+/g, ' ').trim()
  return text === '' ? null : text.slice(0, MAX_TITLE)
}

function matchCanonical(html: string, pageUrl: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0]
    if (!/\brel\s*=\s*("canonical"|'canonical'|canonical\b)/i.test(tag)) continue
    const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(tag)
    const value = (href?.[2] ?? href?.[3] ?? href?.[4] ?? '').trim()
    if (value === '') continue
    try {
      const resolved = new URL(value, pageUrl)
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null
      return resolved.toString()
    } catch {
      return null
    }
  }
  return null
}

/**
 * The five entities that actually appear in a `<title>`.
 *
 * NOT A GENERAL HTML ENTITY DECODER, and it should not become one: the value is a display string
 * stored in jsonb, not markup that will be re-rendered, and a numeric-entity decoder here would be
 * a decoder for third-party input in a file whose whole point is to stay small. Anything it misses
 * survives as its literal entity text, which is legible and harmless.
 */
function decodeBasicEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
