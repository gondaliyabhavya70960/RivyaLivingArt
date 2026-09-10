import type { HTMLElement } from 'node-html-parser'

import type { RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import {
  applyProductItem,
  isProductType,
  localName,
  type ProductItem,
  type ProductProperty,
} from '@/lib/scraper/adapters/generic/microdata'
import type { AdapterContext } from '@/lib/scraper/adapters/types'

/**
 * JSON-LD — the first strategy, and the only one whose input is not markup.
 *
 * IT IS FIRST BECAUSE IT IS THE ONLY ONE THE PUBLISHER WROTE ON PURPOSE. A `<script
 * type="application/ld+json">` block exists to be read by a machine: nobody indents it for a
 * designer, nothing re-flows it when the template changes, and the values in it are the ones the
 * publisher wants a search engine to repeat. Everything after it in the strategy order is a reading
 * of something written for a person — which is why first-hit-wins runs in this direction and not
 * the other.
 *
 * ONE MALFORMED SCRIPT TAG MUST NOT COST THE OTHERS, AND THAT IS THE REQUIREMENT THIS FILE EXISTS
 * TO MEET. Pages routinely carry three or four of these blocks — a WebSite, a BreadcrumbList, an
 * Organization and the Product — emitted by different plugins, and a trailing comma in any one of
 * them is not evidence about the others. `JSON.parse` throws on the first bad byte, so each block
 * is parsed inside its own try/catch and a failure is a `warn` with a COUNT and nothing else: the
 * content is a third party's, and `types.ts` is explicit that a fragment of somebody's page must
 * never reach Rivya's logs.
 *
 * THE SHAPES ARE ALL OF THEM, DELIBERATELY. `@graph`, a top-level array, a `@type` given as an
 * array, `offers` as an object or an array — none of those is exotic; between them they are most of
 * what real pages emit, and an adapter that read only the textbook shape would report "no product
 * found" on pages that publish one perfectly well. So the walk is shape-agnostic: every object
 * reachable in a bounded traversal is a candidate, and a candidate whose `@type` names a product is
 * the product.
 *
 * IT CONVERTS RATHER THAN INTERPRETS. A JSON object becomes a `ProductItem` — the vocabulary model
 * in `microdata.ts` — and the field map lives there, once, for all three spellings. What this file
 * decides is only what JSON means: which keys are metadata (`@`-prefixed), what an array of values
 * is (several properties of one name, in order), and what a nested object is (a nested item).
 *
 * A JSON NUMBER IS RECORDED WITH `String()` AND IS NEVER PARSED. `"price": 1299` is a price of
 * `1299`, and `"price": 1299.00` reaches this code as `1299` because JSON said so — the publisher's
 * own encoding, not a rounding this adapter performed. Nothing here reads a number back out: the
 * draft is strings (`draft-schema.ts`), and Phase 28 parses them once, over stored evidence.
 */

/**
 * How many script blocks are read, how deep the walk goes, and how many nodes it may visit.
 *
 * BOUNDS ON A THIRD PARTY'S DOCUMENT (D1). A page with four hundred JSON-LD blocks, or one whose
 * `@graph` nests thirty deep, is not a product page; `AdapterContext.budgetSpent()` catches the
 * pathological case that is also slow, and these catch the pathological case that is merely large.
 */
const MAX_SCRIPTS = 25
const MAX_WALK_DEPTH = 12
const MAX_WALK_NODES = 400
const MAX_ITEM_DEPTH = 6
const MAX_ITEM_PROPERTIES = 300

/** A parsed JSON-LD block. `unknown`, because a third party wrote it and nothing has checked it. */
type JsonValue = unknown

type JsonObject = Readonly<Record<string, unknown>>

/**
 * Every JSON-LD block on the page that parsed, in document order.
 *
 * READ ONCE AND HANDED ROUND. `index.ts` passes the result to this module's `applyJsonLd` and to
 * `selectors.ts`, whose `JSONLD_PATH` extraction strategy reads the same documents. Parsing them
 * twice would double the cost of the largest input on the page for no second opinion — the second
 * parse cannot disagree with the first.
 *
 * THE TYPE ATTRIBUTE IS MATCHED BY PREFIX because `application/ld+json; charset=utf-8` is a media
 * type with a parameter, not a different media type, and a page that writes it that way is not
 * publishing something else.
 */
export function readJsonLdDocuments(root: HTMLElement, ctx: AdapterContext): readonly JsonValue[] {
  let scripts: readonly HTMLElement[]
  try {
    scripts = root.querySelectorAll('script')
  } catch {
    return []
  }

  const documents: JsonValue[] = []
  let malformed = 0

  for (const script of scripts) {
    if (documents.length >= MAX_SCRIPTS) break
    if (ctx.budgetSpent()) break

    const type = (script.getAttribute('type') ?? '').trim().toLowerCase()
    if (!type.startsWith('application/ld+json')) continue

    const body = script.rawText.trim()
    if (body === '') continue

    try {
      documents.push(JSON.parse(body))
    } catch {
      // NO CONTENT IN THE LOG LINE, AND NO `error` LEVEL. The text is a third party's, and
      // `AdapterLogger` has two levels on purpose: a page that emits one broken block is ordinary,
      // and an adapter that shouted about it would fill a cron invocation's log with the most
      // common thing there is.
      malformed += 1
    }
  }

  if (malformed > 0) {
    ctx.logger.warn('json-ld blocks could not be parsed and were skipped', {
      malformed,
      parsed: documents.length,
    })
  }

  return documents
}

/**
 * Write the page's first JSON-LD product into a draft.
 *
 * THE FIRST PRODUCT, NOT A MERGE. `readMicrodataProduct` records the argument at length and it is
 * the same one here: a page carrying a "related items" graph publishes several products, and taking
 * a name from one and a price from another assembles a product that exists nowhere, with full
 * confidence behind every field.
 */
export function applyJsonLd(
  draft: RawProductDraft,
  documents: readonly JsonValue[],
  ctx: AdapterContext,
  imageReference: (reference: string) => string | null,
): RawProductDraft {
  const products = productNodes(documents, ctx)
  const first = products[0]
  if (first === undefined) return draft

  if (products.length > 1) {
    ctx.logger.debug('several json-ld product nodes; the first was used', {
      nodes: products.length,
    })
  }

  return applyProductItem(draft, toProductItem(first, 0), 'jsonld', imageReference)
}

/**
 * Read one configured `JSONLD_PATH` — FEAT §26 field 13's other locator — out of the documents.
 *
 * PRODUCT NODES ARE TRIED BEFORE ANYTHING ELSE, and the order is what makes a short path safe. An
 * operator writes `offers.price`, or plainly `name`, thinking of the product; a page whose
 * BreadcrumbList also has a `name` would otherwise answer first and the configuration would look
 * as though it worked. Falling back to every other node afterwards keeps a source whose price
 * genuinely lives outside the Product node reachable, which is the case the setting exists for.
 *
 * THE PATH GRAMMAR IS DOTS AND INDICES, AND NOTHING ELSE. `offers.price`, `offers.0.price`. There
 * is no wildcard, no filter and no expression language, because every one of those is a small
 * interpreter reading a third party's document, and `SELECTOR_MAX_LENGTH` is the only bound anybody
 * has agreed to. A segment that is not a key is a path that does not resolve, which is a field at
 * confidence 0 — visible in the run drawer, and fixable in the drawer the operator typed it in.
 */
export function resolveJsonLdPath(
  documents: readonly JsonValue[],
  path: string,
  ctx: AdapterContext,
): string | null {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
  if (segments.length === 0) return null

  const nodes = candidateNodes(documents, ctx)
  for (const node of nodes) {
    const value = walkPath(node, segments)
    if (value !== null) return value
  }
  return null
}

/** Product nodes first, then every other node, both in walk order. See `resolveJsonLdPath`. */
function candidateNodes(
  documents: readonly JsonValue[],
  ctx: AdapterContext,
): readonly JsonObject[] {
  const nodes = flattenNodes(documents, ctx)
  const products = nodes.filter((node) => isProductNode(node))
  const rest = nodes.filter((node) => !isProductNode(node))
  return [...products, ...rest]
}

/** Every product node the documents contain, in walk order. */
function productNodes(documents: readonly JsonValue[], ctx: AdapterContext): readonly JsonObject[] {
  return flattenNodes(documents, ctx).filter((node) => isProductNode(node))
}

/**
 * Every object reachable from the documents, breadth of shape and depth both bounded.
 *
 * ONE WALK RATHER THAN A LIST OF KNOWN SHAPES. `@graph` needs no special case here: it is a key
 * whose value is an array, and an array is walked. Neither does a top-level array, an `itemListElement`,
 * a `mainEntity`, or whatever the next content-management plugin invents to wrap a product in.
 */
function flattenNodes(documents: readonly JsonValue[], ctx: AdapterContext): readonly JsonObject[] {
  const nodes: JsonObject[] = []

  const visit = (value: JsonValue, depth: number): void => {
    if (nodes.length >= MAX_WALK_NODES || depth > MAX_WALK_DEPTH) return
    if (ctx.budgetSpent()) return

    if (isJsonArray(value)) {
      for (const entry of value) visit(entry, depth + 1)
      return
    }
    if (!isJsonObject(value)) return

    nodes.push(value)
    for (const entry of Object.values(value)) visit(entry, depth + 1)
  }

  for (const document of documents) visit(document, 0)
  return nodes
}

/** Whether a node's `@type` — a string, or an array of them — names a product. */
function isProductNode(node: JsonObject): boolean {
  const declared = node['@type']
  if (typeof declared === 'string') return isProductType(declared)
  if (!isJsonArray(declared)) return false
  return declared.some((entry) => typeof entry === 'string' && isProductType(entry))
}

/**
 * A JSON object as a vocabulary item: `@`-keys dropped, arrays flattened in order, objects nested.
 *
 * `@`-PREFIXED KEYS ARE JSON-LD'S OWN BOOKKEEPING, not the vocabulary's. `@type` has already been
 * read to decide this is a product, `@context` names the vocabulary rather than saying anything in
 * it, and `@id` is an identifier for the NODE rather than for the thing — reading it as the
 * product's `productID` would put a document-internal anchor like `#product` into a column Phase 28
 * deduplicates on.
 */
function toProductItem(node: JsonObject, depth: number): ProductItem {
  const properties: ProductProperty[] = []

  for (const [key, value] of Object.entries(node)) {
    if (properties.length >= MAX_ITEM_PROPERTIES) break
    if (key.startsWith('@')) continue

    const name = localName(key)
    if (name === '') continue

    addProperty(properties, name, value, depth)
  }

  return properties
}

/** One key's worth of properties: a literal, several literals, or a nested item — in order. */
function addProperty(
  properties: ProductProperty[],
  name: string,
  value: JsonValue,
  depth: number,
): void {
  if (properties.length >= MAX_ITEM_PROPERTIES) return

  if (isJsonArray(value)) {
    // AN ARRAY IS SEVERAL PROPERTIES OF ONE NAME, NOT ONE PROPERTY WITH SEVERAL VALUES. That is
    // what makes `"image": [a, b]` and two `<img itemprop="image">` elements the same reading, and
    // it is why the model is a list rather than a map.
    for (const entry of value) addProperty(properties, name, entry, depth)
    return
  }

  if (isJsonObject(value)) {
    if (depth >= MAX_ITEM_DEPTH) return
    properties.push({ name, value: null, item: toProductItem(value, depth + 1) })
    return
  }

  const literal = toLiteral(value)
  if (literal !== null) properties.push({ name, value: literal, item: null })
}

/**
 * A JSON scalar as the string the page published, or `null` for anything that is not one.
 *
 * A NON-FINITE NUMBER IS NOT A VALUE. `JSON.parse` cannot produce `NaN` or an infinity, but a
 * document reaching this module from `scripts/research/reextract.ts` has been through a jsonb
 * column and back, and `String(NaN)` is the string `"NaN"` — a price of `NaN` in a comparison table
 * is worse than no price at all, because it is a value somebody has to disprove.
 */
function toLiteral(value: JsonValue): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  if (typeof value === 'boolean') return String(value)
  return null
}

/** Walk `offers.0.price` from one node. `null` unless the whole path lands on a scalar. */
function walkPath(node: JsonObject, segments: readonly string[]): string | null {
  let current: JsonValue = node

  for (const segment of segments) {
    if (isJsonArray(current)) {
      const index = Number.parseInt(segment, 10)
      if (Number.isInteger(index) && String(index) === segment) {
        current = current[index]
        continue
      }
      // A path written against a single offer, applied to a page that publishes several: the first
      // entry is the one the page led with, and it is the same entry `chooseOffer` would reach for
      // when it cannot see a price.
      current = current[0]
    }
    if (!isJsonObject(current)) return null
    current = current[segment]
  }

  if (isJsonArray(current)) current = current[0]
  return toLiteral(current)
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `Array.isArray` NARROWS `unknown` TO `any[]`, WHICH IS THE ONE THING THIS FILE MAY NOT HAVE.
 * Every value here came out of a third party's document; an `any` would let the next line index it,
 * call it or pass it anywhere at all with nothing objecting. The guard says the same thing and
 * keeps each element `unknown`, so reading one still costs a check.
 */
function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value)
}
