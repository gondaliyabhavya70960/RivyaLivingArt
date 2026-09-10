import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  GENERIC_ADAPTER_KEY,
  getAdapterDescriptor,
  listAdapterDescriptors,
  registerAdapterDescriptor,
  registerBuiltInAdapters,
  resetAdapterDescriptors,
  type AdapterDescriptor,
} from '@/lib/scraper/adapters/registry'
import { getAdapter, registerBuiltInAdapterImplementations } from '@/lib/scraper/adapters/execution'

/**
 * The adapter descriptor registry, and the three ways a picker built on it could mislead somebody.
 *
 * WHAT THIS SUITE IS ACTUALLY GUARDING is not "does a Map hold things" — it is the honesty of a
 * dropdown a researcher configures a source from. A registry that answered for a key nobody
 * registered would let a source be saved against an adapter that will never run; one that let two
 * modules share a key would put a version onto stored rows that names the wrong rules; one that
 * listed its entries in load order would show a different list in production than in development,
 * and a picker whose contents move is one nobody reads to the bottom of. Each of those ends in a
 * configuration screen that looks decided when nothing was decided.
 *
 * THE CAPABILITY ASSERTIONS ARE THE OTHER HALF. `generic` declares `DISCOVER` and no more, because
 * Phase 25's pass reads a title, a canonical URL and links, and nothing in this repository yet
 * turns a page into a product. The test that `EXTRACT` is absent is a test that Phase 26 does not
 * advertise Phase 27's work — it fails the day somebody adds the capability without the extractor,
 * which is exactly the day it should.
 *
 * THE REGISTER IS PER PROCESS AND THIS FILE MUTATES IT, so every test starts from
 * `resetAdapterDescriptors()` followed by `registerBuiltInAdapters()` — the module's import-time
 * side effect has already run once and will not run again. That pairing is itself under test
 * below; if it stopped working, every other assertion here would be made against an empty register
 * and would quietly pass.
 *
 * EVERY HOST HERE IS `example.com`-STYLE OR LOOPBACK. No source, brand, domain or price appears in
 * this repository (D10), and a fixture is not an exception to that.
 */

/** A descriptor with no behaviour beyond the answer it was built to give. */
function fakeDescriptor(
  key: string,
  overrides: Partial<Omit<AdapterDescriptor, 'key'>> = {},
): AdapterDescriptor {
  return {
    key,
    version: '0.0.1',
    capabilities: ['DISCOVER'],
    supports: () => true,
    ...overrides,
  }
}

/** The built-in, fetched through the public lookup so the tests read it the way callers do. */
function generic(): AdapterDescriptor {
  const descriptor = getAdapterDescriptor(GENERIC_ADAPTER_KEY)
  if (descriptor === null) throw new Error('The generic descriptor was not registered.')
  return descriptor
}

beforeEach(() => {
  resetAdapterDescriptors()
  registerBuiltInAdapters()
})

afterEach(() => {
  // Leave the register as the rest of the process expects to find it, so a file that imports the
  // module for its side effect alone is not affected by the order suites happen to run in.
  resetAdapterDescriptors()
  registerBuiltInAdapters()
})

describe('the built-in registration', () => {
  it('ships exactly one adapter, and it is the key the column defaults to', () => {
    // `research_sources.adapter_key text not null default 'generic'` in migration 0231. A second
    // built-in arriving here without a Phase 27 implementation behind it is the failure this
    // asserts against.
    expect(listAdapterDescriptors().map((descriptor) => descriptor.key)).toEqual([
      GENERIC_ADAPTER_KEY,
    ])
    expect(GENERIC_ADAPTER_KEY).toBe('generic')
  })

  it('declares DISCOVER and EXTRACT, and still does not claim PAGINATE', () => {
    /*
     * WRITTEN IN PHASE 26 AS "does not claim EXTRACT before Phase 27 writes the extractor", AND
     * PHASE 27 WROTE IT. The assertion is kept rather than deleted because what it is really for
     * is that a capability is a CLAIM the picker renders and the engine must honour — so the list
     * is pinned, and widening it is a line somebody has to change on purpose. PAGINATE is still
     * absent: no adapter follows a next-page link, and advertising that it did would put a
     * capability on a Studio form that nothing implements.
     */
    expect(generic().capabilities).toEqual(['DISCOVER', 'EXTRACT'])
    expect(generic().capabilities).not.toContain('PAGINATE')
  })

  it('carries a version, because the version is written onto every row the adapter produces', () => {
    // A MAJOR BUMP, NOT A MINOR ONE. Phase 25's raw items held a title, a canonical URL and links;
    // these hold a `RawProductDraft`. The output shape changed, and `adapter_version` on every row
    // is what lets a value that later looks wrong be traced to the code that read it.
    expect(generic().version).toBe('2.0.0')
  })

  it('agrees with the adapter it describes, which is the point of having both', () => {
    /*
     * THE ASSERTION PHASE 27 MADE NECESSARY. There are now two registers — a DESCRIPTOR here,
     * which a Client Component may read, and an IMPLEMENTATION in `execution.ts`, which only the
     * drain loop touches — and the split is what keeps adapter parsers out of the Studio bundle.
     * The cost of the split is that they can disagree, and a disagreement would mean a Studio form
     * showing one version while `research_product_versions` recorded another. Nothing but this test
     * holds them together.
     */
    registerBuiltInAdapterImplementations()
    const adapter = getAdapter(GENERIC_ADAPTER_KEY)
    expect(adapter).not.toBeNull()
    expect(adapter?.version).toBe(generic().version)
    expect(adapter?.capabilities).toEqual(generic().capabilities)
    expect(adapter?.key).toBe(generic().key)
  })

  it('can be called again without throwing, which is what makes the export usable', () => {
    // A caller mirroring `loadBulkOperations()` calls the registration because it cannot know
    // whether the module was already evaluated. If that were punished as a duplicate, the export
    // would only ever be safe to call on a register somebody had just cleared.
    expect(() => {
      registerBuiltInAdapters()
      registerBuiltInAdapters()
    }).not.toThrow()
    expect(listAdapterDescriptors()).toHaveLength(1)
  })
})

describe('registerAdapterDescriptor', () => {
  it('makes a descriptor findable by its key', () => {
    const woven = fakeDescriptor('woven-panel', { version: '2.3.0' })
    registerAdapterDescriptor(woven)

    expect(getAdapterDescriptor('woven-panel')).toBe(woven)
    expect(getAdapterDescriptor('woven-panel')?.version).toBe('2.3.0')
  })

  it('stores the descriptor as given, without copying or normalising it', () => {
    // Identity rather than deep equality: Phase 27 registers a descriptor beside an implementation,
    // and a registry that cloned would hand out an object the adapter no longer recognises as its
    // own — which is how a `supports()` closed over adapter state stops seeing that state.
    const descriptor = fakeDescriptor('carved-frame')
    registerAdapterDescriptor(descriptor)
    expect(getAdapterDescriptor('carved-frame')).toBe(descriptor)
  })

  it('refuses a second descriptor for a key already registered, naming the key', () => {
    registerAdapterDescriptor(fakeDescriptor('woven-panel', { version: '1.4.0' }))

    expect(() =>
      registerAdapterDescriptor(fakeDescriptor('woven-panel', { version: '9.9.9' })),
    ).toThrow(/woven-panel/)
  })

  it('names the version already holding the key, because the message is read in a stack trace', () => {
    registerAdapterDescriptor(fakeDescriptor('woven-panel', { version: '1.4.0' }))

    expect(() =>
      registerAdapterDescriptor(fakeDescriptor('woven-panel', { version: '9.9.9' })),
    ).toThrow(/1\.4\.0/)
  })

  it('refuses a second claim on the built-in key rather than replacing it', () => {
    // Last-registration-wins here would mean rows already carrying `adapter_key = 'generic'` are
    // attributed to whichever module the bundler evaluated second.
    expect(() =>
      registerAdapterDescriptor(fakeDescriptor(GENERIC_ADAPTER_KEY, { version: '0.0.1' })),
    ).toThrow(/generic/)
    expect(generic().version).toBe('2.0.0')
  })

  it('leaves the register untouched when it refuses', () => {
    registerAdapterDescriptor(fakeDescriptor('woven-panel', { version: '1.4.0' }))
    try {
      registerAdapterDescriptor(fakeDescriptor('woven-panel', { version: '9.9.9' }))
    } catch {
      // The throw is the subject of the tests above; here only its aftermath matters.
    }

    expect(getAdapterDescriptor('woven-panel')?.version).toBe('1.4.0')
    expect(listAdapterDescriptors()).toHaveLength(2)
  })

  it('never calls the predicate it is handed', () => {
    // Registration asks nothing of an adapter. A registry that probed `supports()` — to sort by it,
    // to cache it, to validate it — would run third-party-shaped code at import time, in a Studio
    // bundle, before any caller had decided to ask a question.
    const hostile = fakeDescriptor('hostile-probe', {
      supports: () => {
        throw new Error('supports() must not be called by the registry.')
      },
    })

    expect(() => {
      registerAdapterDescriptor(hostile)
      listAdapterDescriptors()
      getAdapterDescriptor('hostile-probe')
    }).not.toThrow()
  })
})

describe('listAdapterDescriptors', () => {
  it('puts generic first and sorts the rest by key, so the order is not insertion order', () => {
    registerAdapterDescriptor(fakeDescriptor('woven-panel'))
    registerAdapterDescriptor(fakeDescriptor('carved-frame'))
    registerAdapterDescriptor(fakeDescriptor('lacquer-tray'))

    expect(listAdapterDescriptors().map((descriptor) => descriptor.key)).toEqual([
      GENERIC_ADAPTER_KEY,
      'carved-frame',
      'lacquer-tray',
      'woven-panel',
    ])
  })

  it('keeps generic at the top even when its key sorts in the middle', () => {
    // 'carved-frame' sorts before 'generic' and 'woven-panel' after it, so a plain alphabetical
    // sort would bury the one entry that is always available.
    registerAdapterDescriptor(fakeDescriptor('carved-frame'))
    registerAdapterDescriptor(fakeDescriptor('woven-panel'))

    expect(listAdapterDescriptors()[0]?.key).toBe(GENERIC_ADAPTER_KEY)
  })

  it('is stable across calls, which is what a picker rendered twice depends on', () => {
    registerAdapterDescriptor(fakeDescriptor('woven-panel'))
    registerAdapterDescriptor(fakeDescriptor('carved-frame'))

    expect(listAdapterDescriptors().map((descriptor) => descriptor.key)).toEqual(
      listAdapterDescriptors().map((descriptor) => descriptor.key),
    )
  })

  it('reports an empty register as empty rather than synthesising the generic entry', () => {
    resetAdapterDescriptors()
    expect(listAdapterDescriptors()).toEqual([])
  })
})

describe('getAdapterDescriptor', () => {
  it('returns null for a key nobody registered, rather than throwing', () => {
    // The caller is a Server Action validating a string that came off an HTTP request; it answers
    // with a field-level message beside the picker, which it cannot do from an unhandled rejection.
    expect(getAdapterDescriptor('nope')).toBeNull()
  })

  it('returns null rather than undefined, so a strict null check is the whole test', () => {
    expect(getAdapterDescriptor('nope')).not.toBeUndefined()
  })

  it('matches exactly, leaving trimming and case to the schema that already does both', () => {
    // `sourceInputSchema.adapterKey` trims and holds the key to KEBAB_CASE. A second normalisation
    // rule here would apply on only one of the two paths into the registry.
    expect(getAdapterDescriptor(' generic')).toBeNull()
    expect(getAdapterDescriptor('generic ')).toBeNull()
    expect(getAdapterDescriptor('GENERIC')).toBeNull()
    expect(getAdapterDescriptor('')).toBeNull()
  })
})

describe("the generic adapter's supports()", () => {
  it('accepts an https source, which is what every real source must be', () => {
    expect(generic().supports({ baseUrl: 'https://example.com' })).toBe(true)
    expect(generic().supports({ baseUrl: 'https://example.com/catalogue/seating' })).toBe(true)
  })

  it('accepts plain http, because the column constraint is a different question', () => {
    // `research_sources_base_url_is_http` refuses a non-loopback http base URL at the row. This
    // predicate is the adapter's claim about what it can READ, and answering "unsupported" here
    // would send an operator to the adapter picker for a problem in the field above it.
    expect(generic().supports({ baseUrl: 'http://example.net/shop' })).toBe(true)
  })

  it('accepts a loopback fixture server, which is what the no-request tests run against', () => {
    expect(generic().supports({ baseUrl: 'http://127.0.0.1:4321/' })).toBe(true)
    expect(generic().supports({ baseUrl: 'http://localhost:4321/catalogue' })).toBe(true)
  })

  it('refuses a scheme this pipeline could not read under any adapter', () => {
    expect(generic().supports({ baseUrl: 'ftp://example.com/catalogue' })).toBe(false)
    expect(generic().supports({ baseUrl: 'mailto:someone@example.com' })).toBe(false)
    expect(generic().supports({ baseUrl: 'file:///etc/hosts' })).toBe(false)
    expect(generic().supports({ baseUrl: 'javascript:void 0' })).toBe(false)
  })

  it('refuses an empty or half-typed base URL without throwing', () => {
    // The drawer posts while somebody is still typing. A throw would make the picker's warning the
    // loudest failure on the page for the field it is not about.
    expect(generic().supports({ baseUrl: '' })).toBe(false)
    expect(generic().supports({ baseUrl: '   ' })).toBe(false)
    expect(generic().supports({ baseUrl: 'example.com/catalogue' })).toBe(false)
    expect(generic().supports({ baseUrl: 'https:/' })).toBe(false)
  })

  it('ignores the adapter key on the view it is handed', () => {
    // The picker asks every descriptor about the same source, including one already configured to
    // somebody else's key. An answer that changed with the current selection would make the warning
    // depend on the order the operator touched the fields in.
    expect(generic().supports({ baseUrl: 'https://example.com', adapterKey: 'woven-panel' })).toBe(
      true,
    )
    expect(generic().supports({ baseUrl: 'https://example.com', adapterKey: 'generic' })).toBe(true)
  })

  it('is pure: the same view answered twice gives the same answer', () => {
    const view = { baseUrl: 'https://example.com' } as const
    expect(generic().supports(view)).toBe(generic().supports(view))
  })
})

describe('resetAdapterDescriptors', () => {
  it('empties the register', () => {
    registerAdapterDescriptor(fakeDescriptor('woven-panel'))
    resetAdapterDescriptors()

    expect(listAdapterDescriptors()).toEqual([])
    expect(getAdapterDescriptor(GENERIC_ADAPTER_KEY)).toBeNull()
    expect(getAdapterDescriptor('woven-panel')).toBeNull()
  })

  it('is undone by calling the exported registration, not by re-importing the module', async () => {
    /*
     * THE TEST THE WHOLE ARRANGEMENT EXISTS FOR. A module's top-level side effect runs once per
     * process, so a re-import after a reset registers nothing — the register stays empty and every
     * later assertion passes against it. `lib/bulk/operations/research/index.ts` records the same
     * discovery. The dynamic import below is the wrong repair, asserted to be wrong; the call after
     * it is the right one.
     */
    resetAdapterDescriptors()
    await import('@/lib/scraper/adapters/registry')
    expect(listAdapterDescriptors()).toEqual([])

    registerBuiltInAdapters()
    expect(listAdapterDescriptors().map((descriptor) => descriptor.key)).toEqual([
      GENERIC_ADAPTER_KEY,
    ])
  })

  it('restores a working generic descriptor rather than a hollow entry', () => {
    resetAdapterDescriptors()
    registerBuiltInAdapters()

    expect(generic().capabilities).toEqual(['DISCOVER', 'EXTRACT'])
    expect(generic().supports({ baseUrl: 'https://example.com' })).toBe(true)
    expect(generic().supports({ baseUrl: 'ftp://example.com' })).toBe(false)
  })

  it('lets a descriptor be registered again under a key the reset released', () => {
    registerAdapterDescriptor(fakeDescriptor('woven-panel', { version: '1.4.0' }))
    resetAdapterDescriptors()

    expect(() =>
      registerAdapterDescriptor(fakeDescriptor('woven-panel', { version: '9.9.9' })),
    ).not.toThrow()
    expect(getAdapterDescriptor('woven-panel')?.version).toBe('9.9.9')
  })
})

describe('the module is pure, and structurally so', () => {
  const SOURCE = readFileSync(join(process.cwd(), 'lib/scraper/adapters/registry.ts'), 'utf8')
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('imports nothing at all, so it cannot reach a database or the network by accident', () => {
    expect(SOURCE.match(/^import .*/gm)).toBeNull()
  })

  it('carries no server-only marker, so the Studio form can reach it', () => {
    // `components/studio/research/SourceForm.tsx` is a Client Component and both the create and
    // edit pages hand it `listAdapterDescriptors()`. The marker resolves to a module that throws in
    // a client bundle.
    expect(CODE).not.toContain("'server-only'")
  })

  it('contains no request-making or I/O code of any kind', () => {
    expect(CODE).not.toMatch(/(?<![A-Za-z])fetch\s*\(/)
    expect(CODE).not.toMatch(/XMLHttpRequest|WebSocket|require\(|node:|@\/lib\/supabase/)
  })

  it('reads no ambient clock or randomness', () => {
    expect(CODE).not.toMatch(/Date\.now|new Date\(|Math\.random/)
  })
})
