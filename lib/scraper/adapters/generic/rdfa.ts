import type { HTMLElement } from 'node-html-parser'

import type { RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import {
  applyProductItem,
  isProductType,
  microdataValue,
  propertyName,
  type ProductItem,
  type ProductProperty,
} from '@/lib/scraper/adapters/generic/microdata'
import type { AdapterContext } from '@/lib/scraper/adapters/types'

/**
 * RDFa — the same vocabulary as microdata, spelled with different attribute names.
 *
 * IT IS A SPELLING, NOT A THIRD OPINION, WHICH IS WHY THIS FILE IS SHORT. `typeof` is microdata's
 * `itemtype` and `property` is its `itemprop`; once an element tree has been read into the
 * `ProductItem` model in `microdata.ts`, what `name`, `sku` and `offers/price` mean is settled
 * there, once, for all three spellings. Everything this module knows is the two attribute names,
 * the two places RDFa puts a value that microdata does not, and the fact that a nested item is
 * marked by `typeof` rather than by `itemscope`.
 *
 * IT IS FOURTH IN THE STRATEGY ORDER AND THAT PLACING IS NOT A JUDGEMENT ABOUT RDFa'S QUALITY. A
 * page publishing both microdata and RDFa is publishing one product twice; whichever is read first
 * wins every field and the other contributes nothing, so the order between them decides only which
 * strategy name appears in `provenance`. What the order genuinely settles is that both of them beat
 * OpenGraph, which describes a SHARE CARD rather than a product — `og:title` is written for a
 * timeline and is routinely the site's name with the product's appended.
 *
 * NO `prefix`, `vocab` OR `about` HANDLING, DELIBERATELY. RDFa's full model is a graph with
 * subjects, and implementing it would be a general RDFa processor reading a third party's page in
 * order to answer fifteen questions about one product. `localName` in `microdata.ts` strips the
 * prefix off `schema:name` and `https://schema.org/name` alike, which is the whole of what the
 * shape actually costs us here: a page using a genuinely different vocabulary under a prefix that
 * happens to end in `name` would be misread, and that page is rarer than the pages this reads
 * correctly. A source that needs more than this has configured selectors (strategy five) and,
 * failing those, a vendor adapter.
 */

/** Bounds on a third party's document, matching `microdata.ts`'s for the same reasons. */
const MAX_ITEM_DEPTH = 6
const MAX_ITEM_PROPERTIES = 300

/**
 * The first element whose `typeof` names a product, read as an item.
 *
 * THE FIRST ONE, NOT A MERGE OF ALL OF THEM — the argument is written out in
 * `readMicrodataProduct`, and it is the same argument.
 */
export function readRdfaProduct(root: HTMLElement, ctx: AdapterContext): ProductItem | null {
  let typed: readonly HTMLElement[]
  try {
    typed = root.querySelectorAll('[typeof]')
  } catch {
    return null
  }

  for (const element of typed) {
    if (ctx.budgetSpent()) return null
    const declared = element.getAttribute('typeof') ?? ''
    if (!declared.split(/\s+/).some(isProductType)) continue
    return readRdfaItem(element, ctx, 0)
  }

  return null
}

/** The RDFa strategy, whole: read the page's first product and write what it says. */
export function applyRdfa(
  draft: RawProductDraft,
  root: HTMLElement,
  ctx: AdapterContext,
  imageReference: (reference: string) => string | null,
): RawProductDraft {
  const item = readRdfaProduct(root, ctx)
  if (item === null) return draft
  return applyProductItem(draft, item, 'rdfa', imageReference)
}

function readRdfaItem(element: HTMLElement, ctx: AdapterContext, depth: number): ProductItem {
  const properties: ProductProperty[] = []
  collectRdfaProperties(element, ctx, depth, properties)
  return properties
}

/**
 * Walk one item's subtree, stopping at the elements that start another.
 *
 * A `typeof` INSIDE A `typeof` STARTS A NEW SUBJECT, which is RDFa's version of the rule
 * `microdata.ts` records for nested `itemscope`s: an offer's `price` belongs to the offer, and
 * flattening it up onto the product is the reading that quietly attaches one product's price to
 * another's name. An element carrying `property` WITHOUT `typeof` is a literal of this item, and
 * the walk continues through it, because a wrapper that is itself a property may still contain
 * properties of the same subject.
 */
function collectRdfaProperties(
  element: HTMLElement,
  ctx: AdapterContext,
  depth: number,
  properties: ProductProperty[],
): void {
  for (const child of element.children) {
    if (properties.length >= MAX_ITEM_PROPERTIES) return
    if (ctx.budgetSpent()) return

    const name = propertyName(child.getAttribute('property'))
    const startsSubject = child.hasAttribute('typeof')

    if (name !== null && startsSubject) {
      if (depth < MAX_ITEM_DEPTH) {
        properties.push({ name, value: null, item: readRdfaItem(child, ctx, depth + 1) })
      }
      continue
    }

    if (name !== null) {
      const value = rdfaValue(child)
      if (value !== null) properties.push({ name, value, item: null })
    }

    if (startsSubject) continue
    collectRdfaProperties(child, ctx, depth, properties)
  }
}

/**
 * What one element's `property` is worth.
 *
 * `content` FIRST, BECAUSE IT EXISTS TO SAY SO. RDFa's `content` attribute is the publisher stating
 * the machine-readable value where the visible text is formatted for a person — `<span
 * property="price" content="1299.00">1,299</span>` — and preferring the text there would record the
 * rounded display value and call it the price.
 *
 * `resource` AFTERWARDS AND BEFORE THE TEXT, because it names a thing rather than describing one:
 * an element carrying `property="image" resource="…"` has said where the image is, and its text —
 * if it has any — is a caption.
 *
 * EVERYTHING ELSE IS `microdataValue`, which is the table saying that an `<img>` means its `src`
 * and a `<link>` means its `href`. Those answers do not change with the spelling.
 */
function rdfaValue(element: HTMLElement): string | null {
  for (const attribute of ['content', 'resource'] as const) {
    const value = (element.getAttribute(attribute) ?? '').trim()
    if (value !== '') return value
  }
  return microdataValue(element)
}
