import { expect, test, type Page } from '@playwright/test'

/**
 * THE CATALOGUE FILTERS, FROM THE URL — Phase 42.
 *
 * `lib/catalog/query.ts` is unit-tested: it parses parameters, rejects what it does not recognise
 * and produces a query. What no unit test can see is the ROUND TRIP — that the rail's form writes
 * the parameter the parser reads, that the page reflects the state the URL describes, and that
 * clearing puts the visitor back where they started.
 *
 * THE FILTER STATE LIVES IN THE URL, AND THAT IS A PRODUCT DECISION WORTH DEFENDING. A filtered
 * catalogue is a page somebody sends to somebody else — "look at these" — and a rail that kept its
 * state in component memory would send a link that opens on everything. It is also what makes the
 * back button work.
 *
 * IT ASSERTS NO COPY. Every visible word comes from the CMS; the hooks are `data-filter-rail`,
 * `data-clear-filters` and the form's own field names.
 */

const CATALOGUE = '/collection'

async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}

/** The first filter checkbox the rail offers, whatever the catalogue happens to hold. */
async function firstFilter(page: Page): Promise<{ name: string; value: string } | null> {
  const input = page.locator('[data-filter-rail] input[type="checkbox"]').first()
  if ((await input.count()) === 0) return null
  const name = await input.getAttribute('name')
  const value = await input.getAttribute('value')
  return name !== null && value !== null ? { name, value } : null
}

test.describe('the catalogue', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'filter behaviour is asserted once')

  test('renders without any filter applied', async ({ page }) => {
    test.skip(!(await reachable(page, CATALOGUE)), 'the catalogue is not published')
    await expect(page.locator('h1')).toHaveCount(1)
    // An unfiltered catalogue offers no "clear" — there is nothing to clear.
    await expect(page.locator('[data-clear-filters]')).toHaveCount(0)
  })

  test('puts a chosen filter in the URL and keeps the checkbox checked', async ({ page }) => {
    test.skip(!(await reachable(page, CATALOGUE)), 'the catalogue is not published')
    const filter = await firstFilter(page)
    test.skip(filter === null, 'the catalogue offers no filters in this database')

    await page.locator(`[data-filter-rail] input[name="${filter!.name}"]`).first().check()
    /*
     * SUBMITTED, NOT LIVE. The rail is a `<form>`: a filter is applied by submitting, which is what
     * makes it work without JavaScript. A test that waited for a live update would hang on a
     * perfectly good page.
     */
    await page.locator('[data-filter-rail] button[type="submit"]').first().click()
    await page.waitForURL(new RegExp(`${filter!.name}=`))

    const url = new URL(page.url())
    expect(url.searchParams.get(filter!.name)).toBe(filter!.value)
    // The page came back describing the state the URL asks for.
    await expect(
      page.locator(`[data-filter-rail] input[name="${filter!.name}"][value="${filter!.value}"]`),
    ).toBeChecked()
  })

  test('opens on the same results when the filtered URL is pasted fresh', async ({ page }) => {
    /*
     * THE PROPERTY THE URL STATE EXISTS FOR. A visitor sends the link to somebody; that person must
     * see what the sender saw. Navigating to the address directly, with no history and no form
     * submission, is the only way to assert it.
     */
    test.skip(!(await reachable(page, CATALOGUE)), 'the catalogue is not published')
    const filter = await firstFilter(page)
    test.skip(filter === null, 'the catalogue offers no filters in this database')

    const direct = `${CATALOGUE}?${filter!.name}=${encodeURIComponent(filter!.value)}`
    const response = await page.goto(direct)
    expect(response?.status()).toBe(200)
    await expect(
      page.locator(`[data-filter-rail] input[name="${filter!.name}"][value="${filter!.value}"]`),
    ).toBeChecked()
    await expect(page.locator('[data-clear-filters]')).toHaveCount(1)
  })

  test('clearing returns to the unfiltered address', async ({ page }) => {
    test.skip(!(await reachable(page, CATALOGUE)), 'the catalogue is not published')
    const filter = await firstFilter(page)
    test.skip(filter === null, 'the catalogue offers no filters in this database')

    await page.goto(`${CATALOGUE}?${filter!.name}=${encodeURIComponent(filter!.value)}`)
    await page.locator('[data-clear-filters]').first().click()
    await page.waitForURL((url) => !url.searchParams.has(filter!.name))
    expect(new URL(page.url()).searchParams.has(filter!.name)).toBe(false)
  })

  test('ignores a parameter it does not recognise rather than failing', async ({ page }) => {
    /*
     * A CATALOGUE URL IS PASTED, TRUNCATED, EDITED AND CRAWLED. An unknown parameter — a tracking
     * tag, somebody's experiment, a typo — must leave a working page, and a value the parser
     * refuses must not become a 500. Both are answered by `accepted()` in `lib/catalog/query.ts`;
     * this is the assertion that it is actually wired to the route.
     */
    for (const query of [
      '?utm_source=newsletter',
      '?material=<script>alert(1)</script>',
      '?price=not-a-band&sort=nonsense',
      '?page=-1',
    ]) {
      const response = await page.goto(`${CATALOGUE}${query}`)
      expect(response?.status(), `${query} did not render`).toBe(200)
      await expect(page.locator('h1'), query).toHaveCount(1)
    }
  })

  test('a filtered catalogue is not offered to search engines', async ({ page }) => {
    /*
     * EVERY COMBINATION OF FILTERS IS A DIFFERENT URL SHOWING A SUBSET OF THE SAME PIECES. Letting
     * a crawler index them buries the real catalogue under near-duplicates of itself. Phase 39 made
     * a filtered listing `noindex` with the unfiltered path as its canonical.
     */
    test.skip(!(await reachable(page, CATALOGUE)), 'the catalogue is not published')
    const filter = await firstFilter(page)
    test.skip(filter === null, 'the catalogue offers no filters in this database')

    await page.goto(`${CATALOGUE}?${filter!.name}=${encodeURIComponent(filter!.value)}`)
    const robots = await page.locator('meta[name="robots"]').first().getAttribute('content')
    expect(robots ?? '', 'a filtered listing is indexable').toContain('noindex')

    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href')
    expect(canonical ?? '', 'the canonical still carries the filter').not.toContain(filter!.name)
  })
})
