import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { rawProductDraftSchema } from '@/lib/scraper/adapters/draft-schema'
import {
  getAdapter,
  listAdapters,
  registerAdapter,
  registerBuiltInAdapterImplementations,
  resetAdapters,
} from '@/lib/scraper/adapters/execution'
import {
  getAdapterDescriptor,
  registerBuiltInAdapters,
  type AdapterSourceView,
} from '@/lib/scraper/adapters/registry'
import { SOURCE_A_ADAPTER_KEY, sourceAAdapter } from '@/lib/scraper/adapters/source-a'
import { SOURCE_B_ADAPTER_KEY, sourceBAdapter } from '@/lib/scraper/adapters/source-b'
import type { AdapterContext, FetchedPage, SourceAdapter } from '@/lib/scraper/adapters/types'

/**
 * The suite EVERY registered adapter passes, whoever wrote it and whenever it arrived.
 *
 * IT IS SHARED BECAUSE A VENDOR ADAPTER IS THE PIECE OF THIS SUBSYSTEM MOST LIKELY TO BE WRITTEN IN
 * A HURRY, by whoever is looking at the one site it reads, against a deadline that has nothing to
 * do with the other sources. FEAT §27's answer is a contract small enough to review in ten minutes;
 * this file is what makes the contract checkable rather than merely stated. It walks the execution
 * register rather than a hand-written list, so an adapter cannot be added without being tested —
 * the failure mode of a list is that the list is what gets forgotten.
 *
 * THE FOUR CLAIMS IT MAKES, AND WHAT EACH ONE PREVENTS:
 *
 *   `supports()` IS PURE. It is called from a Server Action on every keystroke in the source drawer
 *   and its answer is a warning somebody acts on. A predicate that consulted anything, cached
 *   anything or edited its argument could disagree with itself between the drawer and the run,
 *   which is a configuration screen that looks decided when nothing was decided.
 *
 *   `extract()` NEVER THROWS ON MALFORMED INPUT. A redesigned catalogue, a stub page for a
 *   discontinued line, a truncated response and a binary body served with an HTML content type are
 *   all ordinary; a throw says "this adapter is broken", which is a different statement. Collapsing
 *   the two makes a site redesign look exactly like a bug — and it spends a source's ten-failure
 *   abort budget saying so.
 *
 *   THE DRAFT PARSES. `rawProductDraftSchema` is the trust boundary between a third party's markup
 *   and a jsonb column, and it refuses a parsed number outright. Checking it here catches the
 *   adapter that resolves a currency "just this once" at review time rather than at the write.
 *
 *   NO ADAPTER REACHES OUT OF ITS FOLDER. No database, no file system, no HTTP client, no browser
 *   automation, and no external host in any file under the tree — because an adapter is where a
 *   competitor's name would first appear in this repository (D10).
 *
 * THE SOURCE-LEVEL SCANS DELIBERATELY MIRROR `scripts/research/check-research-isolation.mjs`, which
 * is the build gate. Two rules would drift; the value of restating this one here is WHEN it fails —
 * in the suite a developer runs while writing the adapter, rather than in CI after the branch is
 * pushed. Where the two differ, this file is the wider of the two: it reads the READMEs as well,
 * because a host written in prose is as public as one written in a predicate.
 *
 * EVERY HOST HERE IS `example.`-RESERVED OR LOOPBACK, AND EVERY PRODUCT NAME IS INVENTED.
 */

const ADAPTERS_DIR = join(process.cwd(), 'lib', 'scraper', 'adapters')
const FIXTURE_ROOT = join(process.cwd(), 'tests', 'fixtures', 'scraper')

/**
 * The register, populated the way a caller populates it, plus the two placeholders.
 *
 * THE PLACEHOLDERS ARE REGISTERED HERE BECAUSE THE CONTRACT IS ABOUT ADAPTERS THIS REPOSITORY
 * SHIPS, NOT ABOUT ADAPTERS IT HAPPENS TO HAVE WIRED UP YET. `source-a` and `source-b` are two of
 * the three adapter folders FEAT §27 draws; whether `registerBuiltInAdapterImplementations()` has
 * been filled in to name them is a question about one line in `adapters/execution.ts`, and an
 * unregistered placeholder is exactly the adapter a shared suite must not stop covering. The guard
 * mirrors `registerBuiltInAdapters()`'s: ask the register per key, because `registerAdapter` throws
 * on a duplicate and this file must not be the thing that breaks when that line lands.
 */
function ensureRegistered(): readonly SourceAdapter[] {
  registerBuiltInAdapters()
  registerBuiltInAdapterImplementations()

  for (const placeholder of [sourceAAdapter, sourceBAdapter]) {
    if (getAdapter(placeholder.key) === null) registerAdapter(placeholder)
  }

  return listAdapters()
}

/**
 * Captured once, at module scope, so that one `describe` block can be generated per adapter and the
 * output names which adapter failed rather than reporting "the loop".
 */
const adapters = ensureRegistered()

afterAll(() => {
  // Leave the register as the rest of the process expects to find it. Vitest isolates test files,
  // so this is belt and braces — but a suite that mutates a module-level Map and does not put it
  // back is a suite that makes another file's failure look like its own.
  resetAdapters()
  registerBuiltInAdapterImplementations()
})

/** Bytes that have already been read, with nothing live attached. See `FetchedPage`. */
function pageOf(body: string, url = 'https://alpha.example/p/1'): FetchedPage {
  return { url, body, contentHash: null, storageKey: null, httpStatus: null }
}

/** The context, stubbed at exactly the four members the contract grants. Nothing else exists. */
function contextFor(adapter: SourceAdapter): AdapterContext {
  return {
    source: {
      slug: `${adapter.key}-fixture`,
      baseUrl: 'https://alpha.example',
      currency: null,
      imageExtractionMode: 'NONE',
      priceExtraction: null,
      skuExtraction: null,
      attributeExtraction: null,
    },
    matchUrl: () => ({ kind: null, reason: 'No pattern is configured in this stub.' }),
    logger: { debug: () => undefined, warn: () => undefined },
    budgetSpent: () => false,
  }
}

/**
 * The four shapes of page a real run meets that are not a product page.
 *
 * EACH ONE IS A REAL FAILURE MODE RATHER THAN A CURIOSITY. An empty body is a 204, a stripped
 * response or a page that rendered client-side. `'<x'` is a truncated response — `core/fetch.ts`
 * abandons a body at two megabytes mid-stream, so a cut-off document is a normal outcome of a bound
 * working. A hundred kilobytes of unclosed `<div>` is the pathological nesting that makes a parser
 * expensive, and it is what `budgetSpent()` exists for. Bytes that are not text at all are a
 * response served with an HTML content type and a binary body, which happens.
 */
const MALFORMED_PAGES: readonly { readonly name: string; readonly body: string }[] = [
  { name: 'an empty body', body: '' },
  { name: 'a truncated document', body: '<x' },
  { name: 'a hundred kilobytes of unclosed markup', body: '<div>'.repeat(20_000) },
  {
    name: 'bytes that are not text',
    body: Array.from({ length: 512 }, (_entry, index) => String.fromCharCode(index % 256)).join(''),
  },
]

/**
 * The half-written source views the create drawer really posts, plus two that are readable.
 *
 * `supports()` IS ASKED ABOUT A SOURCE THAT DOES NOT EXIST YET — `registry.ts` records why at
 * length — so the argument is whatever somebody has typed so far: an empty string, a bare host,
 * half a scheme. None of those may throw, and none may produce a different answer the second time.
 */
const SOURCE_VIEWS: readonly AdapterSourceView[] = [
  { baseUrl: 'https://alpha.example' },
  { baseUrl: 'https://beta.example/catalogue/tables' },
  { baseUrl: 'http://127.0.0.1:3000' },
  { baseUrl: '' },
  { baseUrl: 'htt' },
  { baseUrl: 'not a url at all' },
]

describe('the register the shared suite walks', () => {
  it('is not empty, so no assertion below is made against nothing', () => {
    // THE FAILURE THIS CATCHES IS A SUITE THAT PASSES BECAUSE IT TESTED NOTHING. `resetAdapters()`
    // is a real function, module side effects run once per process, and a loop over an empty list
    // is green. Every other test in this file depends on this one being true.
    expect(adapters.length).toBeGreaterThan(0)
  })

  it('holds each key exactly once, because a key is provenance', () => {
    const keys = adapters.map((adapter) => adapter.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('agrees with the descriptor register wherever both know a key', () => {
    // NOT "THE TWO REGISTERS HOLD THE SAME KEYS", DELIBERATELY, BECAUSE THEY LEGITIMATELY DO NOT.
    // `adapters/registry.ts` ships a descriptor ahead of the implementation — that is the seam it
    // exists to provide, and Phase 26 shipped the `generic` descriptor with no extractor behind it
    // — and this file registers two placeholders the picker must never offer. What must never
    // differ is the VERSION and the CAPABILITIES of a key both registers know, because those are
    // what a picker renders and what a stored row is attributed to.
    for (const adapter of adapters) {
      const descriptor = getAdapterDescriptor(adapter.key)
      if (descriptor === null) continue

      expect(descriptor.version).toBe(adapter.version)
      expect([...descriptor.capabilities].sort()).toEqual([...adapter.capabilities].sort())
    }
  })
})

describe.each(adapters.map((adapter) => [adapter.key, adapter] as const))(
  'the %s adapter',
  (_key, adapter) => {
    it('answers supports() the same way twice, for every shape a drawer posts', () => {
      for (const view of SOURCE_VIEWS) {
        const before = JSON.stringify(view)
        const first = adapter.supports(view)
        const second = adapter.supports(view)

        expect(typeof first).toBe('boolean')
        expect(second).toBe(first)
        // AND IT DOES NOT EDIT ITS ARGUMENT. A predicate that normalised the base URL in place
        // would be a predicate that changed what the caller was about to save.
        expect(JSON.stringify(view)).toBe(before)
      }
    })

    it.each(MALFORMED_PAGES.map((page) => [page.name, page.body] as const))(
      'returns a draft rather than throwing for %s',
      async (_name, body) => {
        // NO try/catch HERE ON PURPOSE. A throw fails this test with the adapter's own error and
        // its own stack, which is more useful than any message this file could add.
        const draft = await adapter.extract(contextFor(adapter), pageOf(body))
        const parsed = rawProductDraftSchema.safeParse(draft)

        expect(parsed.success).toBe(true)
      },
    )

    it('returns a draft that parses for an ordinary page too', async () => {
      const body =
        '<html><head><title>Console, Ash</title></head>' +
        '<body><h1>Console, Ash</h1><p>Two metres, solid ash.</p></body></html>'
      const parsed = rawProductDraftSchema.safeParse(
        await adapter.extract(contextFor(adapter), pageOf(body)),
      )

      expect(parsed.success).toBe(true)
    })

    it('returns discovered URLs as a list, whatever it found', async () => {
      const found = await adapter.discover(contextFor(adapter), pageOf('<a href="/p/1">One</a>'))
      expect(Array.isArray(found)).toBe(true)
    })
  },
)

describe('golden fixtures', () => {
  /** `<case>.html` under `tests/fixtures/scraper/<key>/`, counted the way FEAT §27 counts them. */
  function fixtureCount(key: string): number {
    const dir = join(FIXTURE_ROOT, key)
    if (!existsSync(dir)) return 0
    return readdirSync(dir).filter((name) => name.endsWith('.html')).length
  }

  const extracting = adapters.filter((adapter) => adapter.capabilities.includes('EXTRACT'))

  it('exempts source-a and source-b explicitly, because they claim no capability at all', () => {
    // ASSERTED RATHER THAN SKIPPED. A loop that quietly passes over the two folders it was written
    // to cover is indistinguishable from a loop that is broken, and the exemption is conditional on
    // something a future commit will change: the day a placeholder declares EXTRACT, it needs its
    // three fixtures like everybody else, and this test is what says so.
    for (const key of [SOURCE_A_ADAPTER_KEY, SOURCE_B_ADAPTER_KEY]) {
      const placeholder = getAdapter(key)
      expect(placeholder).not.toBeNull()
      expect(placeholder?.capabilities).toEqual([])
      expect(placeholder?.supports({ baseUrl: 'https://alpha.example' })).toBe(false)
    }

    expect(extracting.map((adapter) => adapter.key)).not.toContain(SOURCE_A_ADAPTER_KEY)
    expect(extracting.map((adapter) => adapter.key)).not.toContain(SOURCE_B_ADAPTER_KEY)
  })

  it('requires at least three from every adapter that claims to extract', () => {
    // Vacuous while no adapter declares EXTRACT, and that is the honest state of this phase: the
    // rule starts biting on the commit that adds the capability, which is the commit it is for.
    const short = extracting
      .map((adapter) => ({ key: adapter.key, fixtures: fixtureCount(adapter.key) }))
      .filter((entry) => entry.fixtures < 3)

    expect(short).toEqual([])
  })
})

/**
 * Everything under `lib/scraper/adapters/**`, read off disk.
 *
 * OFF DISK RATHER THAN THROUGH THE MODULE GRAPH, because what is being asserted is what the FILES
 * say. An import that is present but unused, a lazy `await import(...)`, a host inside a comment
 * and a host inside a README are all invisible to a runtime check and all count here.
 */
function filesUnder(dir: string, extensions: readonly string[]): readonly string[] {
  if (!existsSync(dir)) return []

  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...filesUnder(full, extensions))
    else if (extensions.some((extension) => entry.name.endsWith(extension))) found.push(full)
  }
  return found
}

const CODE_FILES = filesUnder(ADAPTERS_DIR, ['.ts', '.tsx'])
const ALL_FILES = filesUnder(ADAPTERS_DIR, ['.ts', '.tsx', '.md'])

/** The same two patterns `check-research-isolation.mjs` reads imports with. */
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s*['"]([^'"]+)['"]/g
const BARE_IMPORT = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g

function importsOf(file: string): readonly string[] {
  const raw = readFileSync(file, 'utf8')
  const found: string[] = []
  for (const pattern of [IMPORT, BARE_IMPORT]) {
    pattern.lastIndex = 0
    let match = pattern.exec(raw)
    while (match !== null) {
      if (match[1] !== undefined) found.push(match[1])
      match = pattern.exec(raw)
    }
  }
  return found
}

/**
 * What an adapter may not import, and what each one would be if it did.
 *
 * Anything supabase-shaped — the shortest path in the system from a third party's markup to a
 * write, since the markup is already in scope on the line above. Every research write goes through
 * the service role in `lib/scraper/workflows/**` after the drain loop's checks, and `0251` grants
 * no session role a write on the two tables Phase 27 adds. `node:fs` — read access to the
 * deployment, in a module that runs a vendor's rules over a vendor's page, and `.env` is a file
 * like any other. The three HTTP clients — a request that skipped the kill switch,
 * the policy review, robots, the crawl delay, the redirect and body caps, and the
 * `research_fetches` row that makes a request auditable at all. `server-only` — a marker that
 * throws outside a Server Component, which would make `scripts/research/reextract.ts` unrunnable
 * and the Studio picker unbuildable. The browser-automation family — permanently out of scope, in
 * this phase and every later one.
 */
const FORBIDDEN_IMPORTS: readonly RegExp[] = [
  // ANYTHING SUPABASE-SHAPED, MATCHED ANYWHERE IN THE SPECIFIER, not `lib/supabase` anchored at a
  // path boundary. `@supabase/supabase-js` is the client itself and a relative `../../supabase/…`
  // climbs out of this tree without the word `lib` appearing at all; both are the same mistake, and
  // a pattern that only recognised the tidy form would recognise only the tidy mistake.
  /supabase/i,
  /^node:fs(\/promises)?$/,
  /^fs(\/promises)?$/,
  /^undici$/,
  /^axios$/,
  /^node-fetch$/,
  /^server-only$/,
  /puppeteer|playwright|selenium|webdriver/i,
]

/** `example.` is RFC 2606 and belongs to nobody; loopback says nothing about anybody either. */
const EXTERNAL_HOST = /\bhttps?:\/\/([A-Za-z0-9.-]+)/g
const HOST_ALLOWED =
  /^(localhost|127\.0\.0\.1|\[?::1\]?|example\.(com|org|net)|[A-Za-z0-9-]+\.example)$/

/**
 * Vocabulary namespaces are IDENTIFIERS, not hosts to fetch — `itemtype="https://schema.org/Product"`
 * is a string compared against, and no adapter has a fetcher to resolve one with even if it wanted
 * to. `check-research-isolation.mjs` admits exactly these two, and this file admits exactly the
 * same two so that a green suite and a green build cannot mean different things.
 */
const VOCABULARY_HOSTS: ReadonlySet<string> = new Set(['schema.org', 'www.schema.org', 'ogp.me'])

describe('no adapter reaches outside its folder', () => {
  it('finds files to check, so the scans below are not scanning nothing', () => {
    expect(CODE_FILES.length).toBeGreaterThan(0)
    expect(ALL_FILES.length).toBeGreaterThan(CODE_FILES.length)
  })

  it('imports no database, no file system, no HTTP client and no browser automation', () => {
    const violations: string[] = []
    for (const file of CODE_FILES) {
      for (const specifier of importsOf(file)) {
        if (FORBIDDEN_IMPORTS.some((pattern) => pattern.test(specifier))) {
          violations.push(`${relative(process.cwd(), file)} imports "${specifier}"`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('names no external host anywhere in the tree, READMEs included', () => {
    const violations: string[] = []
    for (const file of ALL_FILES) {
      const raw = readFileSync(file, 'utf8')
      EXTERNAL_HOST.lastIndex = 0
      let match = EXTERNAL_HOST.exec(raw)
      while (match !== null) {
        const host = (match[1] ?? '').toLowerCase().replace(/[.:]+$/, '')
        if (!HOST_ALLOWED.test(host) && !VOCABULARY_HOSTS.has(host)) {
          const line = raw.slice(0, match.index).split('\n').length
          violations.push(`${relative(process.cwd(), file)}:${line} names "${host}"`)
        }
        match = EXTERNAL_HOST.exec(raw)
      }
    }

    // D10: no competitor, brand, domain or price appears anywhere in this repository. A real source
    // is a row in `research_sources` that somebody approved, never a literal in a build artefact.
    expect(violations).toEqual([])
  })

  it('parses HTML in exactly one place, and that place is the one with the depth guard', () => {
    /*
     * THE ASSERTION A REAL DEFECT PUT HERE. `node-html-parser` is super-quadratic in NESTING DEPTH
     * — four thousand unclosed divs take six seconds, twenty thousand take hours — so a page well
     * inside the fetcher's 2 MB cap can wedge the cron function, and the CPU budget cannot catch it
     * because the runaway is one synchronous call into a dependency with no loop of ours to ask.
     * `lib/scraper/adapters/parse.ts` refuses such a document before handing it over.
     *
     * A SECOND CALL SITE WOULD BE A SECOND PLACE WITH NO GUARD, and it would be added by somebody
     * writing a vendor adapter who had never met this failure — which is precisely the person this
     * whole contract suite exists for. Importing the TYPE is fine and common; importing `parse` is
     * what is refused.
     */
    const offenders: string[] = []
    for (const file of CODE_FILES) {
      const rel = relative(process.cwd(), file)
      if (rel.endsWith(join('adapters', 'parse.ts'))) continue

      const raw = readFileSync(file, 'utf8')
      for (const line of raw.split('\n')) {
        if (!line.includes("from 'node-html-parser'")) continue
        // `import type { HTMLElement } from 'node-html-parser'` is a type-only import and erases.
        if (/^\s*import\s+type\s/.test(line)) continue
        offenders.push(`${rel}: ${line.trim()}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
