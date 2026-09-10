import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyDraft, withField, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import {
  registerAdapter,
  registerBuiltInAdapterImplementations,
  resetAdapters,
} from '@/lib/scraper/adapters/execution'
import type { AdapterCapability } from '@/lib/scraper/adapters/registry'
import type {
  AdapterContext,
  DiscoveredUrl,
  FetchedPage,
  SourceAdapter,
} from '@/lib/scraper/adapters/types'
import { draftContentHash } from '@/lib/scraper/core/content-hash'
import {
  CONSECUTIVE_ABORTED_RUNS_TO_OPEN_CIRCUIT,
  CONSECUTIVE_FAILURE_ABORT,
  SourceFailureTracker,
} from '@/lib/scraper/core/run-adapter'
import { extractPage } from '@/lib/scraper/workflows/extract'
import type { Database } from '@/lib/supabase/database.types'
import { MAX_FIRST_ERRORS } from '@/lib/supabase/repositories/research/adapter-runs'

import { postgrestError } from './repositories/fake-client'

/**
 * `workflows/extract.ts` driven end to end against an in-memory stand-in for PostgREST.
 *
 * WHY A LITTLE DATABASE RATHER THAN THE ONE-RESULT FAKE IN `tests/unit/repositories/fake-client.ts`.
 * That fake answers every query with the same canned result, which is exactly right for the
 * question it was built for — did this repository query the table it claims to, with the filters it
 * claims to. The question here is different and cannot be asked that way: does the SAME page
 * written twice produce ONE version. That is a claim about a unique constraint, about a conflict
 * being caught rather than raised, and about a pointer being advanced only when something was
 * created — three behaviours that only exist across several statements whose results depend on each
 * other. So the tables below hold rows, honour their real unique constraints and answer `23505`
 * with a real SQLSTATE. `postgrestError` is borrowed from that file rather than rewritten, because
 * a second definition of "what a PostgREST error looks like" is the drift these suites exist to
 * catch elsewhere.
 *
 * WHAT THIS DOES NOT COVER, STATED PLAINLY, because a fake mistaken for the real thing is worse
 * than no test. It does not prove the SQL PostgREST generates, that RLS refuses a session write to
 * either Phase 27 table, or that `research_product_versions_unique_content` exists — those need a
 * real cluster and are covered by the migrations being applied and asserted against directly. What
 * it does prove is the WORKFLOW: which rows are written, in which order, how many, and what happens
 * to each of the four failure modes FEAT §27 names.
 *
 * NO ADAPTER IN THIS FILE IS THE GENERIC ONE, for `adapter-isolation.test.ts`'s reason: borrowing it
 * would let a change to somebody's JSON-LD parsing fail a test about version writing, and a genuine
 * workflow failure would then arrive looking like an extraction bug. The adapters here return
 * drafts built by hand with `withField`, so what reaches the version table is known exactly.
 *
 * EVERY HOST IS `example.com`-RESERVED AND EVERY PRODUCT NAME IS INVENTED. No competitor is named
 * anywhere in this repository, and a fixture is as public as a predicate.
 */

/* --- The stand-in ------------------------------------------------------------------------------- */

type Row = Record<string, unknown>

interface Write {
  readonly table: string
  readonly op: 'insert' | 'update'
  readonly payload: Row
}

/**
 * The unique constraints that matter to this workflow, named as `0231` and `0250` wrote them.
 *
 * ONLY THESE THREE, because only these three change what the code does. `recordProductVersion`
 * catches the first and reports `created: false`; `recordProductSighting` and `startAdapterRun`
 * catch theirs and read back the winner's row. A fake that ignored them would let the "unchanged
 * page" test pass while writing two versions.
 */
const UNIQUE: Readonly<Record<string, readonly string[]>> = {
  research_product_versions: ['research_product_id', 'content_hash'],
  research_products: ['source_id', 'source_url'],
  research_adapter_runs: ['run_id', 'source_id', 'adapter_key'],
}

/** Column defaults that the workflow reads back after an insert it did not spell them into. */
const DEFAULTS: Readonly<Record<string, Row>> = {
  research_adapter_runs: {
    status: 'OK',
    items_seen: 0,
    items_extracted: 0,
    items_failed: 0,
    first_errors: [],
    duration_ms: 0,
    finished_at: null,
  },
  research_products: { stage: 'RAW', current_version_id: null },
  research_product_versions: { normalized: null, normalizer_version: null },
}

class FakeDatabase {
  readonly writes: Write[] = []
  readonly #tables = new Map<string, Row[]>()
  #ids = 0

  rows(table: string): readonly Row[] {
    return this.#tables.get(table) ?? []
  }

  writesTo(table: string, op: Write['op']): readonly Write[] {
    return this.writes.filter((write) => write.table === table && write.op === op)
  }

  seed(table: string, row: Row): Row {
    const stored = { id: row['id'] ?? this.#nextId(table), ...DEFAULTS[table], ...row }
    this.#rowsOf(table).push(stored)
    return stored
  }

  /**
   * Deliberately typed `never` at the seam, as `fake-client.ts` does: the repositories take a fully
   * typed `SupabaseClient` and what these tests exercise is runtime behaviour, not the types.
   */
  get client(): never {
    return { from: (table: string) => new FakeBuilder(this, table) } as never
  }

  /* Internals used by the builder. */

  rowsOf(table: string): Row[] {
    return this.#rowsOf(table)
  }

  nextId(table: string): string {
    return this.#nextId(table)
  }

  #rowsOf(table: string): Row[] {
    const existing = this.#tables.get(table)
    if (existing !== undefined) return existing
    const created: Row[] = []
    this.#tables.set(table, created)
    return created
  }

  #nextId(table: string): string {
    this.#ids += 1
    return `${table}-${this.#ids}`
  }
}

type FakeResult = { data: unknown; error: ReturnType<typeof postgrestError> | null }

class FakeBuilder implements PromiseLike<FakeResult> {
  #op: 'select' | 'insert' | 'update' = 'select'
  #payload: Row = {}
  readonly #filters: Array<[string, unknown]> = []
  readonly #orders: Array<{ column: string; ascending: boolean }> = []
  #limit: number | null = null

  constructor(
    private readonly db: FakeDatabase,
    private readonly table: string,
  ) {}

  select(..._columns: unknown[]): this {
    return this
  }

  insert(payload: Row): this {
    this.#op = 'insert'
    this.#payload = payload
    return this
  }

  update(payload: Row): this {
    this.#op = 'update'
    this.#payload = payload
    return this
  }

  eq(column: string, value: unknown): this {
    this.#filters.push([column, value])
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.#orders.push({ column, ascending: options?.ascending !== false })
    return this
  }

  limit(count: number): this {
    this.#limit = count
    return this
  }

  single(): PromiseLike<FakeResult> {
    return Promise.resolve(this.#run('single'))
  }

  maybeSingle(): PromiseLike<FakeResult> {
    return Promise.resolve(this.#run('maybeSingle'))
  }

  then<T1 = FakeResult, T2 = never>(
    onfulfilled?: ((value: FakeResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.#run('many')).then(onfulfilled, onrejected)
  }

  #run(mode: 'many' | 'single' | 'maybeSingle'): FakeResult {
    if (this.#op === 'insert') return this.#insert()
    if (this.#op === 'update') return this.#update()
    return this.#select(mode)
  }

  #insert(): FakeResult {
    const unique = UNIQUE[this.table]
    if (unique !== undefined) {
      const clash = this.db
        .rowsOf(this.table)
        .some((row) => unique.every((column) => row[column] === this.#payload[column]))
      if (clash) {
        return {
          data: null,
          error: postgrestError(
            '23505',
            `duplicate key value violates unique constraint "${this.table}_unique"`,
          ),
        }
      }
    }

    const row: Row = {
      id: this.db.nextId(this.table),
      ...DEFAULTS[this.table],
      ...this.#payload,
    }
    this.db.rowsOf(this.table).push(row)
    this.db.writes.push({ table: this.table, op: 'insert', payload: this.#payload })
    return { data: row, error: null }
  }

  #update(): FakeResult {
    for (const row of this.#matches()) Object.assign(row, this.#payload)
    this.db.writes.push({ table: this.table, op: 'update', payload: this.#payload })
    return { data: null, error: null }
  }

  #select(mode: 'many' | 'single' | 'maybeSingle'): FakeResult {
    let found = this.#matches()

    for (const { column, ascending } of [...this.#orders].reverse()) {
      found = [...found].sort((left, right) => compare(left[column], right[column], ascending))
    }
    if (this.#limit !== null) found = found.slice(0, this.#limit)

    if (mode === 'many') return { data: found, error: null }
    const first = found[0] ?? null
    if (first === null && mode === 'single') {
      // PostgREST's own code for "`.single()` matched no rows", which `toRepositoryError` maps to
      // NotFoundError. Getting this right is what makes a missing row read as missing.
      return { data: null, error: postgrestError('PGRST116', 'no rows') }
    }
    return { data: first, error: null }
  }

  #matches(): Row[] {
    return this.db
      .rowsOf(this.table)
      .filter((row) => this.#filters.every(([column, value]) => row[column] === value))
  }
}

function compare(left: unknown, right: unknown, ascending: boolean): number {
  const direction = ascending ? 1 : -1
  if (left === right) return 0
  if (left === null || left === undefined) return -direction
  if (right === null || right === undefined) return direction
  return (String(left) < String(right) ? -1 : 1) * direction
}

/* --- Fixtures ----------------------------------------------------------------------------------- */

type ResearchSourceRow = Database['public']['Tables']['research_sources']['Row']

const SOURCE_ID = 'source-1'
const RUN_ID = 'run-1'
const PAGE_URL = 'https://shop.example.com/p/low-table-ash'

function sourceRow(overrides: Partial<ResearchSourceRow> = {}): ResearchSourceRow {
  return {
    id: SOURCE_ID,
    slug: 'fixture-source',
    name: 'Fixture Source',
    base_url: 'https://shop.example.com',
    region: null,
    currency: 'EUR',
    source_type: null,
    is_enabled: true,
    adapter_key: 'test-adapter',
    rate_limit_rpm: 6,
    request_delay_ms: 10_000,
    concurrency: 1,
    next_fetch_not_before: null,
    in_flight_count: 0,
    consecutive_failures: 0,
    circuit_open_until: null,
    policy_status: 'APPROVED',
    policy_reviewed_by: null,
    policy_reviewed_at: null,
    policy_notes: null,
    status: 'DRAFT',
    created_at: '2026-09-01T00:00:00+00:00',
    updated_at: '2026-09-01T00:00:00+00:00',
    updated_by: null,
    analytics_league: null,
    collection_mode: 'SEED_URLS',
    image_extraction_mode: 'URL_ONLY',
    price_extraction: {},
    sku_extraction: {},
    attribute_extraction: {},
    notes: null,
    readiness: 'REVIEWED',
    ...overrides,
  }
}

function page(overrides: Partial<FetchedPage> = {}): FetchedPage {
  return {
    url: PAGE_URL,
    body: '<html lang="en"><head><title>Low Table, Ash</title></head><body></body></html>',
    contentHash: 'body-hash-1',
    storageKey: 'snapshots/fixture-source/body-hash-1.gz',
    httpStatus: 200,
    ...overrides,
  }
}

/** A draft as a well-behaved adapter builds one: first hit wins, provenance recorded per field. */
function draftAt(priceText: string): RawProductDraft {
  let draft = emptyDraft()
  draft = withField(draft, 'title', 'Low Table, Ash', 'jsonld')
  draft = withField(draft, 'priceText', priceText, 'jsonld')
  draft = withField(draft, 'imageUrls', ['https://cdn.example.com/low-table.jpg'], 'jsonld')
  return draft
}

interface AdapterOptions {
  readonly key?: string
  readonly version?: string
  readonly capabilities?: readonly AdapterCapability[]
  readonly extract?: (ctx: AdapterContext, fetched: FetchedPage) => Promise<RawProductDraft>
  readonly discover?: (
    ctx: AdapterContext,
    fetched: FetchedPage,
  ) => Promise<readonly DiscoveredUrl[]>
}

function makeAdapter(options: AdapterOptions = {}): SourceAdapter {
  return {
    key: options.key ?? 'test-adapter',
    version: options.version ?? '1.0.0',
    capabilities: options.capabilities ?? ['DISCOVER', 'EXTRACT'],
    supports: () => true,
    discover: options.discover ?? (async () => []),
    extract: options.extract ?? (async () => draftAt('€ 1.299,00')),
  }
}

/** One adapter run row, as `startAdapterRun` would have left it before the first item. */
function seedAdapterRun(db: FakeDatabase, overrides: Row = {}): string {
  const row = db.seed('research_adapter_runs', {
    id: 'adapter-run-1',
    run_id: RUN_ID,
    source_id: SOURCE_ID,
    adapter_key: 'test-adapter',
    adapter_version: '1.0.0',
    started_at: '2026-09-10T09:00:00+00:00',
    ...overrides,
  })
  return String(row['id'])
}

function inputFor(
  db: FakeDatabase,
  overrides: {
    readonly source?: ResearchSourceRow
    readonly page?: FetchedPage
    readonly tracker?: SourceFailureTracker
    readonly adapterRunId?: string
    readonly fetchId?: string | null
  } = {},
) {
  return {
    runId: RUN_ID,
    source: overrides.source ?? sourceRow(),
    fetchId: overrides.fetchId === undefined ? 'fetch-1' : overrides.fetchId,
    page: overrides.page ?? page(),
    adapterRunId: overrides.adapterRunId ?? seedAdapterRun(db),
    tracker: overrides.tracker ?? new SourceFailureTracker(),
  }
}

/* --- The suite ---------------------------------------------------------------------------------- */

let db: FakeDatabase
let logged: string[]

beforeEach(() => {
  db = new FakeDatabase()
  logged = []
  // `warnScraper` writes one line to the console, which on Vercel IS the cron invocation's log.
  // Capturing it is how the WARNING the phase document asks for is observable at all.
  vi.spyOn(console, 'warn').mockImplementation((line: unknown) => {
    logged.push(String(line))
  })
  resetAdapters()
})

afterEach(() => {
  vi.restoreAllMocks()
  // The register is per process, so a suite that cleared it must put the shipped adapters back or
  // every file after this one asserts against nothing.
  resetAdapters()
  registerBuiltInAdapterImplementations()
})

describe('a page nobody has read before', () => {
  it('writes exactly one version', async () => {
    registerAdapter(makeAdapter())
    await extractPage(db.client, inputFor(db))

    expect(db.rows('research_product_versions')).toHaveLength(1)
  })

  it('advances current_version_id to the version it wrote', async () => {
    registerAdapter(makeAdapter())
    await extractPage(db.client, inputFor(db))

    const version = db.rows('research_product_versions')[0]
    const product = db.rows('research_products')[0]
    expect(product?.['current_version_id']).toBe(version?.['id'])
  })

  it('stamps the version with the adapter key and version that produced it', async () => {
    registerAdapter(makeAdapter({ key: 'test-adapter', version: '2.3.1' }))
    await extractPage(db.client, inputFor(db))

    const version = db.rows('research_product_versions')[0]
    expect(version?.['adapter_key']).toBe('test-adapter')
    expect(version?.['adapter_version']).toBe('2.3.1')
  })

  it('carries the snapshot key and the fetch it was read from', async () => {
    registerAdapter(makeAdapter())
    await extractPage(db.client, inputFor(db))

    const version = db.rows('research_product_versions')[0]
    expect(version?.['storage_key']).toBe('snapshots/fixture-source/body-hash-1.gz')
    expect(version?.['fetch_id']).toBe('fetch-1')
    expect(version?.['run_id']).toBe(RUN_ID)
  })

  it('hashes the draft, not the page body', async () => {
    registerAdapter(makeAdapter())
    await extractPage(db.client, inputFor(db))

    const version = db.rows('research_product_versions')[0]
    expect(version?.['content_hash']).toBe(draftContentHash(draftAt('€ 1.299,00')))
    expect(version?.['content_hash']).not.toBe('body-hash-1')
  })

  it('writes the raw item as the DRAFT, not Phase 25 three-key shape', async () => {
    registerAdapter(makeAdapter())
    await extractPage(db.client, inputFor(db))

    const item = db.rows('research_raw_items')[0]
    const raw = item?.['raw'] as Record<string, unknown>
    expect(Object.keys(raw)).toContain('provenance')
    expect(Object.keys(raw)).toContain('confidence')
    expect(Object.keys(raw)).not.toContain('links')
    expect(raw['priceText']).toBe('€ 1.299,00')
  })

  it('sights the product at the URL the bytes came from, never at a claimed canonical', async () => {
    registerAdapter(
      makeAdapter({
        // A page claiming a RELATIVE canonical — which the draft schema stores unresolved, and
        // which would name no page at all if it were used as an identity.
        extract: async () => withField(draftAt('€ 1.299,00'), 'canonicalUrl', '/p/other', 'jsonld'),
      }),
    )
    await extractPage(db.client, inputFor(db))

    expect(db.rows('research_products')[0]?.['source_url']).toBe(PAGE_URL)
  })

  it('counts the item as seen and extracted', async () => {
    registerAdapter(makeAdapter())
    await extractPage(db.client, inputFor(db))

    const run = db.rows('research_adapter_runs')[0]
    expect(run?.['items_seen']).toBe(1)
    expect(run?.['items_extracted']).toBe(1)
    expect(run?.['items_failed']).toBe(0)
  })

  it('returns one extraction and no failure', async () => {
    registerAdapter(makeAdapter())
    const outcome = await extractPage(db.client, inputFor(db))

    expect(outcome).toMatchObject({ extracted: 1, failed: 0 })
  })
})

describe('the same page, read twice', () => {
  it('writes ONE version, because an unchanged page is not a new observation', async () => {
    registerAdapter(makeAdapter())
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    await extractPage(db.client, shared)

    expect(db.rows('research_product_versions')).toHaveLength(1)
  })

  it('does not advance current_version_id a second time', async () => {
    registerAdapter(makeAdapter())
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    await extractPage(db.client, shared)

    const pointerWrites = db
      .writesTo('research_products', 'update')
      .filter((write) => 'current_version_id' in write.payload)
    expect(pointerWrites).toHaveLength(1)
  })

  it('still counts the second item as extracted — nothing failed', async () => {
    registerAdapter(makeAdapter())
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    await extractPage(db.client, shared)

    const run = db.rows('research_adapter_runs')[0]
    expect(run?.['items_seen']).toBe(2)
    expect(run?.['items_extracted']).toBe(2)
  })

  it('creates one product row, updating the last-seen pair on the second sighting', async () => {
    registerAdapter(makeAdapter())
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    await extractPage(db.client, shared)

    expect(db.rows('research_products')).toHaveLength(1)
    expect(db.rows('research_products')[0]?.['last_seen_run_id']).toBe(RUN_ID)
  })
})

describe('a page whose price has changed', () => {
  it('writes a second version', async () => {
    let price = '€ 1.299,00'
    registerAdapter(makeAdapter({ extract: async () => draftAt(price) }))
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    price = '€ 1.199,00'
    await extractPage(db.client, shared)

    expect(db.rows('research_product_versions')).toHaveLength(2)
  })

  it('advances current_version_id to the new one', async () => {
    let price = '€ 1.299,00'
    registerAdapter(makeAdapter({ extract: async () => draftAt(price) }))
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    price = '€ 1.199,00'
    await extractPage(db.client, shared)

    const newest = db.rows('research_product_versions')[1]
    expect(db.rows('research_products')[0]?.['current_version_id']).toBe(newest?.['id'])
  })

  it('keeps the earlier version untouched — the table is append-only', async () => {
    let price = '€ 1.299,00'
    registerAdapter(makeAdapter({ extract: async () => draftAt(price) }))
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    price = '€ 1.199,00'
    await extractPage(db.client, shared)

    const first = db.rows('research_product_versions')[0]
    expect((first?.['raw'] as Record<string, unknown>)['priceText']).toBe('€ 1.299,00')
    expect(db.writesTo('research_product_versions', 'update')).toHaveLength(0)
  })

  it('reverting to a price seen before writes no third version', async () => {
    let price = '€ 1.299,00'
    registerAdapter(makeAdapter({ extract: async () => draftAt(price) }))
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    price = '€ 1.199,00'
    await extractPage(db.client, shared)
    price = '€ 1.299,00'
    await extractPage(db.client, shared)

    expect(db.rows('research_product_versions')).toHaveLength(2)
  })
})

describe('an adapter that throws', () => {
  const throwing = () =>
    makeAdapter({
      extract: async () => {
        throw new Error('Cannot read the price block.')
      },
    })

  it('records an item failure and writes no version', async () => {
    registerAdapter(throwing())
    const outcome = await extractPage(db.client, inputFor(db))

    expect(outcome).toMatchObject({ extracted: 0, failed: 1 })
    expect(db.rows('research_product_versions')).toHaveLength(0)
  })

  it('writes no raw item and no product either — nothing was read', async () => {
    registerAdapter(throwing())
    await extractPage(db.client, inputFor(db))

    expect(db.rows('research_raw_items')).toHaveLength(0)
    expect(db.rows('research_products')).toHaveLength(0)
  })

  it('appends the reason and the URL to first_errors', async () => {
    registerAdapter(throwing())
    await extractPage(db.client, inputFor(db))

    const errors = db.rows('research_adapter_runs')[0]?.['first_errors'] as Array<
      Record<string, unknown>
    >
    expect(errors).toHaveLength(1)
    expect(errors[0]?.['url']).toBe(PAGE_URL)
    expect(String(errors[0]?.['message'])).toContain('Cannot read the price block.')
  })

  it('never throws out of extractPage, whatever the adapter threw', async () => {
    registerAdapter(
      makeAdapter({
        extract: async () => {
          // Not an Error. `describeThrown` in `core/run-adapter.ts` is what makes this safe.
          throw 'a bare string'
        },
      }),
    )

    await expect(extractPage(db.client, inputFor(db))).resolves.toMatchObject({ failed: 1 })
  })

  it('stops recording errors at five while the count stays exact', async () => {
    registerAdapter(throwing())
    const shared = inputFor(db)

    for (let index = 0; index < MAX_FIRST_ERRORS + 3; index += 1) {
      await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-${index}` }) })
    }

    const run = db.rows('research_adapter_runs')[0]
    expect(run?.['first_errors']).toHaveLength(MAX_FIRST_ERRORS)
    expect(run?.['items_failed']).toBe(MAX_FIRST_ERRORS + 3)
  })

  it('aborts the source once ten items in a row have failed, and says so once', async () => {
    registerAdapter(throwing())
    const shared = inputFor(db)

    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT + 2; index += 1) {
      await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-${index}` }) })
    }

    expect(db.rows('research_adapter_runs')[0]?.['status']).toBe('ABORTED')
    const statusWrites = db
      .writesTo('research_adapter_runs', 'update')
      .filter((write) => write.payload['status'] === 'ABORTED')
    expect(statusWrites).toHaveLength(1)
  })

  it('names no circuit on a lone abort — one stopped run is the isolation working', async () => {
    registerAdapter(throwing())
    const shared = inputFor(db)

    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT; index += 1) {
      await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-${index}` }) })
    }

    expect(logged.some((line) => line.includes('research.adapter_aborted'))).toBe(true)
    expect(logged.filter((line) => line.includes('research.adapter_circuit'))).toHaveLength(0)
  })

  it('names the circuit threshold on the third consecutive aborted run', async () => {
    registerAdapter(throwing())

    // Two earlier runs of this source that already aborted. The third is the threshold.
    for (const [index, runId] of ['run-a', 'run-b'].entries()) {
      db.seed('research_adapter_runs', {
        id: `adapter-run-prior-${index}`,
        run_id: runId,
        source_id: SOURCE_ID,
        adapter_key: 'test-adapter',
        adapter_version: '1.0.0',
        status: 'ABORTED',
        started_at: `2026-09-0${index + 1}T09:00:00+00:00`,
      })
    }

    const shared = inputFor(db)
    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT; index += 1) {
      await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-${index}` }) })
    }

    expect(CONSECUTIVE_ABORTED_RUNS_TO_OPEN_CIRCUIT).toBe(3)
    expect(logged.filter((line) => line.includes('research.adapter_circuit'))).toHaveLength(1)
    expect(logged.some((line) => line.includes('adapter=test-adapter version=1.0.0'))).toBe(true)
  })
})

describe('an adapter that produces something unstorable', () => {
  it('treats a parsed number as an item failure, not as a draft', async () => {
    registerAdapter(
      makeAdapter({
        // The exact mistake `RawProductDraft` exists to refuse: a price parsed into a number.
        extract: async () =>
          ({ ...draftAt('€ 1.299,00'), priceText: 1299 }) as unknown as RawProductDraft,
      }),
    )

    const outcome = await extractPage(db.client, inputFor(db))

    expect(outcome).toMatchObject({ extracted: 0, failed: 1 })
    expect(db.rows('research_product_versions')).toHaveLength(0)
  })

  it('names the field that was wrong in first_errors', async () => {
    registerAdapter(
      makeAdapter({
        extract: async () =>
          ({ ...draftAt('€ 1.299,00'), priceText: 1299 }) as unknown as RawProductDraft,
      }),
    )
    await extractPage(db.client, inputFor(db))

    const errors = db.rows('research_adapter_runs')[0]?.['first_errors'] as Array<
      Record<string, unknown>
    >
    expect(String(errors[0]?.['message'])).toContain('priceText')
  })
})

describe('an adapter key that resolves to nothing', () => {
  it('is a FAILED adapter run rather than an exception', async () => {
    const outcome = await extractPage(
      db.client,
      inputFor(db, { source: sourceRow({ adapter_key: 'adapter-that-was-removed' }) }),
    )

    expect(outcome).toMatchObject({ extracted: 0, failed: 1, discovered: [] })
    expect(db.rows('research_adapter_runs')[0]?.['status']).toBe('FAILED')
  })

  it('records the item as seen and failed, and writes nothing else', async () => {
    await extractPage(
      db.client,
      inputFor(db, { source: sourceRow({ adapter_key: 'adapter-that-was-removed' }) }),
    )

    const run = db.rows('research_adapter_runs')[0]
    expect(run?.['items_seen']).toBe(1)
    expect(run?.['items_failed']).toBe(1)
    expect(db.rows('research_raw_items')).toHaveLength(0)
    expect(db.rows('research_product_versions')).toHaveLength(0)
  })

  it('says so in the log, naming the source and the key but no host', async () => {
    await extractPage(
      db.client,
      inputFor(db, { source: sourceRow({ adapter_key: 'adapter-that-was-removed' }) }),
    )

    const line = logged.find((entry) => entry.includes('research.adapter_unresolved'))
    expect(line).toContain('source=fixture-source')
    expect(line).toContain('adapter=adapter-that-was-removed')
    expect(line).not.toContain('shop.example.com')
  })
})

describe('discovery', () => {
  it('returns what the adapter found for the caller to queue, and queues nothing itself', async () => {
    registerAdapter(
      makeAdapter({
        discover: async () => [
          { url: 'https://shop.example.com/p/side-table-elm', kind: 'PRODUCT' },
        ],
      }),
    )

    const outcome = await extractPage(db.client, inputFor(db))

    expect(outcome.discovered).toEqual([
      { url: 'https://shop.example.com/p/side-table-elm', kind: 'PRODUCT' },
    ])
    expect(db.rows('research_work_items')).toHaveLength(0)
  })

  it('a throwing discover() costs its links and not the item', async () => {
    registerAdapter(
      makeAdapter({
        discover: async () => {
          throw new Error('The link block moved.')
        },
      }),
    )

    const outcome = await extractPage(db.client, inputFor(db))

    expect(outcome).toMatchObject({ extracted: 1, failed: 0, discovered: [] })
    expect(db.rows('research_product_versions')).toHaveLength(1)
  })

  it('but its reason still reaches the errors an operator reads', async () => {
    registerAdapter(
      makeAdapter({
        discover: async () => {
          throw new Error('The link block moved.')
        },
      }),
    )
    await extractPage(db.client, inputFor(db))

    const errors = db.rows('research_adapter_runs')[0]?.['first_errors'] as Array<
      Record<string, unknown>
    >
    expect(String(errors[0]?.['message'])).toContain('The link block moved.')
    expect(db.rows('research_adapter_runs')[0]?.['items_failed']).toBe(0)
  })

  it('is not called at all by an adapter that does not declare DISCOVER', async () => {
    let called = 0
    registerAdapter(
      makeAdapter({
        capabilities: ['EXTRACT'],
        discover: async () => {
          called += 1
          return []
        },
      }),
    )

    await extractPage(db.client, inputFor(db))
    expect(called).toBe(0)
  })
})

describe('the context an adapter is handed', () => {
  it('carries the source configuration and nothing off the row beside it', async () => {
    let seen: AdapterContext | null = null
    registerAdapter(
      makeAdapter({
        extract: async (ctx) => {
          seen = ctx
          return draftAt('€ 1.299,00')
        },
      }),
    )

    await extractPage(db.client, inputFor(db))

    const ctx = seen as unknown as AdapterContext
    expect(Object.keys(ctx).sort()).toEqual(['budgetSpent', 'logger', 'matchUrl', 'source'])
    expect(Object.keys(ctx.source).sort()).toEqual([
      'attributeExtraction',
      'baseUrl',
      'currency',
      'imageExtractionMode',
      'priceExtraction',
      'skuExtraction',
      'slug',
    ])
  })

  it('answers matchUrl from the source-s stored patterns rather than from the adapter', async () => {
    db.seed('research_source_url_patterns', {
      id: 'pattern-1',
      source_id: SOURCE_ID,
      kind: 'PRODUCT',
      pattern: '/p/*',
      is_regex: false,
      priority: 100,
    })

    let match: { kind: string | null; reason: string } | null = null
    registerAdapter(
      makeAdapter({
        extract: async (ctx) => {
          match = ctx.matchUrl('https://shop.example.com/p/side-table-elm')
          return draftAt('€ 1.299,00')
        },
      }),
    )

    await extractPage(db.client, inputFor(db))
    expect(match).toMatchObject({ kind: 'PRODUCT', reason: 'MATCHED' })
  })

  it('lets an EXCLUDE pattern refuse a URL whatever a higher-priority claim says', async () => {
    db.seed('research_source_url_patterns', {
      id: 'pattern-claim',
      source_id: SOURCE_ID,
      kind: 'PRODUCT',
      pattern: '/p/*',
      is_regex: false,
      priority: 1000,
    })
    db.seed('research_source_url_patterns', {
      id: 'pattern-refusal',
      source_id: SOURCE_ID,
      kind: 'EXCLUDE',
      pattern: '/p/archive-*',
      is_regex: false,
      priority: 0,
    })

    let match: { kind: string | null; reason: string } | null = null
    registerAdapter(
      makeAdapter({
        extract: async (ctx) => {
          match = ctx.matchUrl('https://shop.example.com/p/archive-low-table')
          return draftAt('€ 1.299,00')
        },
      }),
    )

    await extractPage(db.client, inputFor(db))
    expect(match).toMatchObject({ reason: 'EXCLUDED' })
  })

  it('routes an adapter warning to the scraper log, stamped with the source it cannot overwrite', async () => {
    registerAdapter(
      makeAdapter({
        extract: async (ctx) => {
          ctx.logger.warn('No lead time on this page.', { source: 'not-this-one', found: 3 })
          return draftAt('€ 1.299,00')
        },
      }),
    )

    await extractPage(db.client, inputFor(db))

    const line = logged.find((entry) => entry.includes('research.adapter_warning'))
    expect(line).toContain('No lead time on this page.')
    expect(line).toContain('source=fixture-source')
    expect(line).not.toContain('source=not-this-one')
    expect(line).toContain('found=3')
  })

  it('sends a debug line nowhere, because core/log.ts has no debug destination', async () => {
    registerAdapter(
      makeAdapter({
        extract: async (ctx) => {
          ctx.logger.debug('Trying the fourth strategy.')
          return draftAt('€ 1.299,00')
        },
      }),
    )

    await extractPage(db.client, inputFor(db))
    expect(logged).toHaveLength(0)
  })
})

describe('an adapter that declares no EXTRACT capability', () => {
  it('is asked for no draft, and its item is seen but neither extracted nor failed', async () => {
    let called = 0
    registerAdapter(
      makeAdapter({
        capabilities: [],
        extract: async () => {
          called += 1
          return emptyDraft()
        },
      }),
    )

    const outcome = await extractPage(db.client, inputFor(db))

    expect(called).toBe(0)
    expect(outcome).toMatchObject({ extracted: 0, failed: 0 })
    const run = db.rows('research_adapter_runs')[0]
    expect(run?.['items_seen']).toBe(1)
    expect(run?.['items_failed']).toBe(0)
  })

  it('does not count towards the ten failures that abort a source', async () => {
    registerAdapter(makeAdapter({ capabilities: [] }))
    const tracker = new SourceFailureTracker()
    const shared = inputFor(db, { tracker })

    for (let index = 0; index < CONSECUTIVE_FAILURE_ABORT + 1; index += 1) {
      await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-${index}` }) })
    }

    expect(tracker.aborted).toBe(false)
    expect(db.rows('research_adapter_runs')[0]?.['status']).toBe('OK')
  })
})

describe('accounting across the ticks one run is drained over', () => {
  it('accumulates the counters rather than resetting them', async () => {
    registerAdapter(makeAdapter())
    const shared = inputFor(db)

    await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-a` }) })
    await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-b` }) })
    await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-c` }) })

    const run = db.rows('research_adapter_runs')[0]
    expect(run?.['items_seen']).toBe(3)
    expect(run?.['items_extracted']).toBe(3)
  })

  it('leaves the row open — finished_at is not written per item', async () => {
    registerAdapter(makeAdapter())
    const shared = inputFor(db)

    await extractPage(db.client, shared)
    await extractPage(db.client, { ...shared, page: page({ url: `${PAGE_URL}-b` }) })

    expect(db.rows('research_adapter_runs')[0]?.['finished_at']).toBeNull()
  })
})
