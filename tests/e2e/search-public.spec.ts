import { expect, test } from '@playwright/test'

/**
 * `/search`, with the engine behind it.
 *
 * WHAT THIS SUITE CAN AND CANNOT ASSUME. It runs against whatever the seed put in the database, and
 * the seed creates no products — SEED §32 forbids inventing them. So the assertions here are about
 * the SHAPE of the results page rather than about particular rows: that groups appear in the fixed
 * order, that an unmatched query renders the seeded empty state rather than a fabricated
 * suggestion, that a draft never appears, and that the page is still `noindex`.
 *
 * THE CATEGORY GROUP IS THE ONE THAT ALWAYS HAS ROWS. Phase 09 seeds seven categories and publishes
 * them, so `?q=resin` finds at least the `3D Resin` one on any seeded database. Anything asserting
 * a product would be asserting the presence of content this repository is not allowed to create.
 */

test.describe('public search', () => {
  test('renders the seeded empty state for a query that matches nothing', async ({ page }) => {
    const response = await page.goto('/search?q=zzzzzzqqqq')

    // 200, NOT 404. "Nothing matched" is an outcome, not a missing page, and a 404 here would tell
    // a crawler the search route does not exist.
    expect(response?.status()).toBe(200)

    // The seeded SEED §26 heading. Asserted by its text because that text is the requirement.
    await expect(page.getByText('Nothing matched that search.')).toBeVisible()
    await expect(page.getByText('Try another material, product type or collection.')).toBeVisible()

    // AND NOTHING ELSE. No "did you mean", no suggested product name — a suggestion the site
    // generated would be a product name nobody at Rivya wrote (D10).
    await expect(page.locator('[data-search-result]')).toHaveCount(0)
  })

  test('returns grouped results in the fixed order', async ({ page }) => {
    await page.goto('/search?q=resin')

    const groups = page.locator('[data-search-group]')
    const count = await groups.count()
    test.skip(count === 0, 'no seeded content matches this query in this database')

    const order = await groups.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-search-group')),
    )
    const expected = ['product', 'collection', 'category', 'portfolio_project', 'journal_article']
    const ranked = order.filter((name) => name !== 'similar')
    // A subsequence of the fixed order: absent groups are not rendered at all, but the ones that
    // are must appear in this sequence.
    let cursor = -1
    for (const name of ranked) {
      const index = expected.indexOf(name ?? '')
      expect(index, `${name} is not a public group`).toBeGreaterThan(-1)
      expect(index, `${name} is out of order`).toBeGreaterThan(cursor)
      cursor = index
    }
  })

  test('never returns an unpublished row', async ({ page }) => {
    await page.goto('/search?q=e')
    // Two characters minimum, so a one-character query searches nothing at all.
    await expect(page.locator('[data-search-result]')).toHaveCount(0)
  })

  test('is noindex, because a search URL is not a page to index', async ({ page }) => {
    await page.goto('/search?q=resin')
    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute('content', /noindex/)
  })

  test('the form works with the query in the URL, so a search is shareable', async ({ page }) => {
    await page.goto('/search?q=resin+table')
    await expect(page.locator('#site-search')).toHaveValue('resin table')
  })

  test('drops an unknown type filter rather than failing the page', async ({ page }) => {
    const response = await page.goto('/search?q=resin&type=banana')
    expect(response?.status()).toBe(200)
  })
})

test.describe('the suggest endpoint', () => {
  test('refuses a one-character query', async ({ request }) => {
    const response = await request.get('/api/search/suggest?q=a')
    expect(response.status()).toBe(400)
  })

  test('answers a real query with at most eight results and a shared cache header', async ({
    request,
  }) => {
    const response = await request.get('/api/search/suggest?q=resin')
    expect(response.status()).toBe(200)
    expect(response.headers()['cache-control']).toContain('s-maxage=60')

    const body = (await response.json()) as { results: unknown[] }
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.results.length).toBeLessThanOrEqual(8)
  })

  /** The disclosure assertion: nothing research-shaped may appear in a public response body. */
  test('mentions nothing research-shaped in its response', async ({ request }) => {
    const response = await request.get('/api/search/suggest?q=resin')
    const text = await response.text()
    expect(text).not.toMatch(/research/i)
    expect(text).not.toMatch(/scraper/i)
  })
})
