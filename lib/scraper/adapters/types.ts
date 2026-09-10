import type { AdapterCapability, AdapterSourceView } from '@/lib/scraper/adapters/registry'
import type { RawProductDraft } from '@/lib/scraper/adapters/draft-schema'

/**
 * The contract every adapter meets, and the exhaustive list of what an adapter is allowed to see.
 *
 * THIS IS THE LARGER HALF OF THE SEAM `adapters/registry.ts` DESCRIBES. That file holds the
 * DESCRIPTOR — key, version, capabilities, `supports()` — because a Studio picker has to render it
 * and a Server Action has to validate against it, and both of those live in a bundle no parser may
 * reach. This file holds the whole of `SourceAdapter`, `discover()` and `extract()` included, and
 * `adapters/execution.ts` holds the register that maps a key to one. Nothing here imports a parser,
 * so importing this module costs a caller four interfaces; importing an IMPLEMENTATION is what
 * would drag `node-html-parser` and a vendor's rules along with it, which is exactly what the split
 * exists to stop.
 *
 * `AdapterContext` CARRIES FOUR THINGS AND THE LIST IS CLOSED: the source's configuration, the URL
 * matcher, a logger, and a predicate saying whether the CPU budget is spent. FEAT §27 writes it as
 * "the source configuration, the URL-pattern matcher and a logger — and **nothing else**", and the
 * value of that sentence is entirely in the second half. An adapter is a pure function from bytes
 * to a draft; every side effect in this subsystem belongs to the core. That is what makes a vendor
 * adapter reviewable in ten minutes, safe to accept from somebody who is not on this project, and
 * impossible to misuse by accident. Absences are hard to review, so — as `core/fetch.ts` does with
 * its own prohibitions — each one is written down here with what it prevents.
 *
 *   NO `fetch`, AND NO HTTP CLIENT OF ANY KIND. A request made from inside an adapter is a request
 *   that skipped every gate the core applies before one is allowed: the `research.enabled` kill
 *   switch, the source's policy review, `core/robots.ts`, the per-source crawl delay and rate
 *   limit, the redirect and body caps in `core/fetch.ts`, and the `research_fetches` row that makes
 *   the request auditable afterwards. It would also be a request nobody could find later, because
 *   nothing recorded that it happened. There is no polite way to do this from an adapter, so an
 *   adapter is given nothing to do it with.
 *
 *   NO DATABASE HANDLE, NO REPOSITORY, NO SUPABASE CLIENT. A handle here is a path from a third
 *   party's markup straight to a write — the shortest one in the system, since the markup is
 *   already in scope on the line above. Every research write goes through the service role in
 *   `lib/scraper/workflows/**` after the drain loop's checks, and `0251` grants no session role a
 *   write on the two tables Phase 27 adds precisely because a record its author can edit is not a
 *   record.
 *
 *   NO FILE SYSTEM. Snapshots are written and read by the core; `scripts/research/reextract.ts`
 *   loads the bytes and hands them over as a `FetchedPage`, which is why that script can promise
 *   zero network traffic. And `node:fs` in a module that runs a vendor's rules over a vendor's page
 *   is read access to the deployment — `.env` is a file, and so is every key beside it.
 *
 *   NO CLOUDINARY CLIENT, AND NOTHING THAT TOUCHES AN IMAGE. D5 and the phase document are
 *   absolute: competitor imagery is never downloaded, cached, re-hosted, thumbnailed or measured.
 *   `RawProductDraft.imageUrls` holds strings, this context offers nothing that could turn one into
 *   bytes, and the one place Studio renders such an image is the authenticated non-caching proxy.
 *
 *   NO CLOCK. `observed_at` is the core's to stamp, and an adapter that reached for `Date.now()`
 *   would eventually put the reading into a draft — at which point two extractions of a page nobody
 *   has touched hash differently, `research_product_versions_unique_content` stops deduplicating,
 *   and a nightly run writes a version a night for every unchanged product in the catalogue. The
 *   house rule is injected clocks; here the honest injection is none at all.
 *
 * THE BUDGET IS A PREDICATE THE ADAPTER CALLS, NOT A TIMEOUT THE CORE ENFORCES, AND THE COMMENT
 * THAT CLAIMED OTHERWISE WOULD BE DESCRIBING A RUNTIME THIS IS NOT. JavaScript cannot pre-empt a
 * synchronous function: there is no signal that interrupts a `for` loop over forty thousand nodes,
 * and `Promise.race` against a timer resolves the race while the loop carries on holding the only
 * thread there is. So the bound is built from three parts that are real. The input is bounded
 * before an adapter sees it, by the 2 MB streaming cap in `core/fetch.ts`. The call is MEASURED by
 * `core/run-adapter.ts`, which records an overrun as an item failure with the adapter key and
 * version on it — after the fact, which is when a measurement of a synchronous call is available.
 * And `budgetSpent()` is how a well-behaved adapter stops early: it is checked inside any loop over
 * page nodes, and an adapter that checks it turns a pathological page into a draft with low
 * confidence instead of a wedged cron invocation. An adapter that ignores it is not contained by
 * this file — it is contained by the item failure, by the ten-consecutive-failure abort on its own
 * source, and by the circuit that opens after three aborted runs.
 *
 * THE ASYNC SIGNATURES ARE NOT PERMISSION TO AWAIT ANYTHING, since there is nothing in the context
 * to await. They are fixed at the shape FEAT §27 quotes, and they let `core/run-adapter.ts` wrap
 * every call in one try/catch and one measurement whatever an adapter does inside — a contract with
 * two shapes would need two isolation boundaries, and the second one is the one that gets it wrong.
 */

/**
 * One fetched page, as an adapter receives it: a value, with nothing live attached.
 *
 * NOT A `Response`, AND THE DIFFERENCE MATTERS. A `Response` carries a body that can only be read
 * once, headers an adapter could use to decide it wanted a different request, and a socket. This
 * is bytes that have already been read, capped and recorded, handed over as data — which is what
 * lets the same adapter run against a live fetch and against a snapshot pulled off storage by
 * `scripts/research/reextract.ts` without knowing or caring which it got.
 *
 * `url` IS THE FINAL URL, AFTER REDIRECTS, because it is the one every relative href on the page
 * resolves against. `core/fetch.ts` follows redirects manually and returns `finalUrl` for exactly
 * this; handing over the requested URL instead would make an adapter on a redirected page resolve
 * every link against a location the bytes did not come from.
 *
 * `contentHash`, `storageKey` AND `httpStatus` ARE NULLABLE BECAUSE A REPLAY HAS NO RESPONSE. A
 * page re-read from a stored snapshot has bytes and no status; a page whose snapshot was pruned at
 * 180 days has neither key nor hash. That is the same honesty `research_product_versions.run_id`
 * carries for a version that belongs to no run — inventing a value would put a plausible lie in a
 * column somebody later reasons from.
 *
 * NOTHING HERE IS EXPECTED TO BE READ BY AN ADAPTER. The three are carried so the core hands one
 * value to the adapter and to the version writer rather than assembling a second, and `contentHash`
 * in particular is over the RESPONSE BODY: an adapter reaching for it to decide whether a page had
 * changed would be using the wrong hash entirely, since the one deduplication runs on is over the
 * draft. See `core/content-hash.ts`.
 */
export interface FetchedPage {
  readonly url: string
  readonly body: string
  readonly contentHash: string | null
  readonly storageKey: string | null
  readonly httpStatus: number | null
}

/**
 * One URL an adapter found on a page, and what the source's patterns make of it.
 *
 * `kind` IS THE MATCHER'S ANSWER, NOT THE ADAPTER'S OPINION. An adapter finds hrefs; whether one is
 * a PRODUCT, a CATEGORY or a PAGINATION link is decided by the patterns an operator configured in
 * Phase 26, which is why `AdapterContext.matchUrl` exists and why an adapter has no business
 * inventing a fourth answer. `null` is the honest value for a URL the configuration says nothing
 * about — the core decides what to do with it, and what it does is not queue it.
 *
 * A STRING RATHER THAN `UrlPatternKind`, for the same reason `matchUrl` is narrowed: this file is
 * the contract a vendor adapter is written against, and tying it to the matcher's enum would make
 * every adapter import `core/url-patterns.ts` in order to name a value it only ever passes through.
 * A `UrlPatternKind` is assignable to `string`, so nothing is lost in the direction that matters.
 */
export interface DiscoveredUrl {
  readonly url: string
  readonly kind: string | null
}

/**
 * Where an adapter says something, and the two levels it is allowed to say it at.
 *
 * NO `error` LEVEL, DELIBERATELY. An adapter does not get to decide that something is a failure —
 * `core/run-adapter.ts` catches the throw, marks the item `FAILED`, and writes the first five
 * errors onto `research_adapter_runs` where an operator will actually find them. An adapter that
 * logged an error every time it could not find a lead time would fill the cron invocation's log
 * with the most ordinary outcome there is, and a log that cries wolf about normal behaviour is one
 * nobody reads on the day something is genuinely wrong.
 *
 * THE CONTEXT IS SCALARS ONLY, WHICH IS `core/log.ts`'s SHAPE AND ITS RULE. A page body, a fragment
 * of markup or an extracted value must never reach a log line: the first two are a third party's
 * content ending up in Rivya's logs, and the third is how a value nobody has judged yet gets
 * quoted somewhere it looks like a fact. A slug and a count are what a log line is for.
 */
export interface AdapterLogger {
  readonly debug: (message: string, context?: Readonly<Record<string, string | number>>) => void
  readonly warn: (message: string, context?: Readonly<Record<string, string | number>>) => void
}

/**
 * The source configuration an adapter may see. Strings and enums — no row, no client.
 *
 * NARROWER THAN `research_sources`, AND THE NARROWING IS THE POINT. The row carries a policy
 * decision, a reviewer, a circuit-breaker state, an enablement flag and the identity of whoever
 * last edited it; none of that is an input to reading a page, and all of it is something an adapter
 * could be tempted to branch on. What is left is what extraction actually needs: who the source is,
 * where it lives, what currency its prices are quoted in, whether image URLs may be recorded at
 * all, and the three configured extraction blobs.
 *
 * THE THREE EXTRACTION BLOBS ARE `unknown`, AND THAT IS NOT LAZINESS. They are jsonb columns, so
 * what comes back is whatever was stored — possibly by an earlier version of `core/source-schema.ts`
 * than the one running now. Typing them here would hand an adapter a promise the database does not
 * make, and it would put a Zod-carrying 37 kB validation module into the import graph of every
 * adapter for three fields most of them never read. D1 says Zod at every trust boundary, and a
 * blob read back out of a row is one: the adapter that uses `priceExtraction` parses it with
 * `priceExtractionSchema` at the point of use, and gets a typed value it has actually checked.
 *
 * `currency` IS DECLARATION, NEVER CONVERSION. It says what the source quotes in, so Phase 28 can
 * resolve an ambiguous symbol against it. No foreign exchange happens anywhere in this subsystem —
 * that needs a dated rate Rivya does not hold — and an adapter does not resolve a currency at all.
 */
export interface AdapterSourceConfig {
  readonly slug: string
  readonly baseUrl: string
  readonly currency: string | null
  readonly imageExtractionMode: 'NONE' | 'URL_ONLY' | 'URL_AND_DIMENSIONS'
  readonly priceExtraction: unknown
  readonly skuExtraction: unknown
  readonly attributeExtraction: unknown
}

/**
 * Everything an adapter is given. See the header for what it is not given, and why.
 *
 * `matchUrl` RETURNS A NARROWED VIEW OF `UrlMatch` for the reason `AdapterSourceView` in
 * `registry.ts` is narrower than a source row: the contract should describe what the caller needs,
 * not what the implementation happens to hold. `core/url-patterns.ts` also returns `patternId`,
 * which is an operator-facing detail for the pattern tester and means nothing to an adapter. A real
 * `UrlMatch` is assignable to this shape, so the core passes its matcher straight through and a
 * test passes a two-line stub.
 *
 * IT IS A FUNCTION RATHER THAN THE PATTERN LIST, so an adapter cannot re-implement matching. Two
 * answers to "does this URL count" is precisely the drift FEAT §26 exists to prevent, and the
 * second one would be written by whoever was closest to a deadline.
 */
export interface AdapterContext {
  readonly source: AdapterSourceConfig
  readonly matchUrl: (url: string) => { kind: string | null; reason: string }
  readonly logger: AdapterLogger
  /** True once the CPU budget is spent. An adapter checks it inside any loop over page nodes. */
  readonly budgetSpent: () => boolean
}

/**
 * One adapter, whole. `registry.ts` publishes the first four members; this is the rest.
 *
 * `supports()` TAKES `AdapterSourceView`, NOT THE ROW FEAT §27 WRITES, and `registry.ts` records
 * the argument at length: the create drawer asks the question about a source that does not exist
 * yet, so a predicate demanding the full row could only be called after the save it is meant to
 * warn before. The two halves declare the same member with the same signature, which is what lets
 * one object be registered in both registers.
 *
 * `supports()` IS PURE AND MUST STAY PURE. `tests/unit/adapter-contract.test.ts` calls it twice and
 * asserts the same answer, because it is called from a Server Action on every keystroke in a form
 * and its answer is a warning a person acts on. A predicate that consulted anything would be a
 * predicate that could disagree with itself between the drawer and the run.
 *
 * `extract()` DOES NOT THROW FOR A PAGE IT CANNOT READ. Malformed markup, a missing price, a
 * catalogue page served where a product page was expected — each of those is a draft with low
 * confidence, which is a fact the run detail drawer shows a merchandiser. A throw is for a bug in
 * the adapter, and `core/run-adapter.ts` treats it as one.
 */
export interface SourceAdapter {
  readonly key: string
  readonly version: string
  readonly capabilities: readonly AdapterCapability[]
  supports(source: AdapterSourceView): boolean
  discover(ctx: AdapterContext, page: FetchedPage): Promise<readonly DiscoveredUrl[]>
  extract(ctx: AdapterContext, page: FetchedPage): Promise<RawProductDraft>
}
