import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

import { MIN_SCHEDULE_INTERVAL_MINUTES } from '@/lib/scraper/core/cron'
import {
  ANALYTICS_LEAGUES,
  ATTRIBUTE_KEYS,
  BASE_URL_MAX_LENGTH,
  COLLECTION_MODES,
  CONCURRENCY_MAX,
  IMAGE_EXTRACTION_MODES,
  MAX_ATTRIBUTE_RULES,
  NOTES_MAX_LENGTH,
  POLICY_NOTES_MIN_LENGTH,
  RATE_LIMIT_RPM_MAX,
  READINESS_STATES,
  REQUEST_DELAY_MS_MIN,
  SOURCE_TYPES,
  URL_PATTERN_KINDS,
  URL_PATTERN_MAX_LENGTH,
  attributeExtractionSchema,
  categoryMappingInputSchema,
  policyDecisionSchema,
  priceExtractionSchema,
  scheduleInputSchema,
  skuExtractionSchema,
  sourceInputSchema,
  urlPatternInputSchema,
} from '@/lib/scraper/core/source-schema'

/**
 * FEAT §26's twenty-three fields, held to the shape `supabase/migrations/0240_phase26_source_config.sql`
 * gives them.
 *
 * EVERY REJECTION ASSERTS ON THE ISSUE PATH, NOT MERELY ON FAILURE. A test that checks only
 * `success === false` passes for the wrong reason all the time: rename `rateLimitRpm` to
 * `rateLimitRPM` and every such test still passes, because the fixture now carries an unrecognised
 * key and a missing required one, and both are failures. Asserting the path means a renamed field
 * fails here rather than in production, and it means a rule moving from one field to another is
 * visible in the diff.
 *
 * THE FIXTURES NAME NOBODY. Hosts are `example.com` and loopback, labels are invented and neutral,
 * and no region, currency or price here describes a real business — this repository seeds zero
 * sources and names no competitor, in a test fixture least of all (D10).
 */

type ParseResult = { readonly success: boolean; readonly error?: z.ZodError }

/** The issue paths of a parse that must have failed, dotted, so `['a', 0, 'b']` reads `a.0.b`. */
function rejectedPaths(result: ParseResult): readonly string[] {
  expect(result.success).toBe(false)
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'))
}

function rejectedMessages(result: ParseResult): readonly string[] {
  expect(result.success).toBe(false)
  return (result.error?.issues ?? []).map((issue) => issue.message)
}

const validPrice = {
  strategy: 'SELECTOR',
  selector: '.price-current',
  decimalSeparator: '.',
  thousandsSeparator: ',',
}

const validSku = { strategy: 'JSONLD_PATH', jsonPath: 'offers.sku' }

const validAttributes = [
  { key: 'dimensions', selector: '.spec-dimensions', kind: 'TEXT' },
  { key: 'lead_time', selector: '.spec-lead', kind: 'ATTRIBUTE', attribute: 'data-weeks' },
]

/** A complete, valid source: every key `sourceInputSchema` names, and not one more. */
const validSource = {
  slug: 'comparator-one',
  name: 'Comparator One',
  baseUrl: 'https://catalogue.example.com',
  region: 'GB',
  currency: 'GBP',
  sourceType: 'BRAND',
  analyticsLeague: 'PEER',
  collectionMode: 'SEED_URLS',
  adapterKey: 'generic',
  imageExtractionMode: 'URL_ONLY',
  priceExtraction: validPrice,
  skuExtraction: validSku,
  attributeExtraction: validAttributes,
  rateLimitRpm: 20,
  requestDelayMs: 3000,
  concurrency: 1,
  notes: null,
  readiness: 'DRAFT',
}

function source(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...validSource, ...overrides }
}

const validPattern = {
  kind: 'PRODUCT',
  pattern: '/products/*',
  isRegex: false,
  priority: 100,
  notes: null,
}

const validSchedule = {
  jobType: 'REFRESH',
  cronExpression: '0 */6 * * *',
  timezone: 'UTC',
  isEnabled: false,
}

/** v4-shaped and invented. Nothing in this repository seeds a category with this id. */
const CATEGORY_ID = '0f3a5c60-1d2b-4a7e-9c81-6b5d2e4f7a10'

describe('the allowlists match migration 0240 exactly', () => {
  it('carries the six source types in the order the enum declares them', () => {
    expect(SOURCE_TYPES).toEqual([
      'BRAND',
      'RETAILER',
      'MARKETPLACE',
      'GALLERY',
      'ARTISAN',
      'DIRECTORY',
    ])
  })

  it('carries the four analytics leagues, which are staff-only forever', () => {
    expect(ANALYTICS_LEAGUES).toEqual(['PEER', 'ASPIRATIONAL', 'ADJACENT', 'MASS'])
  })

  it('carries the four collection modes, including the three the engine cannot run yet', () => {
    expect(COLLECTION_MODES).toEqual(['SITEMAP', 'CATEGORY_CRAWL', 'SEED_URLS', 'FEED'])
  })

  it('carries the three image extraction modes, none of which downloads anything', () => {
    expect(IMAGE_EXTRACTION_MODES).toEqual(['NONE', 'URL_ONLY', 'URL_AND_DIMENSIONS'])
  })

  it('carries the readiness allowlist and the URL pattern kinds', () => {
    expect(READINESS_STATES).toEqual(['DRAFT', 'READY_FOR_REVIEW', 'REVIEWED'])
    expect(URL_PATTERN_KINDS).toEqual(['PRODUCT', 'CATEGORY', 'EXCLUDE', 'PAGINATION'])
  })

  it('carries the politeness numbers the CHECK constraints carry', () => {
    expect(RATE_LIMIT_RPM_MAX).toBe(60)
    expect(REQUEST_DELAY_MS_MIN).toBe(1000)
    expect(CONCURRENCY_MAX).toBe(4)
    expect(URL_PATTERN_MAX_LENGTH).toBe(200)
  })

  it('names FEAT §26 field 15 six attribute keys, verbatim', () => {
    expect(ATTRIBUTE_KEYS).toEqual([
      'dimensions',
      'materials',
      'availability',
      'lead_time',
      'variants',
      'customization',
    ])
  })
})

describe('sourceInputSchema — identity', () => {
  it('accepts a complete source', () => {
    expect(sourceInputSchema.safeParse(validSource).success).toBe(true)
  })

  it('rejects an unrecognised key rather than dropping it', () => {
    const result = sourceInputSchema.safeParse({ ...validSource, priceRegex: '£([0-9.]+)' })
    expect(rejectedPaths(result)).toContain('')
    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
  })

  it('cannot express `isEnabled` at all — enabling is the owner’s action, not the drawer’s', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ isEnabled: true })))).toContain('')
  })

  it('cannot express a policy decision either', () => {
    expect(
      rejectedPaths(sourceInputSchema.safeParse(source({ policyStatus: 'APPROVED' }))),
    ).toContain('')
  })

  it('accepts a slug of lowercase letters, digits and single hyphens', () => {
    expect(sourceInputSchema.safeParse(source({ slug: 'comparator-2-north' })).success).toBe(true)
  })

  it('rejects an upper-case slug at `slug`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ slug: 'Comparator-One' })))).toEqual([
      'slug',
    ])
  })

  it('rejects underscores, spaces and doubled hyphens in a slug', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ slug: 'comparator_one' })))).toEqual([
      'slug',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ slug: 'comparator one' })))).toEqual([
      'slug',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ slug: 'comparator--one' })))).toEqual(
      ['slug'],
    )
  })

  it('rejects an empty name at `name`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ name: '   ' })))).toEqual(['name'])
  })

  it('rejects a name past the length cap at `name`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ name: 'x'.repeat(201) })))).toEqual([
      'name',
    ])
  })
})

describe('sourceInputSchema — baseUrl mirrors research_sources_base_url_is_http', () => {
  it('accepts https', () => {
    expect(
      sourceInputSchema.safeParse(source({ baseUrl: 'https://catalogue.example.com/shop' }))
        .success,
    ).toBe(true)
  })

  it('accepts the loopback hosts the constraint admits, with and without a port', () => {
    for (const url of [
      'http://127.0.0.1:54321/',
      'http://127.0.0.1',
      'http://localhost:3000',
      'http://localhost/fixtures',
      'http://[::1]:8080/catalogue',
    ]) {
      expect(sourceInputSchema.safeParse(source({ baseUrl: url })).success).toBe(true)
    }
  })

  it('rejects plain http to a real host at `baseUrl`', () => {
    expect(
      rejectedPaths(
        sourceInputSchema.safeParse(source({ baseUrl: 'http://catalogue.example.com' })),
      ),
    ).toEqual(['baseUrl'])
  })

  it('rejects a host that merely begins with a loopback address', () => {
    // `http://127.0.0.1.example.com` is somebody else's server with a reassuring prefix. The
    // constraint's `(:[0-9]+)?(/|$)` is what refuses it, and so must this.
    expect(
      rejectedPaths(
        sourceInputSchema.safeParse(source({ baseUrl: 'http://127.0.0.1.example.com/' })),
      ),
    ).toEqual(['baseUrl'])
    expect(
      rejectedPaths(
        sourceInputSchema.safeParse(source({ baseUrl: 'http://localhost.example.com' })),
      ),
    ).toEqual(['baseUrl'])
  })

  it('rejects an upper-case scheme, because PostgreSQL’s `~` is case-sensitive', () => {
    expect(
      rejectedPaths(
        sourceInputSchema.safeParse(source({ baseUrl: 'HTTPS://catalogue.example.com' })),
      ),
    ).toEqual(['baseUrl'])
  })

  it('rejects a scheme that is neither, and a bare host', () => {
    expect(
      rejectedPaths(
        sourceInputSchema.safeParse(source({ baseUrl: 'ftp://catalogue.example.com' })),
      ),
    ).toEqual(['baseUrl'])
    expect(
      rejectedPaths(sourceInputSchema.safeParse(source({ baseUrl: 'catalogue.example.com' }))),
    ).toEqual(['baseUrl'])
  })

  it('rejects a base URL longer than the fetcher will ever store', () => {
    const long = `https://catalogue.example.com/${'a'.repeat(BASE_URL_MAX_LENGTH)}`
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ baseUrl: long })))).toEqual([
      'baseUrl',
    ])
  })
})

describe('sourceInputSchema — region and currency', () => {
  it('accepts an ISO-3166-1 alpha-2 code and the literal GLOBAL', () => {
    expect(sourceInputSchema.safeParse(source({ region: 'IN' })).success).toBe(true)
    expect(sourceInputSchema.safeParse(source({ region: 'GLOBAL' })).success).toBe(true)
  })

  it('rejects a lower-case region at `region`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ region: 'in' })))).toEqual(['region'])
  })

  it('rejects an alpha-3 region and a mixed-case GLOBAL', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ region: 'IND' })))).toEqual([
      'region',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ region: 'Global' })))).toEqual([
      'region',
    ])
  })

  it('accepts an ISO-4217 alpha-3 currency', () => {
    expect(sourceInputSchema.safeParse(source({ currency: 'INR' })).success).toBe(true)
  })

  it('rejects a lower-case, two-letter or four-letter currency at `currency`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ currency: 'inr' })))).toEqual([
      'currency',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ currency: 'IN' })))).toEqual([
      'currency',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ currency: 'INRR' })))).toEqual([
      'currency',
    ])
  })
})

describe('sourceInputSchema — the four enum fields', () => {
  it('accepts every declared source type', () => {
    for (const sourceType of SOURCE_TYPES) {
      expect(sourceInputSchema.safeParse(source({ sourceType })).success).toBe(true)
    }
  })

  it('rejects a source type nobody declared, at `sourceType`', () => {
    expect(
      rejectedPaths(sourceInputSchema.safeParse(source({ sourceType: 'WHOLESALER' }))),
    ).toEqual(['sourceType'])
  })

  it('requires an analytics league, though the column is nullable', () => {
    expect(
      rejectedPaths(sourceInputSchema.safeParse(source({ analyticsLeague: undefined }))),
    ).toEqual(['analyticsLeague'])
    expect(
      rejectedPaths(sourceInputSchema.safeParse(source({ analyticsLeague: 'RIVAL' }))),
    ).toEqual(['analyticsLeague'])
  })

  it('rejects an undeclared collection mode at `collectionMode`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ collectionMode: 'RSS' })))).toEqual([
      'collectionMode',
    ])
  })

  it('rejects an image extraction mode that is not one of the three', () => {
    // `DOWNLOAD` is the value this system deliberately does not have.
    expect(
      rejectedPaths(sourceInputSchema.safeParse(source({ imageExtractionMode: 'DOWNLOAD' }))),
    ).toEqual(['imageExtractionMode'])
  })

  it('rejects a readiness outside the allowlist at `readiness`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ readiness: 'APPROVED' })))).toEqual([
      'readiness',
    ])
  })

  it('rejects an adapter key that is not lowercase kebab, at `adapterKey`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ adapterKey: 'Generic' })))).toEqual([
      'adapterKey',
    ])
  })
})

describe('sourceInputSchema — the politeness numbers', () => {
  it('accepts the bounds the CHECKs accept', () => {
    expect(sourceInputSchema.safeParse(source({ rateLimitRpm: 1 })).success).toBe(true)
    expect(sourceInputSchema.safeParse(source({ rateLimitRpm: RATE_LIMIT_RPM_MAX })).success).toBe(
      true,
    )
    expect(
      sourceInputSchema.safeParse(source({ requestDelayMs: REQUEST_DELAY_MS_MIN })).success,
    ).toBe(true)
    expect(sourceInputSchema.safeParse(source({ requestDelayMs: 600_000 })).success).toBe(true)
    expect(sourceInputSchema.safeParse(source({ concurrency: CONCURRENCY_MAX })).success).toBe(true)
  })

  it('rejects a rate limit outside 1–60 at `rateLimitRpm`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ rateLimitRpm: 0 })))).toEqual([
      'rateLimitRpm',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ rateLimitRpm: 61 })))).toEqual([
      'rateLimitRpm',
    ])
  })

  it('rejects a fractional rate limit and a stringified one', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ rateLimitRpm: 1.5 })))).toEqual([
      'rateLimitRpm',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ rateLimitRpm: '20' })))).toEqual([
      'rateLimitRpm',
    ])
  })

  it('rejects a request delay below one second or above ten minutes, at `requestDelayMs`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ requestDelayMs: 999 })))).toEqual([
      'requestDelayMs',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ requestDelayMs: 600_001 })))).toEqual(
      ['requestDelayMs'],
    )
  })

  it('rejects a concurrency outside 1–4 at `concurrency`', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ concurrency: 0 })))).toEqual([
      'concurrency',
    ])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ concurrency: 5 })))).toEqual([
      'concurrency',
    ])
  })
})

describe('sourceInputSchema — notes and nested configuration', () => {
  it('accepts null notes and a long-but-bounded note', () => {
    expect(sourceInputSchema.safeParse(source({ notes: null })).success).toBe(true)
    expect(
      sourceInputSchema.safeParse(source({ notes: 'x'.repeat(NOTES_MAX_LENGTH) })).success,
    ).toBe(true)
  })

  it('rejects an empty note at `notes` — nothing said is null, never an empty string', () => {
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ notes: '' })))).toEqual(['notes'])
    expect(rejectedPaths(sourceInputSchema.safeParse(source({ notes: '   ' })))).toEqual(['notes'])
  })

  it('rejects a note past the cap at `notes`', () => {
    expect(
      rejectedPaths(
        sourceInputSchema.safeParse(source({ notes: 'x'.repeat(NOTES_MAX_LENGTH + 1) })),
      ),
    ).toEqual(['notes'])
  })

  it('surfaces a nested price failure at `priceExtraction.<key>`', () => {
    const result = sourceInputSchema.safeParse(
      source({ priceExtraction: { ...validPrice, selector: undefined } }),
    )
    expect(rejectedPaths(result)).toEqual(['priceExtraction.selector'])
  })

  it('surfaces a nested attribute failure at `attributeExtraction.<index>.<key>`', () => {
    const result = sourceInputSchema.safeParse(
      source({
        attributeExtraction: [
          validAttributes[0],
          { key: 'lead_time', selector: '.spec-lead', kind: 'ATTRIBUTE' },
        ],
      }),
    )
    expect(rejectedPaths(result)).toEqual(['attributeExtraction.1.attribute'])
  })
})

describe('priceExtractionSchema — FEAT §26 field 13', () => {
  it('accepts a selector strategy and a JSON-LD one', () => {
    expect(priceExtractionSchema.safeParse(validPrice).success).toBe(true)
    expect(
      priceExtractionSchema.safeParse({
        strategy: 'JSONLD_PATH',
        jsonPath: 'offers.price',
        decimalSeparator: ',',
        thousandsSeparator: '.',
      }).success,
    ).toBe(true)
  })

  it('accepts NONE with no locator at all — a source that publishes no price', () => {
    expect(
      priceExtractionSchema.safeParse({
        strategy: 'NONE',
        decimalSeparator: '.',
        thousandsSeparator: '',
      }).success,
    ).toBe(true)
  })

  it('accepts a non-breaking-free space and an empty thousands separator', () => {
    expect(
      priceExtractionSchema.safeParse({ ...validPrice, thousandsSeparator: ' ' }).success,
    ).toBe(true)
  })

  it('rejects a SELECTOR strategy with no selector, at `selector`', () => {
    const result = priceExtractionSchema.safeParse({
      strategy: 'SELECTOR',
      decimalSeparator: '.',
      thousandsSeparator: ',',
    })
    expect(rejectedPaths(result)).toEqual(['selector'])
  })

  it('rejects a JSONLD_PATH strategy with no path, at `jsonPath`', () => {
    const result = priceExtractionSchema.safeParse({
      strategy: 'JSONLD_PATH',
      decimalSeparator: '.',
      thousandsSeparator: ',',
    })
    expect(rejectedPaths(result)).toEqual(['jsonPath'])
  })

  it('rejects separators that are the same character, at `thousandsSeparator`', () => {
    const result = priceExtractionSchema.safeParse({ ...validPrice, thousandsSeparator: '.' })
    expect(rejectedPaths(result)).toEqual(['thousandsSeparator'])
  })

  it('rejects a separator outside the four the parser knows', () => {
    expect(
      rejectedPaths(priceExtractionSchema.safeParse({ ...validPrice, thousandsSeparator: ';' })),
    ).toEqual(['thousandsSeparator'])
    expect(
      rejectedPaths(priceExtractionSchema.safeParse({ ...validPrice, decimalSeparator: '·' })),
    ).toEqual(['decimalSeparator'])
  })

  it('rejects a lower-case currency override at `currencyOverride`', () => {
    expect(
      rejectedPaths(priceExtractionSchema.safeParse({ ...validPrice, currencyOverride: 'gbp' })),
    ).toEqual(['currencyOverride'])
  })

  it('rejects an empty selector rather than treating it as absent', () => {
    expect(rejectedPaths(priceExtractionSchema.safeParse({ ...validPrice, selector: '' }))).toEqual(
      ['selector'],
    )
  })

  it('rejects an extra key at the object itself', () => {
    const result = priceExtractionSchema.safeParse({ ...validPrice, vatIncluded: true })
    expect(rejectedPaths(result)).toEqual([''])
    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
  })
})

describe('skuExtractionSchema — FEAT §26 field 14', () => {
  it('accepts a JSON-LD path, and a selector with a strip pattern', () => {
    expect(skuExtractionSchema.safeParse(validSku).success).toBe(true)
    expect(
      skuExtractionSchema.safeParse({
        strategy: 'SELECTOR',
        selector: '.sku',
        stripPattern: '^SKU[- ]?',
      }).success,
    ).toBe(true)
  })

  it('compiles the strip pattern and rejects one that will not compile, at `stripPattern`', () => {
    const result = skuExtractionSchema.safeParse({
      strategy: 'SELECTOR',
      selector: '.sku',
      stripPattern: '^SKU([0-9',
    })
    expect(rejectedPaths(result)).toEqual(['stripPattern'])
    expect(rejectedMessages(result)[0]).toMatch(/regular expression/i)
  })

  it('caps the strip pattern at the same two hundred characters a URL pattern gets', () => {
    expect(
      rejectedPaths(
        skuExtractionSchema.safeParse({
          strategy: 'SELECTOR',
          selector: '.sku',
          stripPattern: 'a'.repeat(URL_PATTERN_MAX_LENGTH + 1),
        }),
      ),
    ).toEqual(['stripPattern'])
  })

  it('rejects a SELECTOR strategy with no selector, at `selector`', () => {
    expect(rejectedPaths(skuExtractionSchema.safeParse({ strategy: 'SELECTOR' }))).toEqual([
      'selector',
    ])
  })

  it('rejects an unknown strategy at `strategy`, and an extra key at the object', () => {
    expect(rejectedPaths(skuExtractionSchema.safeParse({ strategy: 'XPATH' }))).toEqual([
      'strategy',
    ])
    expect(rejectedPaths(skuExtractionSchema.safeParse({ ...validSku, fallback: '.sku' }))).toEqual(
      [''],
    )
  })
})

describe('attributeExtractionSchema — FEAT §26 field 15', () => {
  it('accepts an empty list — a source configuring no attribute rules', () => {
    expect(attributeExtractionSchema.safeParse([]).success).toBe(true)
  })

  it('accepts every declared key, and keeps the order it was given', () => {
    const rules = ATTRIBUTE_KEYS.map((key) => ({ key, selector: `.spec-${key}`, kind: 'TEXT' }))
    const result = attributeExtractionSchema.safeParse(rules)
    expect(result.success).toBe(true)
    // Order IS the semantics: the adapter reads first-match-wins.
    expect(result.data?.map((rule) => rule.key)).toEqual([...ATTRIBUTE_KEYS])
  })

  it('rejects a key outside the six, at `<index>.key`', () => {
    expect(
      rejectedPaths(
        attributeExtractionSchema.safeParse([{ key: 'colour', selector: '.c', kind: 'TEXT' }]),
      ),
    ).toEqual(['0.key'])
  })

  it('rejects an ATTRIBUTE rule that does not name its attribute, at `<index>.attribute`', () => {
    expect(
      rejectedPaths(
        attributeExtractionSchema.safeParse([
          { key: 'variants', selector: '.variant', kind: 'ATTRIBUTE' },
        ]),
      ),
    ).toEqual(['0.attribute'])
  })

  it('accepts an ATTRIBUTE rule that does name it', () => {
    expect(
      attributeExtractionSchema.safeParse([
        { key: 'variants', selector: '.variant', kind: 'ATTRIBUTE', attribute: 'data-variant' },
      ]).success,
    ).toBe(true)
  })

  it('rejects an unknown rule kind and an empty selector, each at its own index', () => {
    expect(
      rejectedPaths(
        attributeExtractionSchema.safeParse([
          { key: 'materials', selector: '.m', kind: 'INNER_HTML' },
        ]),
      ),
    ).toEqual(['0.kind'])
    expect(
      rejectedPaths(
        attributeExtractionSchema.safeParse([
          { key: 'materials', selector: '.m', kind: 'TEXT' },
          { key: 'materials', selector: '', kind: 'TEXT' },
        ]),
      ),
    ).toEqual(['1.selector'])
  })

  it('rejects an extra key inside a rule, reported at that rule’s index', () => {
    expect(
      rejectedPaths(
        attributeExtractionSchema.safeParse([
          { key: 'materials', selector: '.m', kind: 'TEXT', regex: '.*' },
        ]),
      ),
    ).toEqual(['0'])
  })

  it('accepts the full list and rejects one rule more', () => {
    const rule = { key: 'materials', selector: '.m', kind: 'TEXT' }
    expect(
      attributeExtractionSchema.safeParse(Array.from({ length: MAX_ATTRIBUTE_RULES }, () => rule))
        .success,
    ).toBe(true)
    expect(
      rejectedPaths(
        attributeExtractionSchema.safeParse(
          Array.from({ length: MAX_ATTRIBUTE_RULES + 1 }, () => rule),
        ),
      ),
    ).toEqual([''])
  })

  it('rejects an object where the ordered list belongs', () => {
    expect(rejectedPaths(attributeExtractionSchema.safeParse({ dimensions: '.spec' }))).toEqual([
      '',
    ])
  })
})

describe('urlPatternInputSchema — FEAT §26 field 10', () => {
  it('accepts a glob pattern', () => {
    expect(urlPatternInputSchema.safeParse(validPattern).success).toBe(true)
  })

  it('accepts a regex pattern that compiles', () => {
    expect(
      urlPatternInputSchema.safeParse({
        ...validPattern,
        pattern: '^/products/[a-z0-9-]+$',
        isRegex: true,
      }).success,
    ).toBe(true)
  })

  it('compiles a regex pattern on save and rejects one that throws, at `pattern`', () => {
    const result = urlPatternInputSchema.safeParse({
      ...validPattern,
      pattern: '^/products/([a-z',
      isRegex: true,
    })
    expect(rejectedPaths(result)).toEqual(['pattern'])
    expect(rejectedMessages(result)[0]).toMatch(/regular expression/i)
  })

  it('does not compile a glob — the same characters are a literal shape, not an expression', () => {
    expect(
      urlPatternInputSchema.safeParse({
        ...validPattern,
        pattern: '/products/([a-z',
        isRegex: false,
      }).success,
    ).toBe(true)
  })

  it('accepts a pattern of exactly two hundred characters and rejects two hundred and one', () => {
    expect(
      urlPatternInputSchema.safeParse({
        ...validPattern,
        pattern: '/'.repeat(URL_PATTERN_MAX_LENGTH),
      }).success,
    ).toBe(true)
    expect(
      rejectedPaths(
        urlPatternInputSchema.safeParse({
          ...validPattern,
          pattern: '/'.repeat(URL_PATTERN_MAX_LENGTH + 1),
        }),
      ),
    ).toEqual(['pattern'])
  })

  it('rejects an over-long pattern before compiling it, even when it is a regex', () => {
    // The cap is what bounds a pathological expression, so it must not be reachable only after a
    // successful compile: `(a+)+` repeated is perfectly valid and perfectly catastrophic.
    const result = urlPatternInputSchema.safeParse({
      ...validPattern,
      pattern: '(a+)+'.repeat(60),
      isRegex: true,
    })
    expect(rejectedPaths(result)).toEqual(['pattern'])
  })

  it('rejects an empty pattern at `pattern` and an unknown kind at `kind`', () => {
    expect(
      rejectedPaths(urlPatternInputSchema.safeParse({ ...validPattern, pattern: '' })),
    ).toEqual(['pattern'])
    expect(
      rejectedPaths(urlPatternInputSchema.safeParse({ ...validPattern, kind: 'SITEMAP' })),
    ).toEqual(['kind'])
  })

  it('rejects a priority outside 0–1000 at `priority`', () => {
    expect(
      rejectedPaths(urlPatternInputSchema.safeParse({ ...validPattern, priority: -1 })),
    ).toEqual(['priority'])
    expect(
      rejectedPaths(urlPatternInputSchema.safeParse({ ...validPattern, priority: 1001 })),
    ).toEqual(['priority'])
  })

  it('requires the regex flag to be stated rather than assumed', () => {
    const { isRegex: _omitted, ...withoutFlag } = validPattern
    expect(rejectedPaths(urlPatternInputSchema.safeParse(withoutFlag))).toEqual(['isRegex'])
  })

  it('rejects an extra key at the object itself', () => {
    expect(
      rejectedPaths(urlPatternInputSchema.safeParse({ ...validPattern, timeBudgetMs: 5 })),
    ).toEqual([''])
  })
})

describe('categoryMappingInputSchema — FEAT §26 field 9', () => {
  it('accepts a mapping to a Rivya category', () => {
    expect(
      categoryMappingInputSchema.safeParse({
        sourceLabel: 'Occasional Tables',
        sourcePath: 'Furniture / Occasional Tables',
        categoryId: CATEGORY_ID,
        isIgnored: false,
      }).success,
    ).toBe(true)
  })

  it('accepts an explicit ignore with no category and no path', () => {
    expect(
      categoryMappingInputSchema.safeParse({
        sourceLabel: 'Mattresses',
        sourcePath: null,
        categoryId: null,
        isIgnored: true,
      }).success,
    ).toBe(true)
  })

  it('rejects a row that decides both, at `categoryId`', () => {
    const result = categoryMappingInputSchema.safeParse({
      sourceLabel: 'Occasional Tables',
      sourcePath: null,
      categoryId: CATEGORY_ID,
      isIgnored: true,
    })
    expect(rejectedPaths(result)).toEqual(['categoryId'])
    expect(rejectedMessages(result)[0]).toMatch(/never both/i)
  })

  it('rejects a row that decides nothing, at `categoryId`', () => {
    const result = categoryMappingInputSchema.safeParse({
      sourceLabel: 'Occasional Tables',
      sourcePath: null,
      categoryId: null,
      isIgnored: false,
    })
    expect(rejectedPaths(result)).toEqual(['categoryId'])
    expect(rejectedMessages(result)[0]).toMatch(/undecided is no row at all/i)
  })

  it('rejects a category id that is not a uuid, at `categoryId`', () => {
    expect(
      rejectedPaths(
        categoryMappingInputSchema.safeParse({
          sourceLabel: 'Occasional Tables',
          sourcePath: null,
          categoryId: 'occasional-tables',
          isIgnored: false,
        }),
      ),
    ).toEqual(['categoryId'])
  })

  it('rejects an empty source label at `sourceLabel` and an empty path at `sourcePath`', () => {
    expect(
      rejectedPaths(
        categoryMappingInputSchema.safeParse({
          sourceLabel: '  ',
          sourcePath: null,
          categoryId: CATEGORY_ID,
          isIgnored: false,
        }),
      ),
    ).toEqual(['sourceLabel'])
    expect(
      rejectedPaths(
        categoryMappingInputSchema.safeParse({
          sourceLabel: 'Occasional Tables',
          sourcePath: '',
          categoryId: CATEGORY_ID,
          isIgnored: false,
        }),
      ),
    ).toEqual(['sourcePath'])
  })

  it('rejects an extra key at the object itself', () => {
    expect(
      rejectedPaths(
        categoryMappingInputSchema.safeParse({
          sourceLabel: 'Occasional Tables',
          sourcePath: null,
          categoryId: CATEGORY_ID,
          isIgnored: false,
          confidence: 0.9,
        }),
      ),
    ).toEqual([''])
  })
})

describe('scheduleInputSchema — FEAT §26 field 19', () => {
  it('accepts a six-hourly schedule, which is exactly the minimum', () => {
    expect(scheduleInputSchema.safeParse(validSchedule).success).toBe(true)
  })

  it('accepts a pair of hours whose shortest gap wraps midnight and still clears six hours', () => {
    // 18:00 and 00:00 are six hours apart across midnight and eighteen apart inside the day; the
    // six is the number that decides whether this schedule is polite.
    expect(
      scheduleInputSchema.safeParse({ ...validSchedule, cronExpression: '0 0,18 * * *' }).success,
    ).toBe(true)
  })

  it('accepts a daily schedule', () => {
    expect(
      scheduleInputSchema.safeParse({ ...validSchedule, cronExpression: '30 2 * * *' }).success,
    ).toBe(true)
  })

  it('rejects a five-minute schedule at `cronExpression`, naming the interval it computed', () => {
    const result = scheduleInputSchema.safeParse({
      ...validSchedule,
      cronExpression: '*/5 * * * *',
    })
    expect(rejectedPaths(result)).toEqual(['cronExpression'])
    expect(rejectedMessages(result)[0]).toContain('every 5 minutes')
    expect(rejectedMessages(result)[0]).toContain(String(MIN_SCHEDULE_INTERVAL_MINUTES))
  })

  it('rejects a four-hourly schedule, naming four hours’ worth of minutes', () => {
    const result = scheduleInputSchema.safeParse({
      ...validSchedule,
      cronExpression: '0 */4 * * *',
    })
    expect(rejectedPaths(result)).toEqual(['cronExpression'])
    expect(rejectedMessages(result)[0]).toContain('every 240 minutes')
  })

  it('refuses an expression it cannot read rather than assuming it is slow enough', () => {
    const result = scheduleInputSchema.safeParse({
      ...validSchedule,
      cronExpression: 'every six hours',
    })
    expect(rejectedPaths(result)).toEqual(['cronExpression'])
    expect(rejectedMessages(result)[0]).toMatch(/cannot be read/i)
  })

  it('rejects a timezone the scheduler would silently ignore, at `timezone`', () => {
    expect(
      rejectedPaths(scheduleInputSchema.safeParse({ ...validSchedule, timezone: 'Asia/Kolkata' })),
    ).toEqual(['timezone'])
  })

  it('rejects a job type outside research_job_type, at `jobType`', () => {
    expect(
      rejectedPaths(scheduleInputSchema.safeParse({ ...validSchedule, jobType: 'PRUNE' })),
    ).toEqual(['jobType'])
  })

  it('rejects an extra key at the object itself', () => {
    expect(
      rejectedPaths(scheduleInputSchema.safeParse({ ...validSchedule, nextRunAt: '2026-01-01' })),
    ).toEqual([''])
  })
})

describe('policyDecisionSchema — FEAT §26 field 22', () => {
  it('accepts each of the three decisions with reasoning', () => {
    for (const status of ['APPROVED', 'RESTRICTED', 'BLOCKED']) {
      expect(
        policyDecisionSchema.safeParse({
          status,
          notes: 'Terms reviewed by the owner on the date recorded in the audit row.',
        }).success,
      ).toBe(true)
    }
  })

  it('rejects a note shorter than the minimum, at `notes`', () => {
    const result = policyDecisionSchema.safeParse({
      status: 'APPROVED',
      notes: 'x'.repeat(POLICY_NOTES_MIN_LENGTH - 1),
    })
    expect(rejectedPaths(result)).toEqual(['notes'])
    expect(rejectedMessages(result)[0]).toContain(String(POLICY_NOTES_MIN_LENGTH))
  })

  it('rejects a missing note — the field is mandatory, not merely present', () => {
    expect(rejectedPaths(policyDecisionSchema.safeParse({ status: 'BLOCKED' }))).toEqual(['notes'])
  })

  it('rejects whitespace padded out to the minimum length', () => {
    expect(
      rejectedPaths(policyDecisionSchema.safeParse({ status: 'APPROVED', notes: ' '.repeat(40) })),
    ).toEqual(['notes'])
  })

  it('rejects UNREVIEWED, which is where a source starts rather than a decision, at `status`', () => {
    expect(
      rejectedPaths(
        policyDecisionSchema.safeParse({
          status: 'UNREVIEWED',
          notes: 'Nobody has looked at this source yet, which is not a decision.',
        }),
      ),
    ).toEqual(['status'])
  })

  it('cannot express the reviewer or the timestamp — those are the server’s to write', () => {
    expect(
      rejectedPaths(
        policyDecisionSchema.safeParse({
          status: 'APPROVED',
          notes: 'Terms reviewed by the owner on the date recorded in the audit row.',
          reviewedBy: '0f3a5c60-1d2b-4a7e-9c81-6b5d2e4f7a10',
        }),
      ),
    ).toEqual([''])
  })
})
