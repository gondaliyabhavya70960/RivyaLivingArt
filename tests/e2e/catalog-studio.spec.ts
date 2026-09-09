import { expect, test } from '@playwright/test'

import { ROLE_PERMISSIONS } from '@/lib/auth/permissions'
import { READINESS_ITEMS, readinessChecklist, unmetForPublish } from '@/lib/catalog/validation'

/**
 * The Studio catalogue surfaces, and the honest limit of what this file can prove.
 *
 * WHAT IT PROVES END TO END: every catalogue route is behind the session gate, and an anonymous
 * request reaches the login page carrying the path it wanted rather than a 404 or a blank frame.
 *
 * WHAT IT CANNOT, AND WHY IT IS NOT PRETENDED. The authenticated half — signing in as
 * `merchandiser`, creating a product, watching publication refused with "Hero image" named — needs
 * a reachable Supabase auth server. There is no way to obtain a real session without one: a forged
 * cookie is refused by `getUser()`, which is the whole reason that call is used rather than
 * `getSession()`. `studio-access.spec.ts` records the same gap for Phase 04 and answers it the same
 * way: the cases are `test.fixme` so they appear in the report, and the layers beneath them are
 * proved where they can be — the readiness gate as pure functions here, the write policies against
 * a real PostgreSQL in `tests/unit/rls/phase14.test.ts`, and the price and validation rules in
 * their own unit suites.
 */

const ROUTES = [
  '/studio/catalog/products',
  '/studio/catalog/products/new',
  '/studio/catalog/categories',
  '/studio/catalog/collections',
  '/studio/catalog/materials',
] as const

test.describe('an anonymous visitor', () => {
  for (const route of ROUTES) {
    test(`is redirected from ${route} and keeps the path they wanted`, async ({ page }) => {
      const response = await page.goto(route)

      expect(response?.status()).toBe(200)
      expect(page.url()).toContain('/studio/login')
      expect(new URL(page.url()).searchParams.get('next')).toBe(route)
    })
  }
})

/**
 * The readiness gate, asserted directly.
 *
 * NOT AN E2E TEST, and it sits here on purpose: it is the assertion the fixme'd browser cases
 * below would make, at the layer that is reachable without an auth server. If someone later makes
 * those cases run, this stays — a rule proved twice is a rule that survives one of the proofs
 * being deleted.
 */
test.describe('the publication readiness gate', () => {
  const COMPLETE = {
    slug: 'a-piece',
    sku: 'AP-1',
    title: 'A Piece',
    description: 'Described.',
    category_id: 'c1',
    price_state: 'REQUEST_QUOTE' as const,
    price_minor: null,
    price_from_minor: null,
    currency: null,
    availability_state: null,
    edition_state: null,
    edition_size: null,
    is_customizable: false,
    is_large_format: false,
    dimensions: { length_mm: 1200 },
    hero_media_id: 'm1',
    seo_title: 'A Piece',
    seo_description: 'Described.',
  }

  test('names Hero image when it is missing, rather than refusing without a reason', () => {
    const unmet = unmetForPublish(
      readinessChecklist({ ...COMPLETE, hero_media_id: null }, { materialIds: ['x'] }),
    )
    expect(unmet).toContain('Hero image')
  })

  test('is a list of the ten FEAT §22 items, never a score', () => {
    const checklist = readinessChecklist(COMPLETE, { materialIds: ['x'] })
    expect(checklist.map((entry) => entry.item)).toEqual([...READINESS_ITEMS])
    expect(unmetForPublish(checklist)).toEqual([])
  })
})

test.describe('the catalogue permission matrix', () => {
  test('a viewer may read the catalogue and may not write or publish it', () => {
    expect(ROLE_PERMISSIONS.viewer).toContain('catalog.read')
    expect(ROLE_PERMISSIONS.viewer).not.toContain('catalog.write')
    expect(ROLE_PERMISSIONS.viewer).not.toContain('catalog.publish')
  })

  test('a merchandiser may do all three', () => {
    for (const permission of ['catalog.read', 'catalog.write', 'catalog.publish'] as const) {
      expect(ROLE_PERMISSIONS.merchandiser).toContain(permission)
    }
  })
})

/**
 * The authenticated cases, recorded rather than omitted. Each needs a reachable auth server.
 */
test.describe('signed in as a merchandiser', () => {
  test.fixme('creates a product, and it appears in the list as a draft', async () => {})
  test.fixme('is refused publication with the unmet items named on the page', async () => {})
  test.fixme('publishes once the required items are met, and the card appears in /collection', async () => {})
  test.fixme('cannot choose a concept render as a hero image — it is not in the picker', async () => {})
})

test.describe('signed in as a viewer', () => {
  test.fixme('sees the product list with no submit button and no publish control', async () => {})
  test.fixme('POSTing the publish action directly gets 403 and a DENIED row in audit_logs', async () => {})
})
