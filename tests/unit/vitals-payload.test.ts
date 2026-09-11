import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  bucketDeviceMemory,
  bucketViewport,
  connectionType,
  navigationType,
} from '@/components/patterns/VitalsReporter/context'
import { routePatternOf } from '@/components/patterns/VitalsReporter'
import {
  FORBIDDEN_PAYLOAD_KEYS,
  ROUTE_PATTERN,
  vitalsSampleSchema,
} from '@/lib/supabase/schemas/vitals'

/**
 * THE PAYLOAD CARRIES NOTHING THAT COULD IDENTIFY ANYBODY — Phase 40.
 *
 * This is the test the phase document asks for by name, and it is load-bearing rather than
 * decorative: `web_vitals_samples` has no column for an identifier, and the endpoint's schema is
 * what stops one arriving anyway. If `.strict()` were ever relaxed to `.passthrough()` the database
 * would stay clean and the endpoint would begin silently ACCEPTING session ids — which is the
 * failure this file exists to make impossible to ship.
 */

const VALID = {
  route_pattern: '/product/[slug]',
  metric: 'LCP',
  value: 2100,
  rating: 'good',
} as const

describe('the vitals payload schema', () => {
  it('accepts the minimal sample', () => {
    expect(vitalsSampleSchema.safeParse(VALID).success).toBe(true)
  })

  it('accepts every optional bucket', () => {
    const parsed = vitalsSampleSchema.safeParse({
      ...VALID,
      nav_type: 'navigate',
      effective_type: '4g',
      device_memory_bucket: 'low',
      viewport_bucket: 'mobile',
    })
    expect(parsed.success).toBe(true)
  })

  it.each(FORBIDDEN_PAYLOAD_KEYS)('refuses a body carrying `%s`', (key) => {
    const parsed = vitalsSampleSchema.safeParse({ ...VALID, [key]: 'anything at all' })
    expect(parsed.success).toBe(false)
  })

  it('refuses any unknown key, not only the ones named', () => {
    expect(vitalsSampleSchema.safeParse({ ...VALID, somethingNew: 1 }).success).toBe(false)
  })

  /*
   * THE SCHEMA CANNOT REFUSE EVERY RESOLVED PATH, AND SAYING SO IS THE HONEST THING.
   *
   * `/journal/why-resin` is a resolved article URL and is shaped exactly like a static two-segment
   * route, so no regex can tell them apart. What keeps a slug out of the database is the REPORTER,
   * which derives the pattern from a rule list rather than from `location.pathname` — and the test
   * above proves that list covers every dynamic route. The schema's job is the shapes that CAN be
   * refused, which the next case covers.
   */
  it('refuses a query string, a fragment and an upper-case segment', () => {
    for (const bad of ['/search?q=table', '/product#gallery', '/collection/Decor', 'product', '']) {
      expect(vitalsSampleSchema.safeParse({ ...VALID, route_pattern: bad }).success).toBe(false)
    }
  })

  it('refuses a value that is negative, infinite or absurd', () => {
    for (const bad of [-1, Number.POSITIVE_INFINITY, Number.NaN, 3_600_001]) {
      expect(vitalsSampleSchema.safeParse({ ...VALID, value: bad }).success).toBe(false)
    }
  })

  it('refuses a metric or rating outside the fixed sets', () => {
    expect(vitalsSampleSchema.safeParse({ ...VALID, metric: 'FID' }).success).toBe(false)
    expect(vitalsSampleSchema.safeParse({ ...VALID, rating: 'ok' }).success).toBe(false)
  })
})

describe('the route pattern rule', () => {
  it('matches the patterns the reporter can produce', () => {
    for (const pattern of ['/', '/about', '/product/[slug]', '/journal/category/[slug]']) {
      expect(ROUTE_PATTERN.test(pattern)).toBe(true)
    }
  })

  it('reduces a resolved path to its pattern', () => {
    expect(routePatternOf('/product/teak-console-01')).toBe('/product/[slug]')
    expect(routePatternOf('/collection/furniture')).toBe('/collection/[category]')
    expect(routePatternOf('/collections/velvet-hours')).toBe('/collections/[slug]')
    expect(routePatternOf('/portfolio/riverside-house')).toBe('/portfolio/[slug]')
    expect(routePatternOf('/journal/category/materials')).toBe('/journal/category/[slug]')
    expect(routePatternOf('/journal/why-bespoke-furniture')).toBe('/journal/[slug]')
  })

  it('leaves a static path alone and normalises the root', () => {
    expect(routePatternOf('/about')).toBe('/about')
    expect(routePatternOf('/')).toBe('/')
    expect(routePatternOf('/faq/')).toBe('/faq')
  })

  /**
   * THE RULE LIST MUST COVER EVERY DYNAMIC ROUTE THE APP HAS.
   *
   * A new dynamic route whose shape is not listed in the reporter would send a RESOLVED path. The
   * endpoint would refuse it, so no slug is ever stored — but the route would silently collect no
   * field data at all, which is a quiet failure rather than a loud one. This walks the app
   * directory so that adding a route without adding a rule fails here instead.
   */
  it('has a rule for every dynamic public route in the app directory', () => {
    const root = join(process.cwd(), 'app', '(site)')
    const dynamic: string[] = []
    const walk = (dir: string, segments: string[]): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (!statSync(full).isDirectory()) continue
        const next = entry.startsWith('(') && entry.endsWith(')') ? segments : [...segments, entry]
        if (readdirSync(full).includes('page.tsx') && next.some((s) => s.startsWith('['))) {
          dynamic.push(`/${next.join('/')}`)
        }
        walk(full, next)
      }
    }
    walk(root, [])

    const source = readFileSync(
      join(process.cwd(), 'components', 'patterns', 'VitalsReporter', 'index.tsx'),
      'utf8',
    )
    for (const pattern of dynamic) {
      expect(source, `${pattern} has no rule in VitalsReporter's PATTERNS`).toContain(
        `'${pattern}'`,
      )
    }
    expect(dynamic.length).toBeGreaterThan(0)
  })
})

describe('the context buckets', () => {
  it('collapses device memory to three values and never reports the figure', () => {
    expect(bucketDeviceMemory({ deviceMemory: 0.5 })).toBe('low')
    expect(bucketDeviceMemory({ deviceMemory: 2 })).toBe('low')
    expect(bucketDeviceMemory({ deviceMemory: 4 })).toBe('medium')
    expect(bucketDeviceMemory({ deviceMemory: 8 })).toBe('high')
  })

  it('says nothing when the browser says nothing', () => {
    expect(bucketDeviceMemory({})).toBeNull()
    expect(bucketDeviceMemory(undefined)).toBeNull()
    expect(connectionType({})).toBeNull()
    // `bucketViewport()` with no argument reads `globalThis.innerWidth`, which a browser always
    // has — so the null branch is about a value that is present and unusable, not about omission.
    expect(bucketViewport(Number.NaN)).toBeNull()
    expect(bucketViewport(0)).toBeNull()
    expect(navigationType(undefined)).toBeNull()
  })

  it('collapses the viewport to a class, never a width', () => {
    expect(bucketViewport(390)).toBe('mobile')
    expect(bucketViewport(768)).toBe('tablet')
    expect(bucketViewport(1440)).toBe('desktop')
  })

  it('passes through only values the database will accept', () => {
    expect(connectionType({ connection: { effectiveType: '3g' } })).toBe('3g')
    expect(connectionType({ connection: { effectiveType: '5g' } })).toBeNull()
    expect(navigationType('back-forward')).toBe('back-forward')
    expect(navigationType('something-new')).toBeNull()
  })

  /** Every bucket a helper can return must be a value the endpoint's schema admits. */
  it('never produces a value the payload schema would refuse', () => {
    const samples = [
      { device_memory_bucket: bucketDeviceMemory({ deviceMemory: 1 }) },
      { device_memory_bucket: bucketDeviceMemory({ deviceMemory: 3 }) },
      { device_memory_bucket: bucketDeviceMemory({ deviceMemory: 16 }) },
      { viewport_bucket: bucketViewport(320) },
      { viewport_bucket: bucketViewport(800) },
      { viewport_bucket: bucketViewport(2560) },
      { effective_type: connectionType({ connection: { effectiveType: 'slow-2g' } }) },
      { nav_type: navigationType('prerender') },
    ]
    for (const extra of samples) {
      expect(vitalsSampleSchema.safeParse({ ...VALID, ...extra }).success).toBe(true)
    }
  })
})
