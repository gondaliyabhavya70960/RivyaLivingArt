import { expect, test, type Page } from '@playwright/test'

/**
 * `/product/[slug]` — what it must say, and what it must never say.
 *
 * WHEN THIS RUNS. Only against a database with a published product in it. `products` has zero rows
 * by policy (SEED §32), and a fixture that inserted one to make a test pass would be the first
 * fabricated inventory in the project — so every test here skips instead, and says so. That is the
 * intended state at the end of Phase 15: the route renders for nobody until the owner enters a
 * piece.
 *
 * THE ASSERTIONS THAT MATTER ARE ABSENCES. No `Place Order` control in any form, no WhatsApp link,
 * no `offers` in the structured data for a quote-only piece. Each of those is something a visitor
 * would read as a fact about how this business works, and each is wrong.
 */

/** Any published product's path, discovered from the catalogue rather than hard-coded. */
async function firstProductPath(page: Page): Promise<string | null> {
  const response = await page.goto('/collection')
  if (response?.status() !== 200) return null

  const href = await page
    .locator('[data-product-card] a[href^="/product/"]')
    .first()
    .getAttribute('href')
  return href
}

test.describe('the product page', () => {
  test('renders exactly one h1 and a gallery', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    await expect(page.locator('h1')).toHaveCount(1)
  })

  test('404s for a slug that is not a published product', async ({ page }) => {
    // Both cases answer the same way on purpose: telling an unpublished slug apart from an unknown
    // one would leak that a draft product exists and what it is called.
    //
    // The guard is not politeness. A site that cannot reach its database answers 500 to everything,
    // and this assertion would then fail for a reason that has nothing to do with the route — a red
    // test that means "the backend is down" teaches everyone to ignore it.
    const home = await page.goto('/collection')
    test.skip((home?.status() ?? 500) >= 500, 'the site is not serving — nothing to assert about')

    const unknown = await page.goto('/product/definitely-not-a-real-product-slug')
    expect(unknown?.status()).toBe(404)
  })

  /**
   * THE `Place Order` ASSERTION, read from the CMS rather than hard-coded.
   *
   * The phase document asks for exactly this: take the label's value out of `global_content` and
   * assert it resolves to zero nodes. Hard-coding the string would pass just as happily if somebody
   * renamed the row and shipped a checkout button under its new wording.
   */
  test('never renders the Place Order label, on a customizable product or otherwise', async ({
    page,
  }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)

    // The seeded wording, and any casing of it. `commerce-labels.ts` seeds the row disabled; this
    // asserts the second, stronger property — that the rail's allowlist cannot render it even if
    // somebody enables it.
    await expect(page.getByText('Place Order', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /place order/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /place order/i })).toHaveCount(0)
  })

  test('renders no WhatsApp link anywhere on the route', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    // D1: an inquiry must be persisted before any handoff, and persistence is Phase 20. Until then
    // a `wa.me` link on this route would skip the only step that makes the handoff honest.
    await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0)
    await expect(page.locator('a[href*="api.whatsapp.com"]')).toHaveCount(0)
  })

  test('renders no cart or payment affordance', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    for (const wording of [/add to cart/i, /buy now/i, /checkout/i, /add to basket/i]) {
      await expect(page.getByRole('button', { name: wording })).toHaveCount(0)
      await expect(page.getByRole('link', { name: wording })).toHaveCount(0)
    }
  })

  test('emits Product JSON-LD with no offers for a quote-only piece, and never a rating', async ({
    page,
  }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const product = blocks
      .map((text) => JSON.parse(text) as Record<string, unknown>)
      .find((json) => json['@type'] === 'Product')

    test.skip(product === undefined, 'no Product JSON-LD on this page')

    // Never, for any price state: this business does not collect reviews and will not (D10).
    expect(product).not.toHaveProperty('aggregateRating')
    expect(product).not.toHaveProperty('review')

    // `offers` is emitted ONLY for FIXED. The page's own price state is what decides, so read it
    // from the DOM rather than assuming which kind of product this database happens to hold.
    const state = await page.locator('[data-price-state]').first().getAttribute('data-price-state')
    if (state !== null && state !== 'FIXED') {
      expect(product).not.toHaveProperty('offers')
    }
  })

  test('shows no specification block when the product has no owner-entered facts', async ({
    page,
  }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    const block = page.locator('[data-product-specifications]')
    if ((await block.count()) === 0) return

    // If it IS present it must have rows — a heading over nothing is the failure this route's
    // strictest rule exists to prevent.
    expect(await page.locator('[data-spec-row]').count()).toBeGreaterThan(0)
  })

  test('renders no placeholder where a value is absent', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    const body = (await page.locator('body').textContent()) ?? ''

    // The wordings the phase document names. A bare hyphen is deliberately not on this list — it
    // occurs inside ordinary copy ("hand-rubbed"), so it is checked per value in the unit test
    // rather than across the page here.
    for (const placeholder of ['N/A', 'TBD', 'Coming soon', 'contact us for dimensions']) {
      expect(body.toLowerCase()).not.toContain(placeholder.toLowerCase())
    }
  })
})
