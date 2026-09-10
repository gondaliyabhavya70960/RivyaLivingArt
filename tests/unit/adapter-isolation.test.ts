import { describe, expect, it } from 'vitest'

import { emptyDraft, withField, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import type {
  AdapterContext,
  DiscoveredUrl,
  FetchedPage,
  SourceAdapter,
} from '@/lib/scraper/adapters/types'
import { MAX_LINKS_PER_PAGE } from '@/lib/scraper/core/raw'
import {
  ADAPTER_CPU_BUDGET_MS,
  CONSECUTIVE_FAILURE_ABORT,
  makeBudget,
  runAdapterDiscover,
  runAdapterExtract,
  SourceFailureTracker,
  type AdapterCallOutcome,
} from '@/lib/scraper/core/run-adapter'

/**
 * FEAT §27's defining constraint — "a broken source adapter must not break other sources" — proved
 * rather than asserted.
 *
 * THE CLAIM IS ABOUT A BOUNDARY, SO BOTH ADAPTERS IN THIS FILE ARE WRITTEN IN THIS FILE. Source A's
 * adapter throws on every item; source B's returns a perfectly ordinary draft. Neither is the
 * `generic` adapter, deliberately: borrowing it would make a change to somebody's JSON-LD parsing
 * able to fail an isolation test, and — worse in the other direction — a genuine isolation failure
 * would arrive looking like an extraction bug. What is under test is `core/run-adapter.ts`, and the
 * two adapters are its inputs. `tests/unit/adapter-contract.test.ts` is where every REGISTERED
 * adapter, generic included, is put through the shared suite.
 *
 * THE ITEMS ARE INTERLEAVED BECAUSE THE UNINTERLEAVED VERSION PROVES LESS THAN IT LOOKS. Ten
 * failures followed by ten successes would pass even if the boundary held one shared counter, one
 * shared abort flag or one shared piece of state per PROCESS rather than per source — the failures
 * would simply have finished before the successes began. Alternating A, B, A, B is the arrangement
 * where a shared anything shows up: B's first item runs immediately after A's first throw.
 *
 * THE CLOCK IS INJECTED IN EVERY CASE THAT INVOLVES TIME, so the five-second budget is proved
 * rather than waited for. A suite that spent five real seconds per timing case is a suite somebody
 * marks skipped in a fortnight.
 *
 * NOTHING HERE TOUCHES A DATABASE, A NETWORK OR AN ENVIRONMENT VARIABLE, which is the same thing
 * `core/run-adapter.ts` is: the accounting rows belong to the workflow, and a boundary that also
 * wrote them would be a boundary whose own failure mode is a write.
 *
 * EVERY HOST HERE IS AN `example.`-RESERVED DOMAIN AND EVERY PRODUCT NAME IS INVENTED. No source,
 * brand, domain or price appears anywhere in this repository (D10), and a fixture is not an
 * exception to that.
 */

/** A page, as an adapter receives it: bytes that have already been read, with nothing live on them. */
function pageAt(
  url: string,
  body = '<html><body><h1>Console, Ash</h1></body></html>',
): FetchedPage {
  return { url, body, contentHash: null, storageKey: null, httpStatus: null }
}

/**
 * The context, stubbed at exactly the four members the contract grants — no client, no fetch, no
 * clock. `matchUrl` answers `null` because nothing here configures a pattern, which is the honest
 * answer for a URL the configuration says nothing about.
 */
function contextFor(slug: string, budgetSpent: () => boolean = () => false): AdapterContext {
  return {
    source: {
      slug,
      baseUrl: `https://${slug}.example`,
      currency: null,
      imageExtractionMode: 'NONE',
      priceExtraction: null,
      skuExtraction: null,
      attributeExtraction: null,
    },
    matchUrl: () => ({ kind: null, reason: 'No pattern is configured in this stub.' }),
    logger: { debug: () => undefined, warn: () => undefined },
    budgetSpent,
  }
}

/** An adapter built from one behaviour, since one behaviour is what each case is about. */
function adapterThat(
  key: string,
  extract: (ctx: AdapterContext, page: FetchedPage) => Promise<RawProductDraft>,
  discover: () => Promise<readonly DiscoveredUrl[]> = async () => [],
): SourceAdapter {
  return {
    key,
    version: '1.0.0',
    capabilities: ['EXTRACT'],
    supports: () => true,
    extract,
    discover,
  }
}

/** Source A: broken in the most ordinary way there is — it throws, every time, on every page. */
const throwingAdapter = adapterThat('alpha-fixture', async () => {
  throw new Error('The product block was not where this adapter expected it.')
})

/** Source B: an adapter having a completely normal day. */
const steadyAdapter = adapterThat('beta-fixture', async (_ctx, page) =>
  withField(emptyDraft(), 'title', `Console, Ash — ${page.url}`, 'jsonld'),
)

describe('two sources, one broken adapter, items interleaved', () => {
  /**
   * One tick of the arrangement the drain loop will build: a tracker per source, items taken in
   * turn, every call through the boundary. Nothing here is allowed to know about the other source.
   */
  async function drainInterleaved(items: number) {
    const trackerA = new SourceFailureTracker()
    const trackerB = new SourceFailureTracker()
    const ctxA = contextFor('alpha')
    const ctxB = contextFor('beta')
    const outcomesA: AdapterCallOutcome<RawProductDraft>[] = []
    const outcomesB: AdapterCallOutcome<RawProductDraft>[] = []
    const abortedAfter: number[] = []

    for (let index = 0; index < items; index += 1) {
      const a = await runAdapterExtract(
        throwingAdapter,
        ctxA,
        pageAt(`https://alpha.example/${index}`),
      )
      trackerA.record(a.ok)
      outcomesA.push(a)

      const b = await runAdapterExtract(
        steadyAdapter,
        ctxB,
        pageAt(`https://beta.example/${index}`),
      )
      trackerB.record(b.ok)
      outcomesB.push(b)

      if (trackerA.aborted) abortedAfter.push(index + 1)
    }

    return { trackerA, trackerB, outcomesA, outcomesB, firstAbortedAfter: abortedAfter[0] ?? null }
  }

  it("fails every one of A's items without touching B's, item for item", async () => {
    const { outcomesA, outcomesB } = await drainInterleaved(CONSECUTIVE_FAILURE_ABORT)

    // ITEM 1 IS THE ONE THAT MATTERS MOST. A throws first; B's very next call must be unaffected.
    expect(outcomesA[0]?.ok).toBe(false)
    expect(outcomesB[0]?.ok).toBe(true)

    expect(outcomesA.every((outcome) => !outcome.ok)).toBe(true)
    expect(outcomesB.every((outcome) => outcome.ok)).toBe(true)
  })

  it('reports the throw as THREW, with what the adapter said and how long it took', async () => {
    const { outcomesA } = await drainInterleaved(1)
    const outcome = outcomesA[0]

    expect(outcome?.ok).toBe(false)
    if (outcome === undefined || outcome.ok) throw new Error('Expected a failure to inspect.')
    expect(outcome.kind).toBe('THREW')
    expect(outcome.error).toContain('The product block was not where this adapter expected it.')
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('aborts source A after exactly ten consecutive failures, and not before', async () => {
    const nine = await drainInterleaved(CONSECUTIVE_FAILURE_ABORT - 1)
    expect(nine.trackerA.consecutiveFailures).toBe(CONSECUTIVE_FAILURE_ABORT - 1)
    expect(nine.trackerA.aborted).toBe(false)

    const ten = await drainInterleaved(CONSECUTIVE_FAILURE_ABORT)
    expect(ten.trackerA.aborted).toBe(true)
    expect(ten.firstAbortedAfter).toBe(CONSECUTIVE_FAILURE_ABORT)
  })

  it('never aborts source B, and keeps its count at zero throughout', async () => {
    // THE POINT OF THE WHOLE PHASE, IN ONE ASSERTION. A ran out of tolerance; B is untouched, and
    // its run goes on to reach SUCCEEDED while A's is recorded ABORTED.
    const { trackerB } = await drainInterleaved(CONSECUTIVE_FAILURE_ABORT * 2)
    expect(trackerB.aborted).toBe(false)
    expect(trackerB.consecutiveFailures).toBe(0)
  })

  it("hands back the draft B's adapter built, parsed rather than passed through", async () => {
    const { outcomesB } = await drainInterleaved(1)
    const outcome = outcomesB[0]

    if (outcome === undefined || !outcome.ok) throw new Error('Expected a success to inspect.')
    expect(outcome.value.title).toBe('Console, Ash — https://beta.example/0')
    expect(outcome.value.confidence.title).toBe(1)
    expect(outcome.value.provenance.title).toBe('jsonld')
    // The parsed value's lists are frozen, so an adapter that kept a reference to its own draft
    // cannot change what the core is about to hash and store.
    expect(Object.isFrozen(outcome.value.imageUrls)).toBe(true)
  })
})

describe('a draft the schema refuses', () => {
  /**
   * THE CAST IS THE POINT OF THIS ADAPTER. TypeScript already refuses a numeric `priceText`; what
   * this proves is that the BOUNDARY refuses it too, which is what stands between a vendor adapter
   * compiled somewhere else — or a rule that grew a `Number()` in a hurry — and a jsonb column full
   * of values Phase 28 will never re-parse.
   */
  const numericAdapter = adapterThat(
    'numeric-fixture',
    async () => ({ ...emptyDraft(), priceText: 1299 }) as unknown as RawProductDraft,
  )

  it('counts as INVALID, names the field, and is a failure of that item alone', async () => {
    const tracker = new SourceFailureTracker()
    const ctx = contextFor('alpha')

    const bad = await runAdapterExtract(numericAdapter, ctx, pageAt('https://alpha.example/1'))
    tracker.record(bad.ok)

    if (bad.ok) throw new Error('A parsed number must not reach a draft.')
    expect(bad.kind).toBe('INVALID')
    expect(bad.error).toContain('priceText')
    expect(tracker.consecutiveFailures).toBe(1)
    expect(tracker.aborted).toBe(false)

    // AND NOTHING ELSE. The next item, through the same tracker, succeeds and resets the count.
    const good = await runAdapterExtract(steadyAdapter, ctx, pageAt('https://alpha.example/2'))
    tracker.record(good.ok)
    expect(good.ok).toBe(true)
    expect(tracker.consecutiveFailures).toBe(0)
  })
})

describe('an adapter that overruns the CPU budget', () => {
  /** An adapter that spends `spend` milliseconds of the injected clock and then returns a good draft. */
  function slowAdapter(clock: { value: number }, spend: number): SourceAdapter {
    return adapterThat('slow-fixture', async () => {
      clock.value += spend
      return withField(emptyDraft(), 'title', 'Side Table, Elm', 'h1')
    })
  }

  it('is TIMED_OUT, and the outcome still carries the duration', async () => {
    const clock = { value: 1_000 }
    const outcome = await runAdapterExtract(
      slowAdapter(clock, ADAPTER_CPU_BUDGET_MS + 1),
      contextFor('alpha'),
      pageAt('https://alpha.example/slow'),
      { now: () => clock.value },
    )

    if (outcome.ok) throw new Error('An overrun must not be reported as a success.')
    expect(outcome.kind).toBe('TIMED_OUT')
    expect(outcome.durationMs).toBe(ADAPTER_CPU_BUDGET_MS + 1)
    // THE MEASUREMENT IS THE EVIDENCE FOR THE VERDICT, so a run that hides it cannot answer the
    // only question an operator has: was this source slow before it broke?
    expect(outcome.error).toContain(String(ADAPTER_CPU_BUDGET_MS))
  })

  it('treats a call that spends exactly the budget as having spent it', async () => {
    const clock = { value: 0 }
    const outcome = await runAdapterExtract(
      slowAdapter(clock, ADAPTER_CPU_BUDGET_MS),
      contextFor('alpha'),
      pageAt('https://alpha.example/slow'),
      { now: () => clock.value },
    )

    // The same comparison `makeBudget().spent()` makes, so what an adapter is told about its budget
    // and what the core records about it cannot disagree by a millisecond.
    expect(outcome.ok).toBe(false)
  })

  it('counts towards the ten that abort a source, which is what the budget actually buys', async () => {
    const clock = { value: 0 }
    const tracker = new SourceFailureTracker()
    const adapter = slowAdapter(clock, ADAPTER_CPU_BUDGET_MS + 1)

    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT; index += 1) {
      const outcome = await runAdapterExtract(
        adapter,
        contextFor('alpha'),
        pageAt('https://alpha.example/x'),
        {
          now: () => clock.value,
        },
      )
      tracker.record(outcome.ok)
    }

    expect(tracker.aborted).toBe(true)
  })

  it('lets a faster call through untouched', async () => {
    const clock = { value: 0 }
    const outcome = await runAdapterExtract(
      slowAdapter(clock, ADAPTER_CPU_BUDGET_MS - 1),
      contextFor('alpha'),
      pageAt('https://alpha.example/quick'),
      { now: () => clock.value },
    )

    expect(outcome.ok).toBe(true)
    expect(outcome.durationMs).toBe(ADAPTER_CPU_BUDGET_MS - 1)
  })
})

describe('the failure tracker', () => {
  it('resets on any success, because consecutive means consecutive', () => {
    // `failureStateAfter` in `core/rate-limit.ts` treats the circuit breaker the same way: a source
    // that fails nine times, extracts one, then fails nine more has not failed eighteen in a row.
    const tracker = new SourceFailureTracker()
    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT - 1; index += 1) tracker.record(false)
    expect(tracker.consecutiveFailures).toBe(CONSECUTIVE_FAILURE_ABORT - 1)

    tracker.record(true)
    expect(tracker.consecutiveFailures).toBe(0)

    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT - 1; index += 1) tracker.record(false)
    expect(tracker.aborted).toBe(false)
  })

  it('does not un-abort, because the ABORTED row has already been written', () => {
    const tracker = new SourceFailureTracker()
    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT; index += 1) tracker.record(false)
    expect(tracker.aborted).toBe(true)

    tracker.record(true)
    expect(tracker.consecutiveFailures).toBe(0)
    expect(tracker.aborted).toBe(true)
  })

  it('starts clean, so a tracker per source is a tracker per source', () => {
    const trackerA = new SourceFailureTracker()
    const trackerB = new SourceFailureTracker()
    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT; index += 1) trackerA.record(false)

    expect(trackerA.aborted).toBe(true)
    expect(trackerB.aborted).toBe(false)
    expect(trackerB.consecutiveFailures).toBe(0)
  })
})

describe('what an adapter is allowed to say when it throws', () => {
  async function failWith(thrown: unknown) {
    const adapter = adapterThat('throwing-fixture', async () => {
      throw thrown
    })
    return runAdapterExtract(adapter, contextFor('alpha'), pageAt('https://alpha.example/1'))
  }

  it('keeps a page body out of the error, because first_errors is rendered in Studio', async () => {
    const outcome = await failWith(new Error(`<div>${'x'.repeat(50_000)}</div>`))

    if (outcome.ok) throw new Error('Expected a failure.')
    expect(outcome.error.length).toBeLessThan(400)
    expect(outcome.error.endsWith('…')).toBe(true)
  })

  it('collapses a multi-line message into one row', async () => {
    const outcome = await failWith(new Error('first line\n\tsecond line'))

    if (outcome.ok) throw new Error('Expected a failure.')
    expect(outcome.error).toBe('Error: first line second line')
  })

  it('describes a value that is not an Error at all', async () => {
    const outcome = await failWith('a bare string, thrown')

    if (outcome.ok) throw new Error('Expected a failure.')
    expect(outcome.kind).toBe('THREW')
    expect(outcome.error).toContain('a bare string, thrown')
  })

  it('survives a value whose own description throws', async () => {
    // A BOUNDARY THAT COULD THROW WHILE DESCRIBING A FAILURE FAILS OPEN ON EXACTLY THE INPUT IT WAS
    // BUILT FOR. `catch` binds whatever was thrown, including an object with a hostile `toString`.
    const hostile = {
      toString() {
        throw new Error('not today')
      },
    }
    const outcome = await failWith(hostile)

    if (outcome.ok) throw new Error('Expected a failure.')
    expect(outcome.kind).toBe('THREW')
    expect(outcome.error).toContain('could not be read')
  })
})

describe('discovered URLs are parsed, not believed', () => {
  function discovering(urls: unknown): SourceAdapter {
    return adapterThat(
      'discovery-fixture',
      async () => emptyDraft(),
      async () => urls as readonly DiscoveredUrl[],
    )
  }

  async function discover(urls: unknown) {
    return runAdapterDiscover(
      discovering(urls),
      contextFor('alpha'),
      pageAt('https://alpha.example/c'),
    )
  }

  it('passes an ordinary discovery straight through', async () => {
    const outcome = await discover([
      { url: 'https://alpha.example/p/1', kind: 'PRODUCT' },
      { url: 'https://alpha.example/c/2', kind: null },
    ])

    if (!outcome.ok) throw new Error('Expected a success.')
    expect(outcome.value).toHaveLength(2)
    expect(outcome.value[0]?.kind).toBe('PRODUCT')
  })

  it('refuses a scheme this subsystem would never follow', async () => {
    // A `mailto:` in the queue is politeness spent on a fetch that cannot succeed. The boundary
    // refuses rather than repairs — cleaning belongs in the adapter, where the noise is understood.
    const outcome = await discover([{ url: 'mailto:someone@alpha.example', kind: null }])

    if (outcome.ok) throw new Error('A non-http URL must not be queued.')
    expect(outcome.kind).toBe('INVALID')
  })

  it('refuses more links than one page may contribute', async () => {
    const many = Array.from({ length: MAX_LINKS_PER_PAGE + 1 }, (_entry, index) => ({
      url: `https://alpha.example/p/${index}`,
      kind: null,
    }))

    expect((await discover(many)).ok).toBe(false)
    expect((await discover(many.slice(0, MAX_LINKS_PER_PAGE))).ok).toBe(true)
  })

  it('refuses a shape that is not a list of URLs at all, rather than throwing', async () => {
    expect((await discover('not an array')).ok).toBe(false)
    expect((await discover([{ url: 42, kind: null }])).ok).toBe(false)
    expect(
      (await discover([{ url: 'https://alpha.example/p', kind: null, title: 'extra' }])).ok,
    ).toBe(false)
  })
})

describe('the budget an adapter is handed', () => {
  it('is spent once the elapsed time reaches the budget, and not a millisecond before', () => {
    const clock = { value: 10_000 }
    const budget = makeBudget(() => clock.value)

    expect(budget.spent()).toBe(false)
    clock.value += ADAPTER_CPU_BUDGET_MS - 1
    expect(budget.spent()).toBe(false)
    clock.value += 1
    expect(budget.spent()).toBe(true)
    expect(budget.elapsed()).toBe(ADAPTER_CPU_BUDGET_MS)
  })

  it('measures one span rather than restarting when it is asked', () => {
    const clock = { value: 0 }
    const budget = makeBudget(() => clock.value)
    clock.value = 250
    expect(budget.elapsed()).toBe(250)
    clock.value = 400
    expect(budget.elapsed()).toBe(400)
  })

  it('never reports a negative elapsed, because a machine clock can be corrected under it', () => {
    const clock = { value: 5_000 }
    const budget = makeBudget(() => clock.value)
    clock.value = 1_000
    expect(budget.elapsed()).toBe(0)
    expect(budget.spent()).toBe(false)
  })

  it('takes a narrower budget when a caller has a reason for one', () => {
    const clock = { value: 0 }
    const budget = makeBudget(() => clock.value, 100)
    clock.value = 100
    expect(budget.spent()).toBe(true)
  })
})
