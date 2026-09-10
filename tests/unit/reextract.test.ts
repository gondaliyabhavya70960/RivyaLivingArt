import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { emptyDraft, withField, type RawProductDraft } from '@/lib/scraper/adapters/draft-schema'
import type { FetchedPage } from '@/lib/scraper/adapters/types'
import { draftContentHash } from '@/lib/scraper/core/content-hash'
import type { AdapterCallOutcome } from '@/lib/scraper/core/run-adapter'
import {
  DEFAULT_REPLAY_LIMIT,
  MAX_REPLAY_LIMIT,
  parseArgs,
  plan,
  reextract,
  selectSnapshots,
  type PlanPorts,
  type ReextractOptions,
  type ReplayDecision,
  type StoredSnapshot,
  type WritePorts,
} from '@/scripts/research/reextract'

/**
 * `scripts/research/reextract.ts`, exercised without a database, a bucket, a network or an adapter.
 *
 * THE SCRIPT IS SPLIT SO THAT THIS SUITE IS POSSIBLE, AND THE SPLIT IS THE CLAIM WORTH TESTING.
 * `parseArgs` returns a result instead of exiting; `selectSnapshots` is pure; `plan()` is handed
 * three READING ports and has no way to write; and `reextract()` is the only function that reaches
 * a writer at all. So "`--dry-run` writes nothing" is checked below as a fact about which function
 * was reached, not as a flag somebody remembered to consult — and the same shape is what
 * `renormalize.ts` (Phase 28) and `reclassify-scale.ts` (Phase 30) are expected to follow.
 *
 * THE LAST BLOCK IS A STATIC READ OF THE SCRIPT'S OWN TEXT, AND A STATIC CHECK IS THE RIGHT SHAPE
 * THERE. The guarantee is that a replay makes no request, and today it holds trivially — the file
 * imports nothing that could make one. What that leaves unprotected is the FUTURE EDIT: somebody
 * adding "and if the snapshot was pruned, just re-read the page", which would be a defensible-
 * looking three lines that quietly turns an offline validation tool into a crawler running at
 * whatever rate a developer's loop happens to run at, outside the kill switch, the policy review,
 * `core/robots.ts` and the source's politeness clock. A behavioural test cannot catch that, because
 * the edit would come with its own passing test. Reading the file can.
 *
 * EVERY HOST IS `example.com`-RESERVED AND EVERY PRODUCT NAME IS INVENTED. No competitor is named
 * anywhere in this repository, and a fixture is as public as a predicate.
 */

/* --- Fixtures ----------------------------------------------------------------------------------- */

const PRODUCT_URL = 'https://shop.example.com/tables/low-table-ash'
const OTHER_URL = 'https://shop.example.com/tables/side-table-elm'

function options(overrides: Partial<ReextractOptions> = {}): ReextractOptions {
  return {
    sourceSlug: 'fixture-source',
    since: null,
    dryRun: false,
    limit: DEFAULT_REPLAY_LIMIT,
    ...overrides,
  }
}

function snapshot(overrides: Partial<StoredSnapshot> = {}): StoredSnapshot {
  return {
    fetchId: 'fetch-1',
    url: PRODUCT_URL,
    storageKey: 'research/fixture-source/2026/03/01/aaaa.html.gz',
    bodyHash: 'aaaa',
    fetchedAt: '2026-03-01T09:00:00.000Z',
    ...overrides,
  }
}

/** A draft with one field found, which is enough for a content hash to be a real one. */
function draftTitled(title: string): RawProductDraft {
  return withField(emptyDraft(), 'title', title, 'jsonld')
}

const CURRENT_DRAFT = draftTitled('Low Table, Ash')
const CURRENT_HASH = draftContentHash(CURRENT_DRAFT)

function extracted(draft: RawProductDraft): AdapterCallOutcome<RawProductDraft> {
  return { ok: true, value: draft, durationMs: 12 }
}

/**
 * Ports that answer every reasonable question, plus a recorder for the one write there is.
 *
 * THE WRITER RECORDS RATHER THAN COUNTS, so an assertion can say WHICH decision was written and not
 * merely how many. A dry run that wrote the wrong version once and a dry run that wrote nothing are
 * the same number and very different facts.
 */
function makePorts(
  overrides: Partial<PlanPorts> = {},
): PlanPorts & WritePorts & { readonly written: ReplayDecision[]; readonly pages: FetchedPage[] } {
  const written: ReplayDecision[] = []
  const pages: FetchedPage[] = []

  return {
    written,
    pages,
    loadSnapshot: async () => '<html lang="en"><body>Low Table, Ash</body></html>',
    extract: async (page: FetchedPage) => {
      pages.push(page)
      return extracted(draftTitled('Low Table, Ash — 2026 revision'))
    },
    readProduct: async () => ({ id: 'product-1', currentContentHash: CURRENT_HASH }),
    writeVersion: async (decision: ReplayDecision) => {
      written.push(decision)
      return true
    },
    ...overrides,
  }
}

/* --- parseArgs ---------------------------------------------------------------------------------- */

describe('parseArgs', () => {
  it('refuses an invocation with no --source, because there is no "every source" replay', () => {
    const parsed = parseArgs(['--dry-run'])

    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('--source')
  })

  it('refuses --source= with nothing after it', () => {
    const parsed = parseArgs(['--source='])

    expect(parsed.ok).toBe(false)
  })

  it('reads a full invocation', () => {
    const parsed = parseArgs([
      '--source=fixture-source',
      '--since=2026-01-01',
      '--dry-run',
      '--limit=5',
    ])

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.sourceSlug).toBe('fixture-source')
    expect(parsed.value.dryRun).toBe(true)
    expect(parsed.value.limit).toBe(5)
    // UTC MIDNIGHT, NOT THE OPERATOR'S MIDNIGHT — the column is `timestamptz` rendered in UTC, and
    // a local reading would replay a different set of snapshots on a different machine.
    expect(parsed.value.since?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('defaults to writing, no window, and the standard limit', () => {
    const parsed = parseArgs(['--source=fixture-source'])

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.dryRun).toBe(false)
    expect(parsed.value.since).toBeNull()
    expect(parsed.value.limit).toBe(DEFAULT_REPLAY_LIMIT)
  })

  it.each(['--since=01-01-2026', '--since=2026-1-1', '--since=2026-02-30', '--since=yesterday'])(
    'refuses %s',
    (arg) => {
      expect(parseArgs(['--source=fixture-source', arg]).ok).toBe(false)
    },
  )

  it.each([
    '--limit=0',
    '--limit=-1',
    '--limit=2.5',
    '--limit=50x',
    `--limit=${MAX_REPLAY_LIMIT + 1}`,
  ])('refuses %s', (arg) => {
    expect(parseArgs(['--source=fixture-source', arg]).ok).toBe(false)
  })

  /**
   * THE ASSERTION THIS FILE EXISTS FOR MOST. An unknown token silently ignored means `--dryrun`
   * runs the writing path while its author believes they asked for a report, and nothing in the
   * output says otherwise.
   */
  it('refuses a misspelt --dry-run rather than ignoring it', () => {
    const parsed = parseArgs(['--source=fixture-source', '--dryrun'])

    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('--dryrun')
  })

  it('refuses a space-separated value, because --source --dry-run must not name a source', () => {
    expect(parseArgs(['--source', 'fixture-source']).ok).toBe(false)
  })
})

/* --- selectSnapshots ---------------------------------------------------------------------------- */

describe('selectSnapshots', () => {
  it('drops snapshots fetched before --since and keeps the rest', () => {
    const selected = selectSnapshots(
      [
        snapshot({ fetchId: 'a', fetchedAt: '2025-12-31T23:59:59.999Z', storageKey: 'key-a' }),
        snapshot({ fetchId: 'b', fetchedAt: '2026-01-01T00:00:00.000Z', storageKey: 'key-b' }),
        snapshot({ fetchId: 'c', fetchedAt: '2026-02-14T10:00:00.000Z', storageKey: 'key-c' }),
      ],
      options({ since: new Date('2026-01-01T00:00:00.000Z') }),
    )

    // The boundary is inclusive: a snapshot taken at exactly the instant asked for is inside it.
    expect(selected.map((entry) => entry.fetchId)).toEqual(['c', 'b'])
  })

  it('returns the newest first, so --limit means "the most recent N"', () => {
    const selected = selectSnapshots(
      [
        snapshot({ fetchId: 'old', fetchedAt: '2026-01-01T00:00:00.000Z', storageKey: 'key-old' }),
        snapshot({ fetchId: 'new', fetchedAt: '2026-03-01T00:00:00.000Z', storageKey: 'key-new' }),
        snapshot({ fetchId: 'mid', fetchedAt: '2026-02-01T00:00:00.000Z', storageKey: 'key-mid' }),
      ],
      options(),
    )

    expect(selected.map((entry) => entry.fetchId)).toEqual(['new', 'mid', 'old'])
  })

  /**
   * A snapshot key is content-addressed, so an unchanged page fetched nightly is the SAME object
   * recorded many times. Replaying each row would decompress identical bytes once per night of
   * history and spend the whole limit on one page.
   */
  it('replays one page per (url, key) pair, keeping the newest sighting', () => {
    const selected = selectSnapshots(
      [
        snapshot({ fetchId: 'monday', fetchedAt: '2026-03-02T03:00:00.000Z' }),
        snapshot({ fetchId: 'sunday', fetchedAt: '2026-03-01T03:00:00.000Z' }),
        snapshot({ fetchId: 'saturday', fetchedAt: '2026-02-28T03:00:00.000Z' }),
      ],
      options(),
    )

    expect(selected).toHaveLength(1)
    expect(selected[0]?.fetchId).toBe('monday')
  })

  it('keeps two URLs that happen to share one key, because each is a different product', () => {
    const selected = selectSnapshots(
      [
        snapshot({ fetchId: 'one', url: PRODUCT_URL }),
        snapshot({ fetchId: 'two', url: OTHER_URL }),
      ],
      options(),
    )

    expect(selected.map((entry) => entry.url).sort()).toEqual([OTHER_URL, PRODUCT_URL].sort())
  })

  it('caps at --limit after de-duplicating, not before', () => {
    const selected = selectSnapshots(
      [
        snapshot({ fetchId: 'a1', fetchedAt: '2026-03-03T00:00:00.000Z' }),
        snapshot({ fetchId: 'a2', fetchedAt: '2026-03-02T00:00:00.000Z' }),
        snapshot({ fetchId: 'b1', url: OTHER_URL, fetchedAt: '2026-03-01T00:00:00.000Z' }),
      ],
      options({ limit: 2 }),
    )

    expect(selected.map((entry) => entry.fetchId)).toEqual(['a1', 'b1'])
  })
})

/* --- plan and reextract -------------------------------------------------------------------------- */

describe('plan', () => {
  it('hands the adapter a page with the stored key and hash and no HTTP status', async () => {
    const ports = makePorts()

    await plan(ports, [snapshot()], options())

    expect(ports.pages).toHaveLength(1)
    const page = ports.pages[0]
    expect(page?.url).toBe(PRODUCT_URL)
    // A replay has bytes and no response: `httpStatus` is null because nothing answered, while the
    // key and the body hash are recorded facts about where the bytes came from.
    expect(page?.httpStatus).toBeNull()
    expect(page?.storageKey).toBe('research/fixture-source/2026/03/01/aaaa.html.gz')
    expect(page?.contentHash).toBe('aaaa')
  })

  it('proposes a version when the draft differs from the stored current version', async () => {
    const decisions = await plan(makePorts(), [snapshot()], options())

    expect(decisions.map((decision) => decision.verdict)).toEqual(['NEW_VERSION'])
    expect(decisions[0]?.productId).toBe('product-1')
    expect(decisions[0]?.contentHash).not.toBe(CURRENT_HASH)
  })

  it('proposes nothing when the adapter reads exactly what is already stored', async () => {
    const decisions = await plan(
      makePorts({ extract: async () => extracted(CURRENT_DRAFT) }),
      [snapshot()],
      options(),
    )

    expect(decisions.map((decision) => decision.verdict)).toEqual(['UNCHANGED'])
  })

  /**
   * The 180-day pruner removes bodies and keeps the fetch rows, so a replay over old history meets
   * this constantly. It is a verdict about the EVIDENCE and is reported apart from any verdict
   * about the adapter — folding it into `FAILED` would blame a parser for a pruned object.
   */
  it('records an unreadable snapshot without calling the adapter', async () => {
    const ports = makePorts({ loadSnapshot: async () => null })

    const decisions = await plan(ports, [snapshot()], options())

    expect(decisions.map((decision) => decision.verdict)).toEqual(['UNREADABLE'])
    expect(ports.pages).toHaveLength(0)
  })

  it('records an adapter failure as its own verdict, with the kind and the reason', async () => {
    const decisions = await plan(
      makePorts({
        extract: async () => ({
          ok: false,
          kind: 'THREW',
          error: 'TypeError: cannot read property of null',
          durationMs: 3,
        }),
      }),
      [snapshot()],
      options(),
    )

    expect(decisions[0]?.verdict).toBe('FAILED')
    expect(decisions[0]?.detail).toContain('THREW')
  })

  /**
   * A snapshot whose URL has never produced a product is a page the pipeline has not accepted as a
   * product. Admitting one here would turn a validation exercise into an import, which FEAT §25
   * forbids outright; the count is reported instead, because it is exactly what an adapter fix is
   * trying to change.
   */
  it('never invents a product for a URL nothing was recorded against', async () => {
    const ports = makePorts({ readProduct: async () => null })

    const decisions = await plan(ports, [snapshot()], options())

    expect(decisions.map((decision) => decision.verdict)).toEqual(['NO_PRODUCT'])
    expect(ports.written).toHaveLength(0)
  })

  it('keeps going after a failure, so one bad page cannot end a two-hundred-page replay', async () => {
    let call = 0
    const ports = makePorts({
      extract: async () => {
        call += 1
        return call === 1
          ? { ok: false, kind: 'INVALID', error: 'priceText: expected string', durationMs: 1 }
          : extracted(draftTitled('Side Table, Elm'))
      },
    })

    const decisions = await plan(
      ports,
      [
        snapshot({ fetchId: 'first', fetchedAt: '2026-03-02T00:00:00.000Z' }),
        snapshot({ fetchId: 'second', url: OTHER_URL, fetchedAt: '2026-03-01T00:00:00.000Z' }),
      ],
      options(),
    )

    expect(decisions.map((decision) => decision.verdict)).toEqual(['FAILED', 'NEW_VERSION'])
  })
})

describe('reextract', () => {
  it('writes nothing at all on a dry run, and still reports what it would write', async () => {
    const ports = makePorts()

    const report = await reextract(ports, [snapshot()], options({ dryRun: true }))

    expect(report.newVersions).toBe(1)
    expect(report.written).toBe(0)
    expect(ports.written).toHaveLength(0)
  })

  it('writes exactly the decisions it proposed when the dry-run flag is absent', async () => {
    const ports = makePorts()

    const report = await reextract(ports, [snapshot()], options())

    expect(report.written).toBe(1)
    expect(ports.written).toHaveLength(1)
    expect(ports.written[0]?.productId).toBe('product-1')
  })

  it('writes nothing for an unchanged page, in either mode', async () => {
    const ports = makePorts({ extract: async () => extracted(CURRENT_DRAFT) })

    const report = await reextract(ports, [snapshot()], options())

    expect(report.unchanged).toBe(1)
    expect(report.written).toBe(0)
    expect(ports.written).toHaveLength(0)
  })

  /**
   * `research_product_versions_unique_content` deduplicates against the WHOLE history, so a draft
   * equal to some older version is refused at the row even though the plan proposed it. The gap
   * between "proposed" and "written" is reported rather than rounded away.
   */
  it('counts a write the constraint refused without treating it as an error', async () => {
    const ports = makePorts({})
    const report = await reextract(
      { ...ports, writeVersion: async () => false },
      [snapshot()],
      options(),
    )

    expect(report.newVersions).toBe(1)
    expect(report.written).toBe(0)
  })

  it('counts every verdict, so a report can be compared across two adapter versions', async () => {
    const ports = makePorts({
      loadSnapshot: async (entry) => (entry.fetchId === 'gone' ? null : '<html lang="en"></html>'),
      readProduct: async (url) =>
        url === OTHER_URL ? null : { id: 'product-1', currentContentHash: CURRENT_HASH },
    })

    const report = await reextract(
      ports,
      [
        snapshot({
          fetchId: 'gone',
          fetchedAt: '2026-03-03T00:00:00.000Z',
          storageKey: 'key-gone',
        }),
        snapshot({
          fetchId: 'orphan',
          url: OTHER_URL,
          fetchedAt: '2026-03-02T00:00:00.000Z',
          storageKey: 'key-orphan',
        }),
        snapshot({
          fetchId: 'live',
          fetchedAt: '2026-03-01T00:00:00.000Z',
          storageKey: 'key-live',
        }),
      ],
      options(),
    )

    expect(report.considered).toBe(3)
    expect(report.replayed).toBe(3)
    expect(report.unreadable).toBe(1)
    expect(report.withoutProduct).toBe(1)
    expect(report.newVersions).toBe(1)
    expect(report.written).toBe(1)
  })
})

/* --- The claim that matters --------------------------------------------------------------------- */

/**
 * The script's own text, read off disk.
 *
 * THE CHECK IS DELIBERATELY BLUNT AND IT RUNS OVER THE RAW FILE, COMMENTS INCLUDED. A stripper that
 * removed comments first would be a second, subtler thing to get right — and it would leave a
 * reviewer adjudicating whether a given occurrence is live code. `reextract.ts` does not name the
 * call anywhere, so there is nothing to adjudicate: the file either contains those characters or it
 * does not, and if a future edit puts them in a comment, failing is the correct outcome.
 */
describe('the no-request guarantee', () => {
  const SCRIPT_PATH = join(process.cwd(), 'scripts', 'research', 'reextract.ts')
  const SOURCE = readFileSync(SCRIPT_PATH, 'utf8')

  /**
   * `fetch(`, `globalThis.fetch(` and `Fetch(` — but not `listFetchesForRun(`, which is a
   * repository read of the `research_fetches` table and is exactly what this script is for. The
   * lookbehind is what separates the two: an identifier ending in `fetch` is somebody else's word.
   */
  const REQUEST_CALL = /(?<![A-Za-z0-9_$])fetch\s*\(/i

  /**
   * Every module that could make a request. `lib/scraper/core/fetch` is first because it is the
   * plausible mistake: it is Rivya's own polite fetcher, it is already in the import graph of the
   * drain loop, and importing it here would look like reuse rather than like a crawler.
   */
  const FORBIDDEN_MODULES = [
    'lib/scraper/core/fetch',
    'scraper/core/fetch',
    'undici',
    'axios',
    'node-fetch',
    'cross-fetch',
    'got',
    'node:http',
    'node:https',
    'http',
    'https',
  ]

  function importedSpecifiers(source: string): readonly string[] {
    const specifiers: string[] = []
    for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      if (match[1] !== undefined) specifiers.push(match[1])
    }
    for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) {
      if (match[1] !== undefined) specifiers.push(match[1])
    }
    return specifiers
  }

  it('never calls the global request function', () => {
    expect(REQUEST_CALL.test(SOURCE)).toBe(false)
  })

  it('imports no fetcher and no HTTP client', () => {
    const offending = importedSpecifiers(SOURCE).filter((specifier) =>
      FORBIDDEN_MODULES.some(
        (forbidden) => specifier === forbidden || specifier.endsWith(`/${forbidden}`),
      ),
    )

    expect(offending).toEqual([])
  })

  /**
   * The sentence the phase document asks this family of scripts to carry. It is asserted rather
   * than trusted because the header is the only place a reader learns WHY the file may not grow a
   * request, and a header that drifts from the rule above is worse than no header.
   */
  it('says in its own header that re-derivation is from stored evidence, never a re-fetch', () => {
    expect(SOURCE).toContain('STORED EVIDENCE')
    expect(SOURCE).toContain('never from a re-fetch')
  })
})
