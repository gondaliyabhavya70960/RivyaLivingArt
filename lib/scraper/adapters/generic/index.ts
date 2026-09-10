import type { HTMLElement } from 'node-html-parser'

import {
  emptyDraft,
  rawProductDraftSchema,
  withField,
  type RawProductDraft,
} from '@/lib/scraper/adapters/draft-schema'
import { applyJsonLd, readJsonLdDocuments } from '@/lib/scraper/adapters/generic/jsonld'
import { applyMicrodata, elementText } from '@/lib/scraper/adapters/generic/microdata'
import { applyOpenGraph } from '@/lib/scraper/adapters/generic/opengraph'
import { applyRdfa } from '@/lib/scraper/adapters/generic/rdfa'
import { applyConfiguredSelectors } from '@/lib/scraper/adapters/generic/selectors'
import { GENERIC_ADAPTER_KEY, type AdapterSourceView } from '@/lib/scraper/adapters/registry'
import type {
  AdapterContext,
  DiscoveredUrl,
  FetchedPage,
  SourceAdapter,
} from '@/lib/scraper/adapters/types'
import { readRawItem } from '@/lib/scraper/core/raw'
import { parseDocument } from '../parse'

/**
 * The `generic` adapter: a useful reading of any site that publishes structured product data, and a
 * low-confidence one of any site that does not.
 *
 * SIX STRATEGIES, FIRST HIT WINS PER FIELD, AND THE ORDER IS AN ARGUMENT RATHER THAN A PREFERENCE.
 * FEAT §27 fixes it — JSON-LD, microdata, RDFa, OpenGraph, the source's configured selectors,
 * `<title>` and `<h1>` — and each step down it is a step further from something the publisher wrote
 * for a machine towards something somebody typed while looking at one page on one day. The first
 * three are the same vocabulary in three spellings and are read through one field map
 * (`microdata.ts`); the fourth describes a share card; the fifth is Rivya's own configuration; the
 * sixth is a page's headline, which is a product name on a product page and the name of a
 * catalogue on every other page there is.
 *
 * `withField` HOLDS THE FIRST-HIT RULE, WHICH IS WHY `extract()` READS AS A LIST. Each strategy
 * writes what it found; a field already at confidence 1 is left exactly as it was. There is no
 * bookkeeping in this file about which fields are still open, because a rule written down in seven
 * places is a rule that is wrong in the seventh — see the note on `withField` in `draft-schema.ts`.
 *
 * `extract()` NEVER THROWS, AND THE ISOLATION BOUNDARY IS NOT THE REASON IT NEVER THROWS.
 * `core/run-adapter.ts` catches an exception and marks the item `FAILED`, so a throw here would
 * cost one item rather than the run — but an item marked `FAILED` says "this adapter is broken",
 * and a draft with low confidence says "this adapter's rules did not fit this page". Those are
 * different findings and a merchandiser acts on them differently. Collapsing them would make a
 * redesigned catalogue indistinguishable from a bug in a fortnight's run history. So a malformed
 * page, a page of binary and an empty string each produce a draft, each strategy is wrapped so that
 * one strategy's bug costs only its own fields, and the boundary further out stays what it is: the
 * thing that catches what nobody predicted.
 *
 * IT IS PURE, AND EVERYTHING THAT MAKES IT PURE IS AN ABSENCE `types.ts` ARGUES FOR AT LENGTH. No
 * `fetch`, no database handle, no file system, no Cloudinary client, no clock. This module reads
 * bytes it was handed and returns a value; the same call produces the same draft against a live
 * fetch and against a snapshot replayed by `scripts/research/reextract.ts`, which is what makes
 * that script's promise of zero network traffic checkable rather than hopeful.
 *
 * NO EXTERNAL HOST APPEARS ANYWHERE UNDER `lib/scraper/adapters/**` (D10), and
 * `scripts/research/check-research-isolation.mjs` fails the build on one. A real source is a row in
 * `research_sources` that somebody approved after a policy review — never a literal in a build
 * artefact, and never a fixture.
 */

/**
 * THE VERSION OF RECORD. `registry.ts`'s generic DESCRIPTOR mirrors this string by hand and says so.
 *
 * IT IS COPIED RATHER THAN IMPORTED BECAUSE THE DIRECTION OF THE IMPORT IS THE WHOLE POINT OF THE
 * SPLIT. `registry.ts` is read by `components/studio/research/SourceForm.tsx`, a Client Component;
 * importing this module from there would drag `node-html-parser` and every strategy in this folder
 * into the Studio bundle in order to render four strings. So the descriptor holds a literal, this
 * file holds the literal it must equal, and `tests/unit/adapter-contract.test.ts` walks both
 * registers and fails when they disagree — which is a test that costs nothing and a build-time
 * coupling that would cost a bundle.
 *
 * 2.0.0 IS A MAJOR BUMP, AND THE MAJOR IS THE HONEST ONE. Phase 25's `generic` produced a raw item
 * — a title, a canonical URL and a list of links. This produces a `RawProductDraft` with fifteen
 * fields, a confidence map and a provenance map. `adapter_version` is written onto every
 * `research_raw_items` and `research_product_versions` row so that a value which later looks wrong
 * can be traced to the rules that read it; a reader of a `1.x` row and a reader of a `2.x` row are
 * not reading the same shape, and a minor bump would say they were.
 */
export const GENERIC_ADAPTER_VERSION = '2.0.0'

/**
 * How many bytes of a page this adapter will parse.
 *
 * `core/fetch.ts` STOPS AT 2 MB AND THIS IS THE SECOND HALF OF THAT BOUND, not a restatement of it.
 * A replay from `scripts/research/reextract.ts` hands over a snapshot rather than a live response,
 * and a snapshot stored before that cap existed is still a file this code will be pointed at one
 * day. Truncating is better than refusing: the head of a document carries the `<head>`, which is
 * where JSON-LD, OpenGraph and the canonical link all live, so a truncated page still yields a
 * useful draft with a `warn` beside it saying why it might be thin.
 */
const MAX_BODY_LENGTH = 2_000_000

/**
 * The adapter, as `core/run-adapter.ts` and the Studio picker's descriptor both describe it.
 *
 * `DISCOVER` AND `EXTRACT`, AND NO `PAGINATE`. Following a next-page link is a claim about knowing
 * which link that is, and the generic adapter does not: `AdapterContext.matchUrl` already answers
 * `PAGINATION` for a URL the source's own patterns say is one, and the core queues it. Declaring
 * the capability would advertise a behaviour that does not exist beyond what discovery already does
 * — the mistake `registry.ts`'s header spends a paragraph on, in the other direction.
 */
export const genericAdapter: SourceAdapter = {
  key: GENERIC_ADAPTER_KEY,
  version: GENERIC_ADAPTER_VERSION,
  capabilities: ['DISCOVER', 'EXTRACT'],
  supports,
  discover,
  extract,
}

/**
 * Any http(s) source. FEAT §26's "generic is always available", written as a predicate.
 *
 * THE SAME ANSWER AS THE DESCRIPTOR'S `supports()` IN `registry.ts`, WHICH HOLDS ITS OWN COPY. The
 * two must agree — a picker that offered this adapter for a source it then refused at run time
 * would be worse than either answer alone — and they cannot share an implementation for the bundle
 * reason above. `tests/unit/adapter-contract.test.ts` is where the agreement is checked.
 *
 * A NON-http SCHEME IS STILL REFUSED. `ftp:` or `mailto:` is not a website this pipeline could read
 * under any adapter, and answering "supported" would leave the override tick as the only thing
 * between that string and a queue of jobs that cannot run.
 *
 * PURE, AND CALLED ON EVERY KEYSTROKE. The create drawer asks about a base URL somebody is halfway
 * through typing, so an unparseable URL is `false` and never a throw.
 */
function supports(source: AdapterSourceView): boolean {
  try {
    const { protocol } = new URL(source.baseUrl)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Every same-host http(s) link on the page, fragment stripped, tagged with what the source's
 * patterns make of it.
 *
 * IT IS `core/raw.ts`'s READER RATHER THAN A SECOND ONE. `readRawItem` already resolves relative
 * hrefs against the page's final URL, drops `mailto:`, `javascript:`, `tel:` and `data:`, drops
 * off-host links — a discovery run follows one site, and following an outbound link is how a
 * crawler ends up somewhere nobody approved — strips fragments so `/p/1` and `/p/1#spec` are one
 * work item, and stops at `MAX_LINKS_PER_PAGE`. Writing a second link reader here would be a second
 * answer to every one of those questions, and the second answer is the one that gets it wrong on
 * the page nobody tested.
 *
 * `kind` IS THE MATCHER'S ANSWER, NEVER THIS ADAPTER'S. `types.ts` is explicit: an adapter finds
 * hrefs, and whether one is a PRODUCT, a CATEGORY or a PAGINATION link is decided by the patterns
 * an operator configured in Phase 26. `null` is the honest value for a URL the configuration says
 * nothing about, and what the core does with those is not queue them.
 */
async function discover(ctx: AdapterContext, page: FetchedPage): Promise<readonly DiscoveredUrl[]> {
  try {
    const item = readRawItem(page.body.slice(0, MAX_BODY_LENGTH), page.url)
    const found: DiscoveredUrl[] = []

    for (const url of item.links) {
      if (ctx.budgetSpent()) break
      found.push({ url, kind: ctx.matchUrl(url).kind })
    }

    return found
  } catch {
    // The same rule as `extract()`: a page this adapter cannot read is a page that contributed no
    // links, which is a fact the run can record. A throw would cost the item.
    ctx.logger.warn('discovery found nothing readable on the page')
    return []
  }
}

/**
 * One page to one draft. See the header: this never throws, and a page it cannot read is a draft
 * with every confidence at 0.
 *
 * THE STRATEGIES ARE WRAPPED INDIVIDUALLY. A bug in the RDFa reader must not throw away what
 * JSON-LD already found: the draft is threaded through, each step is guarded, and a step that
 * throws returns the draft it was given. That is the same blast-radius reasoning FEAT §27 applies
 * to sources within a run, one level further in.
 *
 * THE DRAFT IS PARSED ON THE WAY OUT, ONCE. `withField` already trims, caps and filters everything
 * it stores, so this cannot normally fail — which is exactly why it is worth doing: D1 puts a Zod
 * check at every trust boundary, and the boundary here is a value assembled from a third party's
 * markup on its way into a jsonb column. A failure means an adapter bug rather than a bad page, and
 * an empty draft plus a `warn` is how a bug shows up as one item's worth of nothing rather than as
 * an exception in a nightly cron log.
 */
async function extract(ctx: AdapterContext, page: FetchedPage): Promise<RawProductDraft> {
  const root = readDocument(page, ctx)
  if (root === null) return emptyDraft()

  const imageReference = referenceResolver(page.url)
  let draft = emptyDraft()

  const documents = guarded<readonly unknown[]>(ctx, 'jsonld', [], () =>
    readJsonLdDocuments(root, ctx),
  )

  draft = guarded(ctx, 'jsonld', draft, () => applyJsonLd(draft, documents, ctx, imageReference))
  draft = guarded(ctx, 'microdata', draft, () => applyMicrodata(draft, root, ctx, imageReference))
  draft = guarded(ctx, 'rdfa', draft, () => applyRdfa(draft, root, ctx, imageReference))
  draft = guarded(ctx, 'opengraph', draft, () => applyOpenGraph(draft, root, ctx, imageReference))
  draft = guarded(ctx, 'selector', draft, () =>
    applyConfiguredSelectors(draft, root, ctx, documents),
  )
  draft = guarded(ctx, 'last-resort', draft, () => applyLastResort(draft, root))
  draft = applyImagePolicy(draft, ctx)

  const parsed = rawProductDraftSchema.safeParse(draft)
  if (!parsed.success) {
    ctx.logger.warn('the assembled draft did not satisfy its own schema and was discarded', {
      issues: parsed.error.issues.length,
    })
    return emptyDraft()
  }
  return parsed.data
}

/**
 * `<title>`, then the first `<h1>` — the last resort, and for the title alone.
 *
 * NOTHING IS SPLIT OFF A `<title>`. It usually reads "Product name — Site name", and trimming the
 * site off means guessing which separator the template used and which side the product is on. Guess
 * wrong and the draft carries a company as a product name with confidence 1 behind it; leave it
 * whole and a merchandiser sees exactly what the page says, with `provenance.title = 'title'`
 * telling them how thin the reading was. Phase 28 normalises over stored evidence, where a rule
 * that turns out to be wrong can be corrected and re-run.
 *
 * ONLY THE TITLE. An `<h1>` is a heading and a `<p>` is a paragraph; neither is a price, a SKU or a
 * material, and an adapter that started reading them would be inventing structure a page never
 * declared — which is the one failure mode a confidence map cannot warn anybody about, because the
 * value would arrive with confidence 1.
 */
function applyLastResort(draft: RawProductDraft, root: HTMLElement): RawProductDraft {
  let next = withField(draft, 'title', textOf(root, 'title'), 'title')
  next = withField(next, 'title', textOf(root, 'h1'), 'h1')
  return next
}

/** The collapsed text of the first element matching a tag name, or `null`. */
function textOf(root: HTMLElement, selector: string): string | null {
  let element: HTMLElement | null
  try {
    element = root.querySelector(selector)
  } catch {
    return null
  }
  if (element === null) return null

  const text = elementText(element)
  return text === '' ? null : text
}

/**
 * FEAT §26 field 12, applied once, where the draft leaves the adapter.
 *
 * `image_extraction_mode = 'NONE'` IS AN INSTRUCTION ABOUT WHAT MAY BE RECORDED, and applying it in
 * one place is what keeps it true. Five strategies each remembering to ask would be five chances to
 * forget, and the one that forgot would be the one nobody wrote a fixture for. Stripping the field
 * here also repairs the two maps together — `draft-schema.ts` states the invariant that
 * `confidence[f] === 1` if and only if `provenance[f]` is set — so a draft with images removed is
 * indistinguishable from a draft that never found one, which is what the setting means.
 *
 * `URL_ONLY` AND `URL_AND_DIMENSIONS` ARE THE SAME THING HERE, and that is not an oversight.
 * `RawProductDraft` has nowhere to put an image's dimensions, and no mode downloads, caches,
 * re-hosts, thumbnails or measures anything (D5, and `IMAGE_EXTRACTION_MODES`'s own note): the most
 * permissive value stores a URL string and two integers, and the two integers belong to a later
 * phase's shape rather than to this one.
 */
function applyImagePolicy(draft: RawProductDraft, ctx: AdapterContext): RawProductDraft {
  if (ctx.source.imageExtractionMode !== 'NONE') return draft
  if (draft.confidence.imageUrls === 0) return draft

  const provenance = { ...draft.provenance }
  delete provenance.imageUrls

  return {
    ...draft,
    imageUrls: [],
    confidence: { ...draft.confidence, imageUrls: 0 },
    provenance,
  }
}

/**
 * Parse the body, or say why not.
 *
 * THE PARSE ITSELF MOVED TO `lib/scraper/adapters/parse.ts`, and the reason is a defect this
 * adapter had: `node-html-parser` is super-quadratic in NESTING DEPTH, so a hundred kilobytes of
 * unclosed `<div>` — well inside the fetcher's 2 MB cap, and trivially served by anybody who would
 * like Rivya to stop reading them — takes hours rather than milliseconds. The CPU budget cannot
 * catch it: the runaway is one synchronous call into a dependency, with no loop of ours to ask.
 * `parseDocument` refuses such a document before handing it over, and it is the ONLY sanctioned
 * parse in the tree so that a vendor adapter written later cannot reintroduce the hole.
 *
 * WHAT SURVIVES HERE IS THE LOGGING, which belongs to the adapter rather than to the parser: the
 * reason a page could not be read is a line an operator sees beside that item in the run detail
 * screen, and the parser has no logger and should not be given one.
 */
function readDocument(page: FetchedPage, ctx: AdapterContext): HTMLElement | null {
  const outcome = parseDocument(page.body)

  if (!outcome.ok) {
    // AN EMPTY BODY IS NOT A WARNING. It is the ordinary result of a 204, a redirect chain that
    // ended somewhere blank, or a page behind a login — none of which is a fault in the page.
    if (outcome.reason === 'EMPTY') ctx.logger.debug(outcome.detail)
    else ctx.logger.warn(outcome.detail, { reason: outcome.reason })
    return null
  }

  if (outcome.truncated) {
    ctx.logger.warn('the page was truncated before parsing', { bytes: page.body.length })
  }

  return outcome.root
}

/**
 * Resolve an image reference against the page's final URL, or refuse it.
 *
 * IMAGES ARE RESOLVED AND `canonicalUrl` IS NOT, WHICH LOOKS INCONSISTENT AND IS NOT.
 * `draft-schema.ts` defines `canonicalUrl` as the claim the page makes, UNRESOLVED, because
 * reconciling it with where the bytes came from is a decision about identity and identity decisions
 * are Phase 28's. An image reference has no such decision behind it: the schema will not store a
 * relative one at all, so the choice is between an absolute reference and no reference, and a
 * gallery dropped because a template used relative paths is evidence lost for nothing.
 *
 * IT RESOLVES; IT NEVER FETCHES. Nothing in `lib/scraper/**` turns one of these strings into bytes
 * — D5 and the phase document are absolute — and the only place Studio renders one is the
 * authenticated, non-caching proxy. A `data:` payload, a `javascript:` href on a lazy-loading
 * gallery and an unparseable reference all answer `null`, which `withField` drops without costing
 * the rest of the gallery.
 */
function referenceResolver(pageUrl: string): (reference: string) => string | null {
  return (reference) => {
    const trimmed = reference.trim()
    if (trimmed === '') return null

    try {
      const url = new URL(trimmed, pageUrl)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
      return url.toString()
    } catch {
      return null
    }
  }
}

/**
 * Run one strategy, and let a strategy that throws cost only its own fields.
 *
 * THE FALLBACK IS THE DRAFT AS IT STOOD, NOT AN EMPTY ONE. Everything the earlier strategies found
 * is evidence that was read correctly, and throwing it away because a later reader had a bug would
 * turn one broken rule into a page with nothing on it.
 *
 * THE LOG LINE NAMES THE STRATEGY AND NOTHING ELSE. `AdapterLogger` takes scalars, `types.ts` says
 * why: an error message from a parser can carry a fragment of the page that produced it, and a
 * third party's markup must not end up in Rivya's logs.
 */
function guarded<T>(ctx: AdapterContext, strategy: string, fallback: T, run: () => T): T {
  if (ctx.budgetSpent()) return fallback

  try {
    return run()
  } catch {
    ctx.logger.warn('an extraction strategy failed and was skipped', { strategy })
    return fallback
  }
}
