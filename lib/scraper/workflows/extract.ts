import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { getAdapter } from '@/lib/scraper/adapters/execution'
import type {
  AdapterContext,
  AdapterLogger,
  AdapterSourceConfig,
  DiscoveredUrl,
  FetchedPage,
  SourceAdapter,
} from '@/lib/scraper/adapters/types'
import { draftContentHash } from '@/lib/scraper/core/content-hash'
import { warnScraper } from '@/lib/scraper/core/log'
import {
  CONSECUTIVE_ABORTED_RUNS_TO_OPEN_CIRCUIT,
  makeBudget,
  runAdapterDiscover,
  runAdapterExtract,
  type AdapterCallOutcome,
  type SourceFailureTracker,
} from '@/lib/scraper/core/run-adapter'
import {
  matchUrl,
  type SourceUrlPattern,
  type UrlPatternKind,
} from '@/lib/scraper/core/url-patterns'
import type { Database } from '@/lib/supabase/database.types'
import {
  countConsecutiveAbortedRuns,
  finishAdapterRun,
  recordAdapterItem,
} from '@/lib/supabase/repositories/research/adapter-runs'
import { recordProductVersion } from '@/lib/supabase/repositories/research/product-versions'
import {
  recordProductSighting,
  setCurrentVersionId,
} from '@/lib/supabase/repositories/research/products'
import { recordRawItem } from '@/lib/supabase/repositories/research/raw-items'
import { listUrlPatterns } from '@/lib/supabase/repositories/research/source-config'

/**
 * One fetched page, turned into a draft, a raw item, a sighting and — only when the page has
 * actually changed — a version.
 *
 * THIS FILE IS THE ACCOUNTING, AND `core/run-adapter.ts` IS THE VERDICT. That split is stated from
 * the other side in that file's header and it is worth restating from this one, because it is the
 * reason the isolation boundary is trustworthy: a boundary that also wrote the
 * `research_adapter_runs` row would be a boundary whose own failure mode is a write, and it would
 * fail at the worst possible moment — the write only happens once something has already gone wrong.
 * So `run-adapter.ts` takes an adapter, a context and a page and returns an outcome, and every row
 * that outcome implies is written here.
 *
 * NOTHING BELOW THROWS FOR A PAGE, AN ADAPTER OR A CONFIGURATION IT CANNOT READ. A missing adapter
 * key is a `FAILED` adapter run and one item failure. A throwing `extract()` is one item failure. A
 * draft that will not parse is one item failure. Each of those leaves the run, the source's queue
 * and every other source exactly where they were, which is FEAT §27's defining constraint written
 * as control flow rather than as a hope. What this file does let through is a database error: if
 * `research_product_versions` refuses an insert for a reason that is not the content-hash
 * constraint, the caller hears about it, because that is a fault in Rivya's own system and
 * swallowing it would turn a broken deployment into a nightly run that quietly records nothing.
 *
 * THE STAGE IS NOT WRITTEN HERE AND MUST NOT BE. `research_products.stage` defaults to `RAW` at the
 * column, so a product this workflow sights for the first time is at `RAW` without anybody saying
 * so, and every later move belongs to `core/stage.ts` — the one function that writes the
 * `research_pipeline_events` row alongside. `check-research-isolation.mjs` fails the build on a
 * `writeProductStage` call anywhere else, and that guard is the reason the stage history is
 * complete rather than mostly complete.
 *
 * IT DOES NOT QUEUE WHAT IT DISCOVERED, EITHER. The discovered URLs are RETURNED, and
 * `workflows/drain.ts` decides what becomes work — because that decision needs the job's crawl
 * depth, the source's politeness clock and the run's cancellation state, none of which is an input
 * to reading a page. Folding the enqueue in here would put the depth rule in two places, and the
 * second copy is the one that follows a link nobody agreed to.
 *
 * NO IMAGE IS FETCHED, MEASURED OR STORED BY ANYTHING IN THIS FILE. `RawProductDraft.imageUrls`
 * holds strings; they are written to jsonb as strings and read back as strings. D5 and the phase
 * document are absolute about it, and the one place Studio renders such a reference is the
 * authenticated, non-caching proxy.
 */

type Client = SupabaseClient<Database>

/** The `research_sources` row, whole, as the drain loop already holds it. */
type ResearchSourceRow = Database['public']['Tables']['research_sources']['Row']

/**
 * What the drain loop hands over once a page has been fetched and its `research_fetches` row
 * written.
 *
 * `adapterRunId` AND `tracker` ARE PASSED IN RATHER THAN MADE HERE, and both for the same reason:
 * they belong to the SOURCE for the length of the RUN, and this function is called once per item.
 * A tracker built here would count to one and forget, so ten consecutive failures would never be
 * ten; a `startAdapterRun` called here would be a read and possibly an insert per page instead of
 * per source. The caller owns both, which is also what lets a run drained over many cron ticks
 * rebuild its accounting from the row rather than from a process that will not survive.
 *
 * `fetchId` IS NULLABLE BECAUSE A REPLAY HAS NO FETCH. `scripts/research/reextract.ts` re-runs an
 * adapter over a stored snapshot with no network traffic at all; the version it writes belongs to
 * no fetch and, per `0250`, to no run either. Inventing an id for one would put a plausible lie in
 * a column somebody later reasons from.
 */
export interface ExtractPageInput {
  readonly runId: string
  readonly source: ResearchSourceRow
  readonly fetchId: string | null
  readonly page: FetchedPage
  readonly adapterRunId: string
  readonly tracker: SourceFailureTracker
}

/**
 * What one item did, in the vocabulary `drain.ts` already sums.
 *
 * `extracted` AND `failed` ARE 0 OR 1 — this is one item — and they are not exhaustive of each
 * other: an adapter that declares no `EXTRACT` capability produces neither, which is the honest
 * answer for a page nobody asked it to read.
 */
export interface ExtractPageOutcome {
  readonly extracted: number
  readonly failed: number
  readonly discovered: readonly DiscoveredUrl[]
}

/** How much of an adapter's own log line is kept. A line, not a page — see `core/log.ts`. */
const MAX_LOG_MESSAGE = 300

/** And of one context value. `AdapterLogger`'s contract says a slug and a count; this bounds it. */
const MAX_LOG_VALUE = 120

/**
 * Read one page with the source's adapter, and record everything that follows from it.
 *
 * THE ORDER OF THE WRITES IS DELIBERATE AND IT IS NOT TRANSACTIONAL. PostgREST gives this workflow
 * no transaction to put five statements in, so what the order buys is that every partial failure
 * leaves a state a later run repairs rather than one it cannot see. The raw item goes first because
 * it is evidence and belongs on disk whatever happens next; the sighting second, because the
 * version needs a product to hang off; the version third; and the pointer LAST, so a pointer never
 * names a version that was not written. Interrupted between the third and the fourth, a product has
 * a version and a stale pointer — visible, and repaired by the next run that finds a change. The
 * other order would leave a pointer at an id that does not exist, which the foreign key refuses
 * outright and which would fail the item for a reason no operator could act on.
 */
export async function extractPage(
  admin: Client,
  input: ExtractPageInput,
): Promise<ExtractPageOutcome> {
  const { source, page } = input

  const adapter = getAdapter(source.adapter_key)
  if (adapter === null) return await failUnresolvedAdapter(admin, input)

  const ctx = await buildContext(admin, source, adapter)

  /*
   * ONE BUDGET FOR THE ITEM, AND ONE MEASUREMENT PER CALL, WHICH ARE TWO DIFFERENT NUMBERS ON
   * PURPOSE. `budgetSpent()` is the predicate a well-behaved adapter checks inside its own loops,
   * and what it should bound is the PAGE: an adapter that spent five seconds discovering and five
   * more extracting has spent ten seconds on one item, and a per-call predicate would tell it
   * everything was fine both times. The measurement `run-adapter.ts` records is per call, because
   * that is the number FEAT §27 names and the one that says which of the two calls is slow.
   */
  const budget = makeBudget()
  const context: AdapterContext = { ...ctx, budgetSpent: budget.spent }

  // CAPABILITIES ARE HONOURED RATHER THAN ASSUMED. `registry.ts` argues at length that declaring a
  // capability the code cannot honour is what puts a promise in the picker that the engine breaks;
  // the mirror of that argument is that calling a method an adapter says it does not implement asks
  // for a result nobody promised. `source-a` and `source-b` declare nothing and are asked nothing.
  const discovery = adapter.capabilities.includes('DISCOVER')
    ? await runAdapterDiscover(adapter, context, page)
    : null

  if (!adapter.capabilities.includes('EXTRACT')) {
    // Seen, and neither extracted nor failed. The tracker is NOT told: it counts extraction
    // outcomes, and recording a success for a call nobody made would reset a genuine failure run.
    await recordAdapterItem(admin, {
      id: input.adapterRunId,
      extracted: false,
      failed: false,
      durationMs: budget.elapsed(),
      error: errorOf(discovery),
      url: page.url,
    })
    return { extracted: 0, failed: 0, discovered: urlsOf(discovery) }
  }

  const extraction = await runAdapterExtract(adapter, context, page)

  if (!extraction.ok) {
    await recordAdapterItem(admin, {
      id: input.adapterRunId,
      extracted: false,
      failed: true,
      durationMs: budget.elapsed(),
      // The extractor's reason wins: it is the call the item was leased for. A discovery failure
      // alongside it is the same adapter being broken in a second place, and the first five errors
      // are more useful holding five different pages than two faults on one.
      error: extraction.error,
      url: page.url,
    })
    await recordFailure(admin, input, adapter)
    return { extracted: 0, failed: 1, discovered: urlsOf(discovery) }
  }

  const draft = extraction.value
  const contentHash = draftContentHash(draft)

  await recordRawItem(admin, {
    runId: input.runId,
    sourceId: source.id,
    fetchId: input.fetchId,
    sourceUrl: page.url,
    sourceExternalId: draft.externalId,
    raw: draft,
    contentHash,
    adapterKey: adapter.key,
    adapterVersion: adapter.version,
  })

  /*
   * THE SIGHTING IS AT THE URL THE BYTES CAME FROM, NOT AT THE ONE THE PAGE CLAIMS, and this is a
   * change from Phase 25's drain loop rather than an oversight. `readRawItem` in `core/raw.ts`
   * RESOLVED the `<link rel="canonical">` href against the page URL before storing it, so using it
   * as an identity was safe; `RawProductDraft.canonicalUrl` is deliberately UNRESOLVED — the
   * schema's own note says reconciling it with the fetched URL is an identity decision and identity
   * decisions belong to Phase 28's deduplication. A relative canonical used here would become a
   * `research_products.source_url` that names no page at all, and every subsequent sighting of the
   * same product would create another row beside it.
   */
  const product = await recordProductSighting(admin, {
    sourceId: source.id,
    sourceUrl: page.url,
    sourceExternalId: draft.externalId,
    runId: input.runId,
  })

  const version = await recordProductVersion(admin, {
    researchProductId: product.id,
    runId: input.runId,
    fetchId: input.fetchId,
    draft,
    contentHash,
    storageKey: page.storageKey,
    adapterKey: adapter.key,
    adapterVersion: adapter.version,
  })

  // ONLY WHEN A VERSION WAS CREATED. `created: false` is the ordinary case — an unchanged page — and
  // re-pointing at a row that has not moved is a write that says something changed when nothing did.
  if (version.created) await setCurrentVersionId(admin, product.id, version.id)

  await recordAdapterItem(admin, {
    id: input.adapterRunId,
    extracted: true,
    failed: false,
    durationMs: budget.elapsed(),
    // A `discover()` that threw while `extract()` succeeded is a real fault that would otherwise
    // leave no trace: the counters look healthy and the source quietly stops finding new URLs.
    error: errorOf(discovery),
    url: page.url,
  })

  input.tracker.record(true)
  return { extracted: 1, failed: 0, discovered: urlsOf(discovery) }
}

/**
 * An adapter key nothing answers to: a `FAILED` adapter run and one item failure, never a throw.
 *
 * `FAILED` IS `0250`'s OWN WORD FOR THIS — "the adapter could not be resolved or started at all" —
 * and it is a different fact from `ABORTED`. Aborted means this source's adapter met ten pages in a
 * row it could not read; failed means nothing about this source was read, because the key stored on
 * it names an adapter that has been removed, renamed or never existed. An operator acts on those
 * two differently, which is why the status allowlist spells them separately.
 *
 * THE ITEM STILL FAILS, AND THE TRACKER STILL HEARS ABOUT IT. It costs nothing and it is true: the
 * page was leased, the page was fetched, and nothing was extracted from it.
 */
async function failUnresolvedAdapter(
  admin: Client,
  input: ExtractPageInput,
): Promise<ExtractPageOutcome> {
  const message = `No adapter is registered for the key '${input.source.adapter_key}'.`

  await recordAdapterItem(admin, {
    id: input.adapterRunId,
    extracted: false,
    failed: true,
    durationMs: 0,
    error: message,
    url: input.page.url,
  })
  await finishAdapterRun(admin, { id: input.adapterRunId, status: 'FAILED', durationMs: null })
  input.tracker.record(false)

  warnScraper({
    level: 'ERROR',
    event: 'research.adapter_unresolved',
    message:
      'A source is configured for an adapter key that no longer resolves, so nothing was ' +
      'extracted from it. Every other source is unaffected.',
    context: { source: String(input.source.slug), adapter: String(input.source.adapter_key) },
  })

  return { extracted: 0, failed: 1, discovered: [] }
}

/**
 * Count one failure, and close the row the moment ten of them in a row have latched the tracker.
 *
 * THE ABORT IS WRITTEN ON THE EDGE, NOT ON EVERY ITEM AFTER IT. `SourceFailureTracker.aborted`
 * latches deliberately — a later success cannot make a row that already says `ABORTED` untrue — so
 * a caller that re-read the flag each item would rewrite the row and re-count the circuit for every
 * remaining page. Asking whether it latched ON THIS ITEM makes the abort what it is: an event.
 *
 * THE CIRCUIT IS COUNTED HERE AND NOT OPENED HERE, AND THE MISSING WRITE IS DELIBERATE RATHER THAN
 * FORGOTTEN. Three consecutive `ABORTED` adapter runs should set `research_sources.circuit_open_until`,
 * and the only function that writes that column today is `recordSourceFetchOutcome`, which writes
 * it together with `next_fetch_not_before` and `consecutive_failures` — the FETCH-failure trio,
 * measured by the drain loop's own rate limiter. Calling it from here would overwrite two counters
 * this file never measured with values it invented, which is a worse bug than the one it fixes: the
 * source's politeness clock would be reset by an extraction fault. What lands here instead is the
 * count and the `WARNING` the phase document asks for, naming the adapter and its version. The
 * write belongs to a narrow `openSourceCircuit` in `repositories/research/sources.ts` — a file this
 * change does not own — and it is the one piece of the four-layer scheme still owed.
 */
async function recordFailure(
  admin: Client,
  input: ExtractPageInput,
  adapter: SourceAdapter,
): Promise<void> {
  const wasAborted = input.tracker.aborted
  input.tracker.record(false)
  if (!input.tracker.aborted || wasAborted) return

  await finishAdapterRun(admin, { id: input.adapterRunId, status: 'ABORTED', durationMs: null })

  warnScraper({
    level: 'WARNING',
    event: 'research.adapter_aborted',
    message:
      'Ten consecutive item failures stopped this source for the rest of the run. No other ' +
      'source is affected.',
    context: {
      source: String(input.source.slug),
      adapter: adapter.key,
      version: adapter.version,
    },
  })

  const abortedRuns = await countConsecutiveAbortedRuns(admin, input.source.id)
  if (abortedRuns < CONSECUTIVE_ABORTED_RUNS_TO_OPEN_CIRCUIT) return

  warnScraper({
    level: 'WARNING',
    event: 'research.adapter_circuit',
    message:
      'This source has aborted three runs in a row, which is the threshold for opening its ' +
      'circuit. Its adapter and the site no longer agree about what a product page looks like.',
    context: {
      source: String(input.source.slug),
      adapter: adapter.key,
      version: adapter.version,
      abortedRuns,
    },
  })
}

/**
 * Everything an adapter is given, except the budget the caller adds per item.
 *
 * THE URL PATTERNS ARE READ THROUGH THE REPOSITORY, ONCE PER ITEM, AND THAT IS THE HONEST COST OF
 * THE RULE. `scripts/db/check-data-layer.mjs` forbids a `.from(` outside
 * `lib/supabase/repositories/**`, so there is no shortcut; caching them for the length of a tick
 * would be a second answer to "what are this source's patterns", and a run drained over an hour
 * would spend the second half matching against a configuration an operator had already changed.
 * The read is one indexed query against a table that holds a handful of rows per source.
 *
 * `matchUrl` IS PASSED AS A FUNCTION, NOT AS THE PATTERN LIST, and `adapters/types.ts` says why:
 * two answers to "does this URL count" is exactly the drift FEAT §26 exists to prevent, and the
 * second one would be written by whoever was closest to a deadline. The matcher's own `UrlMatch`
 * is assignable to the narrowed shape the contract publishes, so nothing is adapted here.
 */
async function buildContext(
  admin: Client,
  source: ResearchSourceRow,
  adapter: SourceAdapter,
): Promise<Omit<AdapterContext, 'budgetSpent'>> {
  const patterns = await readUrlPatterns(admin, source.id)

  return {
    source: sourceConfig(source),
    matchUrl: (url: string) => matchUrl(url, patterns),
    logger: makeLogger(source.slug, adapter),
  }
}

/**
 * The source configuration an adapter may see, and nothing else off the row.
 *
 * THE THREE EXTRACTION BLOBS ARE PASSED THROUGH UNPARSED, WHICH IS `AdapterSourceConfig`'s OWN
 * DECISION AND NOT LAZINESS HERE. They are jsonb columns, so what comes back is whatever was
 * stored, possibly by an earlier version of `core/source-schema.ts` than the one running now;
 * parsing them at this seam would hand every adapter a promise the database does not make. The
 * adapter that reads one parses it with its own schema at the point of use, and gets a typed value
 * it has actually checked. That is D1 applied where the value is used rather than where it passes.
 *
 * `image_extraction_mode` NEEDS NO NARROWING BECAUSE THREE LISTS ALREADY AGREE: the column is a
 * PostgreSQL enum, `IMAGE_EXTRACTION_MODES` in `core/source-schema.ts` restates it for the form,
 * and `AdapterSourceConfig` restates it for the contract. If any of the three ever moves, this
 * assignment is where the compiler says so.
 */
function sourceConfig(source: ResearchSourceRow): AdapterSourceConfig {
  return {
    slug: source.slug,
    baseUrl: source.base_url,
    currency: source.currency,
    imageExtractionMode: source.image_extraction_mode,
    priceExtraction: source.price_extraction,
    skuExtraction: source.sku_extraction,
    attributeExtraction: source.attribute_extraction,
  }
}

/**
 * The adapter's logger, pointed at `core/log.ts` and bounded on the way.
 *
 * `debug` GOES NOWHERE, AND SAYING SO IS BETTER THAN SENDING IT TO `console.warn`. `core/log.ts`
 * has two levels, `WARNING` and `ERROR`, because its destination is a cron invocation's log until
 * Phase 38 gives it `system_logs`; there is no DEBUG channel to route to. Routing debug lines to
 * the warning one would fill that log with the most ordinary outcome there is — an adapter noting
 * that it could not find a lead time — and a log that cries wolf about normal behaviour is one
 * nobody reads on the day something is genuinely wrong. That is `AdapterLogger`'s own argument for
 * having no `error` level, applied from the other end. The method exists so an adapter can call it
 * without knowing where it lands, and `core/log.ts` is the one seam that has to change.
 *
 * THE SOURCE AND THE ADAPTER ARE STAMPED LAST SO AN ADAPTER CANNOT OVERWRITE THEM. A line that
 * named the wrong source would send somebody to the wrong configuration, and the whole value of
 * these two keys is that they are not the adapter's claim about itself.
 *
 * THE MESSAGE IS COLLAPSED AND TRUNCATED, and each context value with it. What an adapter passes
 * here was assembled next to a third party's markup — `core/run-adapter.ts` truncates a thrown
 * value for exactly that reason — and a multi-line message would break the one-line-per-event shape
 * `warnScraper` exists to keep greppable.
 */
function makeLogger(slug: string, adapter: SourceAdapter): AdapterLogger {
  const emit = (message: string, context?: Readonly<Record<string, string | number>>): void => {
    warnScraper({
      level: 'WARNING',
      event: 'research.adapter_warning',
      message: bounded(message, MAX_LOG_MESSAGE),
      context: {
        ...boundedContext(context),
        source: slug,
        adapter: adapter.key,
        version: adapter.version,
      },
    })
  }

  return {
    debug: () => {},
    warn: emit,
  }
}

function bounded(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`
}

function boundedContext(
  context: Readonly<Record<string, string | number>> | undefined,
): Record<string, string | number> {
  if (context === undefined) return {}
  const bounded_: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(context)) {
    bounded_[key] = typeof value === 'string' ? bounded(value, MAX_LOG_VALUE) : value
  }
  return bounded_
}

/**
 * The source's stored patterns, reduced to what the matcher needs.
 *
 * A KIND THIS CODE DOES NOT RECOGNISE IS READ AS `EXCLUDE`, WHICH LOOKS WRONG UNTIL YOU ASK WHICH
 * WAY IT ERRS. `0240`'s CHECK allowlists the four kinds, so the branch is unreachable through any
 * write this repository makes and exists for a row written by a direct SQL statement or by a future
 * migration this code has not met. Dropping such a row would silently widen what Rivya follows if
 * the row was a refusal; reading it as a refusal costs, at worst, a PRODUCT rule that stops
 * claiming URLs — which is `url-patterns.ts`'s own rule for an EXCLUDE that will not compile, in
 * its own words: a refusal we cannot read is still a refusal somebody made.
 */
async function readUrlPatterns(
  admin: Client,
  sourceId: string,
): Promise<readonly SourceUrlPattern[]> {
  const rows = await listUrlPatterns(admin, sourceId)

  return rows.map((row) => ({
    id: row.id,
    kind: asPatternKind(row.kind),
    pattern: row.pattern,
    isRegex: row.is_regex,
    priority: row.priority,
  }))
}

const PATTERN_KINDS: ReadonlySet<string> = new Set(['PRODUCT', 'CATEGORY', 'EXCLUDE', 'PAGINATION'])

function asPatternKind(kind: string): UrlPatternKind {
  return PATTERN_KINDS.has(kind) ? (kind as UrlPatternKind) : 'EXCLUDE'
}

/** The discovered URLs, or none. A failed discovery costs its links and not the item. */
function urlsOf(
  outcome: AdapterCallOutcome<readonly DiscoveredUrl[]> | null,
): readonly DiscoveredUrl[] {
  return outcome !== null && outcome.ok ? outcome.value : []
}

/** A discovery failure's reason, for the errors list. `null` when there was nothing to report. */
function errorOf(outcome: AdapterCallOutcome<readonly DiscoveredUrl[]> | null): string | null {
  return outcome !== null && !outcome.ok ? outcome.error : null
}
