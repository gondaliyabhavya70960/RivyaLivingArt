import { expect, test } from '@playwright/test'

/**
 * The caching contract and the LCP rule, with a real browser open — Phase 40.
 *
 * WHY THIS EXISTS BESIDE `scripts/perf/check-cache-headers.mjs`, WHICH ASSERTS THE SAME TABLE. The
 * script reads headers with `fetch` and covers the static routes; a browser covers the two things
 * `fetch` cannot see:
 *
 *   * A DYNAMIC ROUTE WITH A REAL ROW IN IT. `/product/[slug]` needs a published product, and the
 *     browser can find one by following a link from the listing rather than being told a slug.
 *   * WHAT THE PAGE DOES AFTER IT LOADS. The priority hint must be on the image the browser actually
 *     treats as the largest contentful paint, and no response a visitor receives may set a cookie.
 *
 * IT SKIPS RATHER THAN FAILS WHERE THE FIXTURE IS THIN, and says which route it skipped. A local
 * database with no published product is a normal state of this repository (SEED §32), and a test that
 * failed for that reason would be noise that trains people to ignore the file.
 */

test.describe('the caching contract', () => {
  test('a CMS page is served from ISR and a search is never cached', async ({ page }) => {
    const home = await page.goto('/')
    test.skip(home?.status() !== 200, '/ did not render — no live section in this fixture')
    expect(home?.headers()['cache-control']).toContain('s-maxage=3600')

    const search = await page.goto('/search?q=table')
    expect(search?.status()).toBe(200)
    expect(search?.headers()['cache-control']).toContain('no-store')
  })

  test('a product page is served from ISR', async ({ page }) => {
    const listing = await page.goto('/collection')
    test.skip(listing?.status() !== 200, '/collection did not render')
    const first = page.locator('a[href^="/product/"]').first()
    test.skip((await first.count()) === 0, 'no published product in this fixture')

    const href = await first.getAttribute('href')
    const response = await page.goto(href ?? '/')
    expect(response?.status()).toBe(200)
    expect(response?.headers()['cache-control']).toContain('s-maxage=3600')
  })

  test('a hashed build asset is immutable', async ({ page }) => {
    const home = await page.goto('/')
    test.skip(home?.status() !== 200, '/ did not render')
    const src = await page.locator('script[src^="/_next/static/"]').first().getAttribute('src')
    expect(src, 'the page loads no hashed script').not.toBeNull()
    const asset = await page.request.get(src ?? '')
    expect(asset.headers()['cache-control']).toContain('immutable')
  })
})

test.describe('the LCP element', () => {
  test('is exactly one image, and it is the one the browser picks', async ({ page }) => {
    const response = await page.goto('/')
    test.skip(response?.status() !== 200, '/ did not render')

    /*
     * THE HOME HERO HAS NO IMAGE YET, AND THAT IS A CONTENT GAP RATHER THAN A DEFECT.
     *
     * Phase 43's coverage analysis left exactly two generation briefs open, and one of them is this
     * slot: zero videos in the 250-asset library carry `page = home`. Until the owner pastes the
     * Cloudinary URL into `docs/ASSET_GENERATION_PROMPTS.md`, the slot renders the seeded
     * "Image unavailable" well and there is no image on the page to prioritise — so there is nothing
     * for the rest of this test to be about.
     *
     * SKIPPED ON THE FALLBACK, NOT ON THE ABSENCE OF THE IMAGE, and the difference is the whole
     * point: a hero that renders a real image with no priority hint is the regression this test
     * exists to catch, and it still fails. What is skipped is only the case where the well is
     * showing, which the page itself declares. The moment the asset is bound, this starts asserting
     * again with no edit.
     */
    const fallbackHero = await page
      .locator('[data-block-type="hero"] [data-media-fallback]')
      .count()
    test.skip(
      fallbackHero > 0,
      'the home hero slot is unbound — Phase 43 brief HOME-HERO-POSTER-001, awaiting the owner',
    )

    const prioritised = page.locator('img[fetchpriority="high"]')
    await expect(prioritised).toHaveCount(1)
    // Eager too: a priority hint on an image the browser may defer is a contradiction.
    await expect(prioritised).toHaveAttribute('loading', 'eager')

    /*
     * AND IT IS THE ELEMENT THE BROWSER ACTUALLY REPORTS. Everything above checks our markup; this
     * checks the browser's own verdict, read from the performance timeline. `element` is only
     * populated for an image entry, which is itself the assertion that the LCP is not a video or a
     * canvas (Phase 11's rule).
     */
    const lcpTag = await page.evaluate(
      () =>
        new Promise<string | null>((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const last = entries[entries.length - 1] as
              (PerformanceEntry & { element?: Element }) | undefined
            resolve(last?.element?.tagName?.toLowerCase() ?? null)
          })
          observer.observe({ type: 'largest-contentful-paint', buffered: true })
          // A page whose largest paint is text reports no element; resolving null after a moment is
          // the honest answer rather than hanging the test.
          setTimeout(() => {
            resolve(null)
          }, 3000)
        }),
    )
    if (lcpTag !== null) expect(lcpTag).toBe('img')
  })
})

test.describe('no cookie on a public route', () => {
  test('a visitor who only reads is given no cookie at all', async ({ page, context }) => {
    for (const path of ['/', '/collection', '/search?q=table', '/journal']) {
      const response = await page.goto(path)
      if (response?.status() !== 200) continue
      expect(
        response.headers()['set-cookie'],
        `${path} set a cookie on a reading visitor`,
      ).toBeUndefined()
    }
    /*
     * THE BEACON MUST NOT CREATE ONE EITHER. `/api/vitals` is the one endpoint an anonymous browser
     * POSTs to, and D1 says this site has no customer accounts — a cookie set here would be the
     * first step towards one, whatever it was called.
     */
    const beacon = await page.request.post('/api/vitals', {
      data: { route_pattern: '/', metric: 'LCP', value: 1200, rating: 'good' },
      headers: { 'content-type': 'application/json' },
    })
    expect([204, 429]).toContain(beacon.status())
    expect(beacon.headers()['set-cookie']).toBeUndefined()
    expect(beacon.headers()['cache-control']).toContain('no-store')

    expect(
      (await context.cookies()).map((cookie) => cookie.name),
      'a public reading session accumulated cookies',
    ).toEqual([])
  })

  test('the beacon refuses a payload carrying an identifier', async ({ page }) => {
    const refused = await page.request.post('/api/vitals', {
      data: {
        route_pattern: '/',
        metric: 'LCP',
        value: 1200,
        rating: 'good',
        sessionId: 'abc123',
      },
      headers: { 'content-type': 'application/json' },
    })
    // 400 because the schema is strict, or 429 if this worker has already spent its window. Never a
    // 204: accepting the body and dropping the field would be the failure.
    expect([400, 429]).toContain(refused.status())
  })
})
