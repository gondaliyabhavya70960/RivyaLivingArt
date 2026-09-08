import 'server-only'

import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import { getSiteChrome } from '@/lib/site/chrome'

/**
 * The homepage's structured data: a `WebSite` and an `Organization`, and nothing else.
 *
 * WHAT IS NOT HERE IS THE POINT. No `aggregateRating`, no `award`, no `founder`, no
 * `foundingDate`, no `address`, no `telephone`, no `sameAs`, no `priceRange`, no `openingHours`.
 * Every one of those is a business fact nobody has supplied, and structured data is the one place
 * where inventing one is worse than putting it on a page: a search engine reads it as an assertion
 * by the business itself, shows it in a result, and keeps showing it long after the page changes.
 * D10 forbids fabricating a business fact anywhere; here it would be fabricating one in a machine-
 * readable format designed to be trusted.
 *
 * SO THE SHAPE OF THIS MODULE IS "OMIT, NEVER DEFAULT". Two fields are emitted — the brand name
 * and the site's own URL — and both come from somewhere real: `BRAND.brand.name` is a
 * `global_content` row the owner can edit, and the origin is `NEXT_PUBLIC_SITE_URL`. With either
 * missing, this returns null and the page carries no structured data at all, which is a true
 * statement about what we know rather than a partial one about what we do not.
 *
 * NO `logo` UNTIL THERE IS A LOGO. `media_assets` holds no brand asset yet — the Higgsfield
 * migration has not run and no logo has been uploaded — and a `logo` pointing at a URL that 404s
 * is worse than an absent one: it is a claim that resolves to nothing. When a brand asset exists,
 * this is where it goes.
 *
 * ONE GRAPH, ONE SCRIPT TAG. `@graph` carries both nodes in a single `application/ld+json` block,
 * which is what the phase's own verification counts (`grep -c 'application/ld+json'` → 1). Two
 * separate scripts would parse identically and make that check meaningless.
 */

export type JsonLdNode = {
  readonly '@type': string
  readonly name: string
  readonly url: string
}

export type JsonLdGraph = {
  readonly '@context': 'https://schema.org'
  readonly '@graph': readonly JsonLdNode[]
}

/**
 * `NEXT_PUBLIC_SITE_URL` as an origin, or null.
 *
 * Parsed rather than trusted: a malformed value would otherwise be published as the canonical
 * identity of the business. `optionalEnv`, not `requiredEnv`, because a preview deployment without
 * the variable must render the page rather than fail to build — this is metadata, not content.
 */
function siteOrigin(): string | null {
  const raw = optionalEnv('NEXT_PUBLIC_SITE_URL')
  if (raw === null) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

export async function homepageJsonLd(): Promise<JsonLdGraph | null> {
  const chrome = await getSiteChrome()
  const url = siteOrigin()
  // The brand row first, the SEO site name behind it: the same order the masthead uses, so the
  // structured data and the visible page cannot disagree about what the business is called.
  const name =
    siteString(chrome.strings, 'BRAND.brand.name') ??
    siteString(chrome.strings, 'SEO_DEFAULT.site_name')

  if (url === null || name === null) return null

  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name, url },
      { '@type': 'Organization', name, url },
    ],
  }
}

/**
 * The graph as a string safe to place inside a `<script>` element.
 *
 * `<` IS ESCAPED, AND THAT IS NOT PARANOIA ABOUT OUR OWN DATA. The brand name is a
 * `global_content` row an editor can type into, and a `</script>` sequence anywhere inside a
 * script block ends the block wherever it appears — including inside a JSON string. Escaping it as
 * `<` is still valid JSON, parses to the same value, and cannot close the element.
 */
export function serialiseJsonLd(graph: JsonLdGraph): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c')
}
