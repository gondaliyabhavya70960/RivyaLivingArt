import { z } from 'zod'

import {
  isHttpReference,
  rawProductDraftSchema,
  type RawProductDraft,
} from '@/lib/scraper/adapters/draft-schema'
import type {
  AdapterContext,
  DiscoveredUrl,
  FetchedPage,
  SourceAdapter,
} from '@/lib/scraper/adapters/types'
import { MAX_LINKS_PER_PAGE } from '@/lib/scraper/core/raw'

/**
 * The one place an adapter is allowed to run, and the reason FEAT §27's defining constraint — "a
 * broken source adapter must not break other sources" — is a fact about this repository rather than
 * a hope about the adapters somebody writes for it.
 *
 * THE ISOLATION IS BUILT AS A BOUNDARY, NOT AS CARE TAKEN AT EACH CALL SITE. Every call into a
 * `SourceAdapter` goes through `runAdapterExtract` or `runAdapterDiscover`; both wrap the call in
 * one try/catch, measure it with an injected clock, and validate what came back before anybody sees
 * it. `adapters/types.ts` fixes `discover()` and `extract()` at the same async shape for exactly
 * this reason: a contract with two shapes would need two boundaries, and the second one is the one
 * that gets it wrong. Written the other way — a try/catch in the drain loop, another in the refresh
 * job, a third in `scripts/research/reextract.ts` — the three would disagree within a phase about
 * what a Zod failure means, and the disagreement would show up as a run that died on one bad page.
 *
 * NOTHING IN THIS FILE TOUCHES THE DATABASE, AND THE ABSENCE IS THE DESIGN. It takes an adapter, a
 * context and a page, and returns an outcome. A boundary that also wrote the
 * `research_adapter_runs` row would be a boundary whose own failure mode is a write: a network
 * blip, a stale lease or a constraint violation while recording that an adapter failed would then
 * take down the very mechanism that exists to contain a failure — and it would do so at the worst
 * possible moment, because the write only happens when something has already gone wrong. So the
 * accounting is the caller's: `lib/scraper/workflows/extract.ts` owns the row, the counters and the
 * first five errors, and this file owns the verdict it records. That also keeps this module usable
 * from `scripts/research/reextract.ts`, which has no run to account against at all.
 *
 * IT DOES NOT RESOLVE THE ADAPTER EITHER, though `getAdapter` in `adapters/execution.ts` names this
 * file as its caller. The lookup happens once per source; the call happens once per item, and an
 * unresolvable `research_sources.adapter_key` is a SOURCE-level fact — `0250`'s status vocabulary
 * spells it `FAILED`, "the adapter could not be resolved or started at all". Folding it in here
 * would need a fourth outcome kind that is true of a source and meaningless for an item, and mixing
 * a per-source verdict into a per-item outcome is precisely how a blast radius grows.
 *
 * THE FOUR LAYERS FEAT §27 ASKS FOR, AND WHICH HALF OF EACH IS HERE:
 *
 *   PER ITEM — `runAdapterExtract`. A throw, an overrun or a draft that does not parse is one item
 *   `FAILED` with a reason, and the loop moves to the next item. Whole layer, here.
 *
 *   PER SOURCE, PER RUN — `SourceFailureTracker` and `CONSECUTIVE_FAILURE_ABORT`. This file counts
 *   and decides; the caller stops leasing that source's items and writes `status = 'ABORTED'`.
 *
 *   PER SOURCE, ACROSS RUNS — `CONSECUTIVE_ABORTED_RUNS_TO_OPEN_CIRCUIT` is named here and used
 *   there. The state it is compared against lives in `research_adapter_runs`, three rows of it, and
 *   a module with no database handle cannot hold it — see above for why that is deliberate.
 *
 *   CROSS-SOURCE — not here at all, and it is the layer with the least code in it. Sources are
 *   leased and drained independently by `workflows/drain.ts`; what this file contributes is that no
 *   adapter can throw its way out of the loop that keeps them independent.
 *
 * EVERY BOUND IS APPLIED TO A VALUE THAT CAME FROM A THIRD PARTY'S MARKUP, and D1 calls that the
 * most hostile trust boundary in the system. An adapter is trusted code, but what it returns is
 * assembled from bytes somebody else wrote, so the draft is parsed rather than believed, the
 * discovered URLs are parsed rather than queued, and a thrown error is truncated rather than
 * stored — a page body can reach an exception message as easily as it reaches a field.
 */

/**
 * Five seconds of CPU per call. FEAT §27's number.
 *
 * BE CLEAR ABOUT WHAT THIS BUYS, BECAUSE IT IS NOT A TIMEOUT AND CALLING IT ONE WOULD BE A LIE.
 * JavaScript cannot pre-empt a synchronous function: there is no signal that interrupts a loop over
 * forty thousand nodes, and racing a promise against a timer resolves the race while the loop
 * carries on holding the only thread there is. By the time this module can compare an elapsed
 * duration against this number, the call has already returned. The overrun is therefore reported
 * AFTER the fact, and what that reporting is worth is three real things: a slow adapter is VISIBLE
 * rather than merely making the nightly run late; the item counts towards the ten consecutive
 * failures that abort its source, so a pathological page cannot be hit four hundred times in a row;
 * and the duration lands on the run detail screen where somebody can see which page it was.
 *
 * WHAT ACTUALLY BOUNDS THE WORK IS THE INPUT AND THE ADAPTER'S OWN COOPERATION. `core/fetch.ts`
 * abandons a response at two megabytes while streaming, so no adapter is ever handed a gigabyte;
 * and `AdapterContext.budgetSpent()` — built by `makeBudget` below — is what a well-behaved adapter
 * checks inside any loop over page nodes, turning a pathological page into a low-confidence draft
 * instead of a wedged cron invocation. An adapter that ignores it is contained by the item failure,
 * then by the abort, then by the circuit. Three imperfect bounds that exist beat one perfect bound
 * that this runtime cannot provide.
 */
export const ADAPTER_CPU_BUDGET_MS = 5000

/**
 * Ten consecutive item failures stop one source for the rest of the run. FEAT §27's number, and
 * `research_adapter_runs.status = 'ABORTED'` is what the caller writes when it is reached.
 *
 * TEN RATHER THAN ONE, BECAUSE A SINGLE BAD PAGE IS NORMAL. Catalogues carry a discontinued item
 * served as a stub, a redirect to a category, a page half-rendered by somebody's deployment. One
 * failure means nothing; ten in a row means the adapter and the site no longer agree about what a
 * product page looks like, and every further request is politeness spent on a result that will not
 * arrive. Consecutive, not cumulative — see `SourceFailureTracker`.
 */
export const CONSECUTIVE_FAILURE_ABORT = 10

/**
 * Three consecutive `ABORTED` adapter runs open the source's circuit. FEAT §27's number.
 *
 * NAMED HERE, ENFORCED IN THE WORKFLOW, and the split is the same one the header describes: the
 * three rows this is compared against live in `research_adapter_runs`, and this module holds no
 * database handle by design. It is named here so that the three thresholds of the four-layer scheme
 * read as one policy in one file rather than as three numbers discovered separately — which is how
 * the second one gets changed without the first.
 */
export const CONSECUTIVE_ABORTED_RUNS_TO_OPEN_CIRCUIT = 3

/**
 * How much of a thrown value is kept.
 *
 * A CAP, BECAUSE AN EXCEPTION MESSAGE IS AN UNTRUSTED STRING. `first_errors` is jsonb rendered in
 * Studio, and the shortest path from a competitor's page into that column is an adapter that
 * interpolates the markup it could not read into the error it throws about it. Three hundred
 * characters is a sentence and a value; it is not a document, a stack trace or a page.
 */
const MAX_ERROR_LENGTH = 300

/**
 * The longest URL an adapter may discover.
 *
 * THE SAME NUMBER `core/raw.ts` CAPS A LINK AT, deliberately: both bound the same thing, a URL
 * about to be queued as work, and a discovery path that admitted more than the raw item schema
 * stores would produce items that fail at the write instead of at the read. It is restated rather
 * than imported because that cap is private to `rawItemSchema`; if either moves, both move.
 */
const MAX_DISCOVERED_URL_LENGTH = 2048

/** A pattern kind is a short token from the matcher — `PRODUCT`, `CATEGORY` — never prose. */
const MAX_URL_KIND_LENGTH = 64

/**
 * What one call into an adapter produced: a value, or a reason, and always a duration.
 *
 * THE DURATION IS ON BOTH BRANCHES BECAUSE THE FAILURES ARE THE MEASUREMENTS WORTH HAVING. A run
 * that reports how long its successes took and nothing about its failures cannot answer the only
 * question an operator has when a source goes slow — was it slow before it broke? — and the
 * timed-out branch in particular would be a verdict with its own evidence missing.
 *
 * THREE KINDS, NOT ONE `error` STRING, BECAUSE THEY ASK FOR THREE DIFFERENT THINGS. `THREW` is a
 * bug in the adapter, and whoever owns the adapter fixes it. `TIMED_OUT` is a page, or a rule,
 * whose cost has grown — often no bug at all. `INVALID` is the adapter having produced something
 * this subsystem will not store, which in practice means it parsed a number or invented a field:
 * a review question about the adapter's contract rather than about its correctness. Collapsing
 * them would put all three in front of the same person with no way to sort them.
 */
export type AdapterCallOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly durationMs: number }
  | {
      readonly ok: false
      readonly error: string
      readonly durationMs: number
      readonly kind: 'THREW' | 'TIMED_OUT' | 'INVALID'
    }

/**
 * What a caller may vary about one adapter call.
 *
 * `now` IS THE INJECTED CLOCK THE HOUSE STYLE ASKS FOR, and here it is what makes the timed-out
 * verdict testable at all: the alternative is a suite that spends five real seconds proving a
 * threshold, which is a suite somebody eventually marks skipped.
 *
 * `budgetMs` IS AN ARGUMENT FOR THE SAME REASON, and for one other. `scripts/research/reextract.ts`
 * replays stored snapshots offline against no cron ceiling, so the number that protects a
 * sixty-second invocation is not necessarily the number that should fail a replay. A caller may
 * narrow or widen it knowingly; nobody has to edit a constant to do it.
 */
export interface AdapterCallOptions {
  readonly now?: () => number
  readonly budgetMs?: number
}

/**
 * The budget an adapter is handed as `AdapterContext.budgetSpent`.
 *
 * IT IS A PREDICATE THE ADAPTER CALLS, NOT A TIMER THE CORE FIRES — see `ADAPTER_CPU_BUDGET_MS` for
 * why there is no such timer in this runtime. `spent()` is the cooperative half of the bound and
 * `elapsed()` is what a caller records when it wants to say how long a whole item took rather than
 * one call within it.
 *
 * THE START IS READ ONCE, AT CONSTRUCTION, so a budget describes one span rather than restarting
 * whenever it is asked about. The clock is an argument for the house reason, and `elapsed()` never
 * returns a negative: `Date.now()` moves backwards when a machine's time is corrected under it, and
 * a negative duration would reach `research_adapter_runs.duration_ms` as a number no reader can
 * make sense of. Clamping at zero is not a repair — it is the honest floor for "no time passed
 * that this clock can account for".
 */
export function makeBudget(
  now: () => number = Date.now,
  budgetMs: number = ADAPTER_CPU_BUDGET_MS,
): { spent: () => boolean; elapsed: () => number } {
  const startedAt = now()
  const elapsed = (): number => Math.max(0, now() - startedAt)

  return { spent: () => elapsed() >= budgetMs, elapsed }
}

/**
 * Run `extract()` and come back with a draft or a reason. Never throws.
 *
 * THE VALUE HANDED ON IS THE PARSED ONE, NOT THE OBJECT THE ADAPTER RETURNED, and that is worth a
 * sentence because the difference is invisible until it matters. `rawProductDraftSchema.parse`
 * builds a new object and freezes the arrays inside it, so an adapter that kept a reference to its
 * own draft and mutated it after returning — a memoised builder reused across items, say — cannot
 * change what the core is about to hash and store. Passing the original through would make
 * `draftContentHash` a hash of whatever the object happened to contain at the moment it was taken.
 *
 * A ZOD FAILURE IS `INVALID`, AND IT IS A FAILURE OF THAT ITEM RATHER THAN OF THE RUN. This is
 * where an adapter that parsed a price is caught: `priceText` is `z.string().nullable()`, so a
 * draft carrying `1299` is refused here rather than at the write, which is the difference between
 * one item marked `FAILED` with a message naming the field and a `research_product_versions` insert
 * failing on a jsonb column with nothing to say about which of fifteen fields was wrong.
 */
export async function runAdapterExtract(
  adapter: SourceAdapter,
  ctx: AdapterContext,
  page: FetchedPage,
  options: AdapterCallOptions = {},
): Promise<AdapterCallOutcome<RawProductDraft>> {
  return runAdapterCall(
    () => adapter.extract(ctx, page),
    (returned) => validateWith(rawProductDraftSchema, returned, 'draft'),
    options,
  )
}

/**
 * Run `discover()` and come back with URLs or a reason. Never throws.
 *
 * DISCOVERED URLs ARE PARSED TOO, AND FOR THE SAME REASON THE DRAFT IS. What comes back was
 * assembled from a third party's anchors; the difference is that these are about to become WORK —
 * a row in the queue and, eventually, a request to somebody's server. A `mailto:` href, a
 * `javascript:` handler or a two-kilobyte tracking URL that reached the queue would be politeness
 * spent on a fetch that cannot succeed, and a page with forty thousand anchors would be a queue
 * nobody asked for. So: http(s) only, `MAX_LINKS_PER_PAGE` at most, each entry bounded.
 *
 * THE BOUNDARY REFUSES RATHER THAN REPAIRS, WHICH IS THE OPPOSITE OF WHAT `withField` DOES, and the
 * asymmetry is deliberate — it is the division of labour `adapters/draft-schema.ts` records. An
 * adapter's own helper cleans, because an adapter knows a `data:` placeholder in a lazy gallery is
 * noise rather than a finding. A boundary that silently fixed its input would be a boundary nobody
 * could reason about: the caller would have no way to know whether it received what the adapter
 * produced or what this file decided it meant.
 */
export async function runAdapterDiscover(
  adapter: SourceAdapter,
  ctx: AdapterContext,
  page: FetchedPage,
  options: AdapterCallOptions = {},
): Promise<AdapterCallOutcome<readonly DiscoveredUrl[]>> {
  return runAdapterCall(
    () => adapter.discover(ctx, page),
    (returned) => validateWith(discoveredUrlsSchema, returned, 'discovery'),
    options,
  )
}

/**
 * How many consecutive item failures this source has had, and whether that is now enough.
 *
 * A SUCCESS RESETS THE COUNT, AND "TEN CONSECUTIVE FAILURES" MEANS CONSECUTIVE. This is
 * `failureStateAfter` in `core/rate-limit.ts` applied one layer up, with the same argument behind
 * it: a source that fails nine items, extracts one, then fails nine more has not failed eighteen
 * times in a row and must not be stopped as though it had. A cumulative counter would abort every
 * large source on a long enough run, because a catalogue of four hundred products with a two per
 * cent stub rate reaches ten failures eventually — and would do it every night, at a different
 * point in the queue, which is the least diagnosable failure there is.
 *
 * THE ABORT LATCHES, WHILE THE COUNT DOES NOT, AND THAT IS NOT THE SAME RULE TWICE. Reaching ten is
 * an event with a consequence outside this object: the caller stops leasing that source's items and
 * writes `status = 'ABORTED'` on its `research_adapter_runs` row. A later success cannot make that
 * row untrue, and a tracker that quietly un-aborted would let a caller which had already recorded
 * the abort resume a source the run has on record as stopped. The count keeps resetting because it
 * answers a different question — how bad is it right now — and because a latched counter would make
 * `consecutiveFailures` a number that no longer means what it says.
 *
 * ONE TRACKER PER SOURCE, HELD BY THE CALLER FOR THE LENGTH OF A RUN. It is a plain object with no
 * clock and no storage precisely so that a run drained across several cron ticks can rebuild it
 * from the counters already on the row rather than depending on a process that will not survive.
 */
export class SourceFailureTracker {
  #consecutiveFailures = 0
  #aborted = false

  /** Record one item's outcome. `ok` is the outcome's own `ok`, so a caller cannot invert it. */
  record(ok: boolean): void {
    if (ok) {
      this.#consecutiveFailures = 0
      return
    }

    this.#consecutiveFailures += 1
    if (this.#consecutiveFailures >= CONSECUTIVE_FAILURE_ABORT) this.#aborted = true
  }

  get consecutiveFailures(): number {
    return this.#consecutiveFailures
  }

  /** True once `CONSECUTIVE_FAILURE_ABORT` has been reached. It does not come back. */
  get aborted(): boolean {
    return this.#aborted
  }
}

/**
 * One try/catch, one measurement, one verdict — for whichever of the two calls is being made.
 *
 * THE CLOCK IS READ EXACTLY TWICE PER CALL: once before, once after. It would be easy to write the
 * overrun check as `budget.spent()` and let it read the clock again, and the result would be a row
 * saying an item took 4,900 ms while marking it `TIMED_OUT` — two measurements of one span, taken
 * at different instants, disagreeing in the record. The duration that is recorded is the duration
 * that is judged.
 *
 * THE ORDER OF THE VERDICTS IS `INVALID` BEFORE `TIMED_OUT`, and only one case can reach both: an
 * adapter that is already producing something unstorable and is also slow. There the shape is the
 * finding — it is a defect on every page, fast or slow — and reporting the overrun instead would
 * split one bug across two kinds, `INVALID` on the small pages and `TIMED_OUT` on the large ones,
 * which is a bug report that looks like two problems. Fix the shape and the overrun is still there
 * to be found on the next run.
 */
async function runAdapterCall<T>(
  invoke: () => Promise<unknown>,
  validate: (returned: unknown) => { ok: true; value: T } | { ok: false; error: string },
  options: AdapterCallOptions,
): Promise<AdapterCallOutcome<T>> {
  const now = options.now ?? Date.now
  const budgetMs = options.budgetMs ?? ADAPTER_CPU_BUDGET_MS
  const startedAt = now()

  let returned: unknown
  try {
    returned = await invoke()
  } catch (cause) {
    return {
      ok: false,
      kind: 'THREW',
      error: describeThrown(cause),
      durationMs: elapsedMs(startedAt, now),
    }
  }

  const durationMs = elapsedMs(startedAt, now)

  const checked = validate(returned)
  if (!checked.ok) return { ok: false, kind: 'INVALID', error: checked.error, durationMs }

  if (durationMs >= budgetMs) {
    return {
      ok: false,
      kind: 'TIMED_OUT',
      error: `The call took ${durationMs} ms, over the ${budgetMs} ms budget.`,
      durationMs,
    }
  }

  return { ok: true, value: checked.value, durationMs }
}

/** Clamped at zero, because a clock corrected mid-call must not produce a negative duration. */
function elapsedMs(startedAt: number, now: () => number): number {
  return Math.max(0, now() - startedAt)
}

/**
 * Parse what an adapter returned, and say which field was wrong when it is not.
 *
 * THE FIRST ISSUE AND THE TOTAL COUNT, WHICH IS `lib/media/manifest.ts`'s SHAPE. A page that
 * confuses an adapter confuses it in fifteen places at once, and fifteen issues in a jsonb column
 * rendered in a table is a wall nobody reads. The first issue names a field and a reason, which is
 * what somebody acts on; the count is what tells them whether it is one mistake or a shape that
 * never matched.
 */
function validateWith<T>(
  schema: z.ZodType<T>,
  returned: unknown,
  subject: string,
): { ok: true; value: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(returned)
  if (parsed.success) return { ok: true, value: parsed.data }

  const first = parsed.error.issues[0]
  const path = first?.path.join('.')
  return {
    ok: false,
    error: truncate(
      `The adapter's ${subject} does not match the schema: ` +
        `${path === undefined || path === '' ? '(root)' : path} — ` +
        `${first?.message ?? 'unknown issue'}. ${parsed.error.issues.length} issue(s) total.`,
    ),
  }
}

/**
 * A thrown value, as one bounded line.
 *
 * THE MESSAGE, NEVER THE STACK. A stack names the deployment's file paths and the shape of the
 * build, it is the longest part of any error, and it is not what an operator reading a run detail
 * screen acts on — they act on which page failed and what the adapter said about it. Whoever is
 * debugging the adapter has the fixtures and a local run.
 *
 * READING THE MESSAGE IS ITSELF WRAPPED, WHICH IS NOT PARANOIA. `catch` binds whatever was thrown:
 * a string, `undefined`, an object with a getter that throws, an object whose `toString` throws.
 * This function is called only on a path where something has already gone wrong, and a boundary
 * that could throw while describing a failure is a boundary that fails open on exactly the input
 * it was built for.
 *
 * WHITESPACE IS COLLAPSED so a multi-line message stays one row in the errors list, and the whole
 * is truncated so a page body interpolated into an exception cannot reach jsonb.
 */
function describeThrown(cause: unknown): string {
  let text: string
  try {
    text = cause instanceof Error ? `${cause.name}: ${cause.message}` : `Adapter threw: ${cause}`
  } catch {
    text = 'Adapter threw a value whose own description could not be read.'
  }

  const collapsed = text.replace(/\s+/g, ' ').trim()
  return truncate(collapsed === '' ? 'Adapter threw a value with no description.' : collapsed)
}

function truncate(text: string): string {
  return text.length <= MAX_ERROR_LENGTH ? text : `${text.slice(0, MAX_ERROR_LENGTH - 1)}…`
}

/**
 * One discovered URL, as this boundary will admit it.
 *
 * `isHttpReference` RATHER THAN A SECOND REGULAR EXPRESSION. `adapters/draft-schema.ts` already
 * answers "is this one of the two schemes this subsystem admits", for image references; a URL about
 * to be queued asks the identical question, and two copies of it would drift the day either grew a
 * case. `.strict()` for `core/raw.ts`'s reason: an extra key here is a discovery pass inventing a
 * field that nothing downstream reads and nobody reviewed.
 */
const discoveredUrlSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(MAX_DISCOVERED_URL_LENGTH)
      .refine((value) => isHttpReference(value), {
        message: 'Only http and https URLs are queued, and nothing else is followed.',
      }),
    /** The matcher's answer, passed through. `null` is honest for a URL the patterns do not name. */
    kind: z.string().trim().max(MAX_URL_KIND_LENGTH).nullable(),
  })
  .strict()

const discoveredUrlsSchema = z.array(discoveredUrlSchema).max(MAX_LINKS_PER_PAGE).readonly()
