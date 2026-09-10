import type { HTMLElement } from 'node-html-parser'

import {
  MAX_IMAGE_URLS,
  withField,
  type RawProductDraft,
} from '@/lib/scraper/adapters/draft-schema'
import type { AdapterContext } from '@/lib/scraper/adapters/types'

/**
 * OpenGraph — what the page tells a social network, read as what it tells us.
 *
 * FOURTH IN THE ORDER, AND BELOW ALL THREE SCHEMA.ORG SPELLINGS FOR A REASON WORTH STATING. An
 * OpenGraph tag describes a SHARE CARD. `og:title` is written to look right in a timeline, which
 * on a great many sites means the product's name with the site's name appended and a separator
 * between them; `og:image` is often a rendered card with a logo on it rather than the photograph
 * from the gallery. None of that is wrong — it is simply a different claim from "this product is
 * called X" — so it is read only where a page has said nothing better, and the provenance says so.
 *
 * IT IS STILL WORTH READING, WHICH IS WHY IT IS ABOVE `<title>`. A page carrying no structured data
 * at all frequently carries `product:price:amount` and `product:price:currency`, and a price with
 * `provenance.priceText = 'opengraph'` beside it is a fact a merchandiser can weigh. The phase's own
 * verification step asks for exactly that: a page with no JSON-LD but OpenGraph tags produces a
 * draft with `confidence.priceText = 1`.
 *
 * BOTH `property` AND `name` ARE ACCEPTED. OpenGraph is RDFa, so the correct attribute is
 * `property`; a large minority of pages — and several content-management systems by default — emit
 * `name` instead, and every consumer in the world reads both. Refusing one on a technicality would
 * lose the price on those pages to make a point about a specification nobody enforces.
 *
 * THE KEY LIST IS CLOSED AND SHORT. `og:title`, `og:description`, `og:url`, the three spellings of
 * `og:image`, and the three `product:` price and availability keys. There is no attempt to read
 * `product:retailer_item_id` as a SKU or `og:type` as a category: each of those is a guess about
 * somebody's convention, and a guess with a provenance entry behind it is harder to catch than one
 * without.
 */

/** `og:image`, and the two keys that mean the same thing to every consumer that reads it. */
const IMAGE_KEYS: ReadonlySet<string> = new Set(['og:image', 'og:image:url', 'og:image:secure_url'])

/** The six draft fields OpenGraph can speak to, every one of them a `string | null`. */
type OpenGraphField =
  'title' | 'descriptionHtml' | 'canonicalUrl' | 'priceText' | 'currencyText' | 'availabilityText'

/**
 * One OpenGraph key to one draft field, and nothing derived.
 *
 * `og:description` GOES TO `descriptionHtml` AS TEXT. The field is named for what it may HOLD —
 * `draft-schema.ts` keeps it for Phase 28 to read a lead time or a dimension out of — not for a
 * promise that this adapter reconstructs markup. What OpenGraph publishes is a sentence, and a
 * sentence is what is recorded.
 *
 * `og:url` GOES TO `canonicalUrl` UNRESOLVED, matching the schema's own note: the field is the
 * claim the page makes about where it lives, and reconciling that with where the bytes came from is
 * Phase 28's decision about identity, not this module's.
 */
const FIELD_BY_KEY: ReadonlyMap<string, OpenGraphField> = new Map([
  ['og:title', 'title'],
  ['og:description', 'descriptionHtml'],
  ['og:url', 'canonicalUrl'],
  ['product:price:amount', 'priceText'],
  ['product:price:currency', 'currencyText'],
  ['product:availability', 'availabilityText'],
])

/** Write whatever the page's meta tags say, in document order, under `'opengraph'`. */
export function applyOpenGraph(
  draft: RawProductDraft,
  root: HTMLElement,
  ctx: AdapterContext,
  imageReference: (reference: string) => string | null,
): RawProductDraft {
  let metas: readonly HTMLElement[]
  try {
    metas = root.querySelectorAll('meta')
  } catch {
    return draft
  }

  let next = draft
  const images: string[] = []

  for (const meta of metas) {
    if (ctx.budgetSpent()) break

    const key = (meta.getAttribute('property') ?? meta.getAttribute('name') ?? '')
      .trim()
      .toLowerCase()
    if (key === '') continue

    const content = (meta.getAttribute('content') ?? '').trim()
    if (content === '') continue

    if (IMAGE_KEYS.has(key)) {
      // COLLECTED IN DOCUMENT ORDER ACROSS ALL THREE KEYS, because a gallery published this way
      // interleaves them — `og:image` then its `og:image:secure_url` — and the first entry is the
      // one a share card would show. Re-grouping by key would put the https variants after the
      // http ones and change which image a merchandiser sees first.
      if (images.length >= MAX_IMAGE_URLS) continue
      const resolved = imageReference(content)
      if (resolved !== null) images.push(resolved)
      continue
    }

    const field = FIELD_BY_KEY.get(key)
    if (field === undefined) continue
    // `withField` IS GENERIC OVER THE FIELD NAME, AND THE NARROW MAP TYPE IS WHAT LETS THIS ONE
    // LINE STAND IN FOR SIX. `OpenGraphField` names only fields the draft types as `string | null`,
    // so `RawProductDraft[OpenGraphField]` is `string | null` and a `string` is assignable to it
    // with no cast. Add a key here whose field holds a list and this line stops compiling, which is
    // exactly where a string written into an array field should be caught.
    next = withField(next, field, content, 'opengraph')
  }

  return withField(next, 'imageUrls', images, 'opengraph')
}
