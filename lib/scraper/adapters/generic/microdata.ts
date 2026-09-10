import type { HTMLElement } from 'node-html-parser'

import {
  MAX_IMAGE_URLS,
  MAX_LIST_ENTRIES,
  withField,
  type ProvenanceStrategy,
  type RawProductDraft,
} from '@/lib/scraper/adapters/draft-schema'
import type { AdapterContext } from '@/lib/scraper/adapters/types'

/**
 * Microdata — and, because microdata is the vocabulary written out in full, the vocabulary itself.
 *
 * THREE OF THE SIX STRATEGIES READ THE SAME VOCABULARY IN THREE SPELLINGS, AND ONLY THE SPELLING
 * DIFFERS. JSON-LD, microdata and RDFa are schema.org expressed as a JSON document, as attributes
 * on elements, and as attributes on elements again with a different set of attribute names. What
 * `name`, `sku`, `image` and `offers/price` MEAN is identical in all three; a page that publishes
 * two of them publishes the same product twice. So the meaning lives here, once — `ProductItem`,
 * `isProductType` and `applyProductItem` — and `jsonld.ts` and `rdfa.ts` translate their own
 * spelling into it rather than restating what a SKU is. Three copies of that field map would be two
 * chances for `priceCurrency` to be a currency under one strategy and nothing under another, and
 * the page that exposed the difference would be one nobody had a fixture for.
 *
 * IT LIVES IN THIS FILE RATHER THAN IN `index.ts` BECAUSE `index.ts` IMPORTS EVERY STRATEGY. A
 * shared home there would make each strategy import the module that imports it, and a cycle in a
 * register that a bundler evaluates for its side effects is a class of bug nobody wants to debug at
 * import time. Microdata is the spelling that needed no translation to express the model — an item
 * is an ordered list of named properties, some of which are items — so the model sits with it.
 *
 * A PROPERTY LIST RATHER THAN A MAP, AND THE ORDER IS THE REASON. A specification block lists
 * `width`, then `depth`, then `height`, and the order those lines appear in is how a merchandiser
 * reads them back; `core/content-hash.ts` will not sort arrays for exactly the same reason. A
 * `Map<string, string[]>` would keep the order within one property name and lose it between two,
 * so a page that interleaves `material` and `width` would come out re-grouped. Lookup is a scan of
 * a list that has tens of entries, which costs nothing next to parsing the page it came from.
 *
 * NAMES ARE LOWER-CASED AND STRIPPED OF THEIR PREFIX WHEN AN ITEM IS BUILT. The vocabulary is
 * case-sensitive in principle and case-mangled in practice: `priceCurrency`, `pricecurrency` and
 * `schema:priceCurrency` are one property to every consumer that matters, and normalising once at
 * the point an item is read is what lets the field map below be a list of plain lower-case names
 * instead of a list of spellings somebody has to keep adding to.
 *
 * NOTHING HERE PARSES, CONVERTS OR RESOLVES A VALUE. `1,299.00` is recorded as `1,299.00`,
 * `https://schema.org/InStock` is recorded as it was written, and a `width` of `120 cm` is recorded
 * as `120 cm` — see `draft-schema.ts` on why an adapter that turned any of those into a number or a
 * unit would put a second normaliser in the system, and the second one is the one nobody re-runs.
 * The single exception is an image REFERENCE, which is resolved against the page's own URL by a
 * function `index.ts` supplies: see `applyProductItem`.
 */

/**
 * What counts as a product, as a closed list.
 *
 * NOT "ANY TYPE ENDING IN `Product`", WHICH WOULD ADMIT A VOCABULARY NOBODY HAS READ. These five
 * are schema.org's `Product` and the four types it declares as subtypes of it, so each one is a
 * page saying "this is a thing you could buy". A suffix test would also match a bespoke
 * `…/RelatedProduct` or `…/ProductEnquiry` invented by whoever wrote the page, and the adapter
 * would then read a fragment that was never a product as though it were one — which is a wrong
 * value with full confidence behind it, the one outcome provenance cannot rescue.
 */
const PRODUCT_TYPE_NAMES: ReadonlySet<string> = new Set([
  'product',
  'productmodel',
  'productgroup',
  'individualproduct',
  'someproducts',
])

/** Properties whose value is a material, and whose nested item is one by name. */
const MATERIAL_PROPERTIES: ReadonlySet<string> = new Set(['material'])

/** Properties whose value is a category label. */
const CATEGORY_PROPERTIES: ReadonlySet<string> = new Set(['category'])

/**
 * Properties whose value is a dimension AS THE PAGE PRINTED IT.
 *
 * A NESTED `QuantitativeValue` IS DELIBERATELY NOT READ. Its shape is a number beside a unit code
 * — `{ value: 1200, unitCode: 'MMT' }` — and turning that pair into `1200 mm` is a decision about
 * what `MMT` means. That decision belongs to Phase 28, made once, over stored evidence, where
 * correcting it re-runs everything; made here it would be made fifteen times a page and frozen into
 * rows that no later fix reaches. So only a string the page itself published is recorded.
 */
const DIMENSION_PROPERTIES: ReadonlySet<string> = new Set(['width', 'depth', 'height', 'size'])

/** Property names an image can hide behind once it is an item rather than a string. */
const IMAGE_ITEM_PROPERTIES = ['url', 'contenturl'] as const

/**
 * How deep a nested item is followed, and how many properties one item may carry.
 *
 * BOUNDS RATHER THAN HOPES, BECAUSE THE INPUT IS A THIRD PARTY'S PAGE (D1). A document that nests
 * itemscopes two hundred deep, or an item with fifty thousand properties, is not a product page —
 * it is either a generated catalogue dump or somebody aiming a payload at Rivya's cron function.
 * `AdapterContext.budgetSpent()` is the other half of the answer and is checked in every walk here;
 * these two are what hold when the budget has not yet been spent.
 */
const MAX_ITEM_DEPTH = 6
const MAX_ITEM_PROPERTIES = 300

/** One named thing an item says: a literal, or another item. Never both. */
export interface ProductProperty {
  /** Lower-cased local name — `priceCurrency` and `schema:priceCurrency` arrive as `pricecurrency`. */
  readonly name: string
  readonly value: string | null
  readonly item: ProductItem | null
}

/** An item is its properties, in the order the page gave them. */
export type ProductItem = readonly ProductProperty[]

/**
 * Whether one `itemtype`, `typeof` or `@type` token names a product.
 *
 * THE LOCAL NAME IS WHAT IS COMPARED, so `https://schema.org/Product`, `http://schema.org/Product`,
 * `schema:Product` and a bare `Product` are one answer. Comparing whole IRIs would make an adapter
 * that works on a page served over https stop working on the same page served over http, which is
 * a difference in a URL scheme deciding whether a product exists.
 */
export function isProductType(token: string): boolean {
  return PRODUCT_TYPE_NAMES.has(localName(token))
}

/**
 * A vocabulary term reduced to the name this module matches on.
 *
 * SHARED WITH `jsonld.ts` AND `rdfa.ts` for the reason the whole vocabulary is shared: a key is
 * `sku` in one spelling, `schema:sku` in another and `https://schema.org/sku` in a third, and three
 * modules each deciding what to strip is three chances to disagree about one property.
 */
export function localName(token: string): string {
  const trimmed = token.trim().replace(/[#/]+$/, '')
  const segments = trimmed.split(/[#/:]/)
  return (segments[segments.length - 1] ?? '').toLowerCase()
}

/**
 * An element's visible text, with runs of whitespace collapsed.
 *
 * COLLAPSED RATHER THAN PRESERVED, BECAUSE THE ALTERNATIVE IS A HASH THAT MOVES. Markup indents,
 * and a template that re-indents on a deploy would otherwise change every dimension line on every
 * product of a source at once — `core/content-hash.ts` would write a version for each, and Phase 29
 * would report a catalogue as having changed on the day nothing did. What is lost is the difference
 * between one space and three, which no reader of a specification line has ever needed.
 */
export function elementText(element: HTMLElement): string {
  return element.text.replace(/\s+/g, ' ').trim()
}

/**
 * Write one item's properties into a draft under one strategy's name. FIRST HIT WINS.
 *
 * THE ORDER OF THE CALLS BELOW IS NOT THE STRATEGY ORDER — `withField` holds that, and it holds it
 * across strategies rather than within one. Every call here is the same strategy, so a field this
 * item cannot fill is simply left for the next spelling, and a field an earlier spelling already
 * filled is left exactly as it was. That is why this function can be handed a JSON-LD item, then a
 * microdata item, then an RDFa item, in that order, with no bookkeeping of its own.
 *
 * `imageReference` IS THE ONE THING THAT COMES FROM OUTSIDE, and it is a function rather than a
 * base URL so that this module cannot decide what a reference means. `index.ts` binds it to the
 * page's FINAL url — the one after redirects, which is what every relative href on the page
 * actually resolves against — and it answers `null` for anything that is not http(s), which is how
 * a `data:` lazy-loading spacer is dropped without costing the gallery it was hiding in.
 */
export function applyProductItem(
  draft: RawProductDraft,
  item: ProductItem,
  strategy: ProvenanceStrategy,
  imageReference: (reference: string) => string | null,
): RawProductDraft {
  let next = draft

  next = withField(next, 'title', firstValue(item, 'name'), strategy)
  next = withField(next, 'descriptionHtml', firstValue(item, 'description'), strategy)
  next = withField(next, 'skuText', firstValue(item, 'sku'), strategy)
  // `productID` is the source's own identifier and a SKU is the same claim written by the warehouse
  // rather than by the catalogue, so the SKU stands in when there is no `productID`. Nothing here
  // derives an identifier — a page that prints neither leaves `externalId` at confidence 0, which
  // is the honest answer and the one Phase 28's deduplication needs to see.
  next = withField(
    next,
    'externalId',
    firstValue(item, 'productid') ?? firstValue(item, 'sku'),
    strategy,
  )
  // Stored AS THE PAGE WROTE IT, relative or absolute. `draft-schema.ts` is explicit that
  // `canonicalUrl` is the claim, unresolved: reconciling it with the URL the bytes came from is a
  // decision about identity, and identity decisions are Phase 28's.
  next = withField(next, 'canonicalUrl', firstValue(item, 'url'), strategy)
  next = withField(next, 'imageUrls', readImages(item, imageReference), strategy)
  next = withField(next, 'materialTexts', readLabels(item, MATERIAL_PROPERTIES), strategy)
  next = withField(next, 'categoryLabels', readLabels(item, CATEGORY_PROPERTIES), strategy)
  next = withField(next, 'dimensionTexts', readLiterals(item, DIMENSION_PROPERTIES), strategy)

  const offer = chooseOffer(item)
  next = withField(
    next,
    'priceText',
    firstValue(offer, 'price') ?? firstValue(offer, 'lowprice'),
    strategy,
  )
  next = withField(next, 'currencyText', firstValue(offer, 'pricecurrency'), strategy)
  next = withField(next, 'availabilityText', firstValue(offer, 'availability'), strategy)

  return next
}

/**
 * The microdata spelling: the first `itemtype` naming a product, read as an item.
 *
 * THE FIRST PRODUCT ON THE PAGE, NOT A MERGE OF ALL OF THEM. A product page that also carries a
 * "customers also viewed" strip publishes several products, and taking the price from one and the
 * name from another would assemble a product that does not exist anywhere — with full confidence
 * and a provenance trail that looks impeccable. One item, whole, is a reading somebody can check
 * against the page.
 */
export function readMicrodataProduct(root: HTMLElement, ctx: AdapterContext): ProductItem | null {
  let scopes: readonly HTMLElement[]
  try {
    scopes = root.querySelectorAll('[itemtype]')
  } catch {
    // A selector this module wrote itself cannot be malformed, but the parser's matcher throws
    // rather than returning nothing, and an exception here would cost the whole item. See the
    // header on `extract()` in `index.ts`.
    return null
  }

  for (const scope of scopes) {
    if (ctx.budgetSpent()) return null
    const itemType = scope.getAttribute('itemtype') ?? ''
    if (!itemType.split(/\s+/).some(isProductType)) continue
    return readMicrodataItem(scope, ctx, 0)
  }

  return null
}

/** The microdata strategy, whole: read the page's first product item and write what it says. */
export function applyMicrodata(
  draft: RawProductDraft,
  root: HTMLElement,
  ctx: AdapterContext,
  imageReference: (reference: string) => string | null,
): RawProductDraft {
  const item = readMicrodataProduct(root, ctx)
  if (item === null) return draft
  return applyProductItem(draft, item, 'microdata', imageReference)
}

/**
 * The offer a price is read from: the first one that has a price, else the first one at all.
 *
 * "THE FIRST WITH A PRICE" IS THE REQUIREMENT'S OWN RULE, and the fallback after it is what keeps
 * the other two fields honest. A page that lists a sold-out variant first and an available one
 * second would otherwise report the sold-out offer's availability beside the second offer's price —
 * two true statements assembled into a false one. Falling back to the first offer only when NO
 * offer has a price means availability and currency come from the same offer the price did,
 * whenever there is a price at all.
 *
 * AN ITEM WITH NO OFFERS ANSWERS WITH ITSELF, so a page that puts `price` directly on the product
 * — which plenty do, correctly or otherwise — is still read.
 */
function chooseOffer(item: ProductItem): ProductItem {
  const offers: ProductItem[] = []
  for (const property of item) {
    if (property.name !== 'offers' || property.item === null) continue
    offers.push(property.item)
  }
  if (offers.length === 0) return item

  for (const offer of offers) {
    if (firstValue(offer, 'price') !== null || firstValue(offer, 'lowprice') !== null) return offer
  }
  return offers[0] ?? item
}

/** The first literal a property carries, or `null` when it carries none. */
function firstValue(item: ProductItem, name: string): string | null {
  for (const property of item) {
    if (property.name !== name) continue
    if (property.value !== null) return property.value
  }
  return null
}

/** Every literal for a set of property names, in the page's own order. */
function readLiterals(item: ProductItem, names: ReadonlySet<string>): readonly string[] {
  const values: string[] = []
  for (const property of item) {
    if (values.length >= MAX_LIST_ENTRIES) break
    if (!names.has(property.name) || property.value === null) continue
    values.push(property.value)
  }
  return values
}

/**
 * Every literal for a set of property names, plus the `name` of any nested item under them.
 *
 * A MATERIAL IS OFTEN AN ITEM RATHER THAN A STRING — `material` pointing at a `Product` whose
 * `name` is `Ash` is how the vocabulary says it properly — and reading only the literal would drop
 * the correctly marked-up half of the web. Only `name` is followed: a nested item's other
 * properties describe the material, and flattening them into the list would put a description
 * where a merchandiser expects a word.
 */
function readLabels(item: ProductItem, names: ReadonlySet<string>): readonly string[] {
  const values: string[] = []
  for (const property of item) {
    if (values.length >= MAX_LIST_ENTRIES) break
    if (!names.has(property.name)) continue
    if (property.value !== null) {
      values.push(property.value)
      continue
    }
    const nested = property.item === null ? null : firstValue(property.item, 'name')
    if (nested !== null) values.push(nested)
  }
  return values
}

/** Every image reference an item declares, resolved and filtered, in the page's own order. */
function readImages(
  item: ProductItem,
  imageReference: (reference: string) => string | null,
): readonly string[] {
  const references: string[] = []
  for (const property of item) {
    if (references.length >= MAX_IMAGE_URLS) break
    if (property.name !== 'image') continue

    const raw = property.value ?? nestedImageReference(property.item)
    if (raw === null) continue
    const resolved = imageReference(raw)
    if (resolved !== null) references.push(resolved)
  }
  return references
}

/** An `ImageObject` says where it is in `url` or `contentUrl`. Anything else is not a reference. */
function nestedImageReference(item: ProductItem | null): string | null {
  if (item === null) return null
  for (const name of IMAGE_ITEM_PROPERTIES) {
    const value = firstValue(item, name)
    if (value !== null) return value
  }
  return null
}

/**
 * Read one microdata item: every `itemprop` beneath this element that is not inside a nested scope.
 *
 * AN `itemprop` INSIDE A NESTED `itemscope` BELONGS TO THAT NESTED ITEM, which is the whole of the
 * microdata data model and the only part of it easy to get wrong. Reading descendants flat would
 * pull an offer's `price` up onto the product — harmless — and an "also bought" product's `name`
 * up onto it too, which is not. So a child carrying `itemscope` becomes a nested item and the walk
 * does not continue through it; a child carrying `itemprop` WITHOUT `itemscope` is a literal, and
 * the walk continues through it, because a wrapper marked as a property may still contain
 * properties of the same item.
 */
function readMicrodataItem(element: HTMLElement, ctx: AdapterContext, depth: number): ProductItem {
  const properties: ProductProperty[] = []
  collectMicrodataProperties(element, ctx, depth, properties)
  return properties
}

function collectMicrodataProperties(
  element: HTMLElement,
  ctx: AdapterContext,
  depth: number,
  properties: ProductProperty[],
): void {
  for (const child of element.children) {
    if (properties.length >= MAX_ITEM_PROPERTIES) return
    // CHECKED PER ELEMENT, NOT PER ITEM. `types.ts` is explicit that nothing pre-empts a
    // synchronous loop: the budget is only a bound if the loop that could run away is the loop
    // that asks.
    if (ctx.budgetSpent()) return

    const name = propertyName(child.getAttribute('itemprop'))
    const isScope = child.hasAttribute('itemscope')

    if (name !== null && isScope) {
      const item = depth >= MAX_ITEM_DEPTH ? null : readMicrodataItem(child, ctx, depth + 1)
      if (item !== null) properties.push({ name, value: null, item })
      continue
    }

    if (name !== null) {
      const value = microdataValue(child)
      if (value !== null) properties.push({ name, value, item: null })
    }

    // A nested scope with no `itemprop` names nothing on this item, and its contents are not this
    // item's either — so it is skipped whole rather than walked into.
    if (isScope) continue
    collectMicrodataProperties(child, ctx, depth, properties)
  }
}

/**
 * The first token of an `itemprop`/`property` attribute, as a name, or `null` when there is none.
 *
 * ONE TOKEN OUT OF SEVERAL, BECAUSE BOTH SPELLINGS ALLOW A LIST. `itemprop="name headline"` says
 * the element is both, and recording it twice would put the same string in two fields with two
 * provenance entries; taking the first is what the page led with. Exported so `rdfa.ts` reads
 * `property="schema:name"` by the same rule rather than a similar one.
 */
export function propertyName(attribute: string | undefined): string | null {
  if (attribute === undefined) return null
  const first = attribute.trim().split(/\s+/)[0] ?? ''
  if (first === '') return null
  const name = localName(first)
  return name === '' ? null : name
}

/**
 * Where a value lives when the element carrying the property has no text to speak of.
 *
 * THIS TABLE IS THE MICRODATA SPECIFICATION'S, NOT A GUESS, and it is what makes
 * `<meta itemprop="price" content="1299.00">` readable at all — a meta element has no text, so an
 * adapter reading `textContent` everywhere would find a price on every page that publishes one
 * badly and nothing on every page that publishes one properly. `time` prefers `datetime` and falls
 * back to its text for the same reason in reverse: a lead time written as `<time>6–8 weeks</time>`
 * is still a lead time.
 */
const VALUE_ATTRIBUTE_BY_TAG: ReadonlyMap<string, string> = new Map([
  ['meta', 'content'],
  ['audio', 'src'],
  ['embed', 'src'],
  ['iframe', 'src'],
  ['img', 'src'],
  ['source', 'src'],
  ['track', 'src'],
  ['video', 'src'],
  ['a', 'href'],
  ['area', 'href'],
  ['link', 'href'],
  ['object', 'data'],
  ['data', 'value'],
  ['meter', 'value'],
  ['time', 'datetime'],
])

/**
 * What one element's property is worth: the attribute its kind carries a value in, else its text.
 *
 * EXPORTED FOR `rdfa.ts`, WHICH DIFFERS ONLY IN THE TWO ATTRIBUTES IT CHECKS FIRST. RDFa spells a
 * literal `content` and a reference `resource`; once neither is present, the question "what does
 * an `<img>` carrying a property mean" has exactly one answer and it is this one.
 */
export function microdataValue(element: HTMLElement): string | null {
  const attributeName = VALUE_ATTRIBUTE_BY_TAG.get(element.rawTagName.toLowerCase())
  const attribute = attributeName === undefined ? undefined : element.getAttribute(attributeName)

  const value = (attribute ?? elementText(element)).trim()
  return value === '' ? null : value
}
