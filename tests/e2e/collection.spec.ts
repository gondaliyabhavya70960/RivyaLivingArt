import { expect, test, type Page } from '@playwright/test'

/**
 * The catalogue with products in it.
 *
 * WHEN THIS RUNS. Only when the database it is pointed at has published products — otherwise every
 * test skips and `collection-empty.spec.ts` is the one that matters. Nothing in this file creates a
 * product: `products` has zero rows by policy (SEED §32), and a fixture that inserted one to make a
 * test pass would be the first fabricated inventory in the project.
 *
 * WHAT IT PROVES. The vocabulary is honest (a quote-only card shows no digit), and the listing is
 * genuinely server-driven: every assertion about filters, sort and pagination is made with
 * JavaScript disabled, because "works without JavaScript" is a claim about the markup and not
 * about a hydration path.
 */

const PATH = '/collection/furniture'

async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}

async function hasProducts(page: Page): Promise<boolean> {
  if (!(await reachable(page, PATH))) return false
  return (await page.locator('[data-product-card]').count()) > 0
}

test.describe('the product grid', () => {
  test('renders a card per product, each with its own price state', async ({ page }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')

    const cards = page.locator('[data-product-card]')
    expect(await cards.count()).toBeGreaterThan(0)

    // Every card declares which of the four states it is in, and it is one of the four.
    const states = await cards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-price-state')),
    )
    for (const state of states) {
      expect(['FIXED', 'STARTING_FROM', 'REQUEST_QUOTE', 'PRICE_ON_REQUEST']).toContain(state)
    }
  })

  test('a quote-only card carries a label and NOT ONE DIGIT', async ({ page }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')

    const quoteCards = page.locator(
      '[data-product-card][data-price-state="REQUEST_QUOTE"], [data-product-card][data-price-state="PRICE_ON_REQUEST"]',
    )
    const count = await quoteCards.count()
    test.skip(count === 0, 'no quote-only products in this database')

    for (let index = 0; index < count; index += 1) {
      const card = quoteCards.nth(index)
      await expect(card.locator('[data-price-label]')).toHaveCount(1)
      await expect(card.locator('[data-price-amount]')).toHaveCount(0)
      // Belt and braces: no digit anywhere in the price row, however it got there.
      const priceText = await card.locator('[data-price-label]').innerText()
      expect(priceText).not.toMatch(/\d/)
    }
  })

  test('a priced card shows its label and its amount as separate nodes', async ({ page }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')

    const priced = page.locator(
      '[data-product-card][data-price-state="FIXED"], [data-product-card][data-price-state="STARTING_FROM"]',
    )
    const count = await priced.count()
    test.skip(count === 0, 'no priced products in this database')

    await expect(priced.first().locator('[data-price-amount]')).toHaveCount(1)
    expect(await priced.first().locator('[data-price-amount]').innerText()).toMatch(/\d/)
  })

  test('carries no cart, checkout or wishlist affordance', async ({ page }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')

    const forbidden = /\b(add to (cart|bag|basket)|checkout|wishlist|buy now|place order)\b/i
    expect(await page.locator('main').innerText()).not.toMatch(forbidden)
  })

  test('a limited edition states its size beside the badge', async ({ page }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')

    const badges = page.locator('[data-product-badge="edition"]')
    const count = await badges.count()
    test.skip(count === 0, 'no edition badges in this database')

    // Every badge carrying a detail carries a NUMBER — the database refuses a limited edition
    // without one, so a badge with an empty detail would mean the renderer invented it.
    const details = await page
      .locator('[data-badge-detail]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ''))
    for (const detail of details) expect(detail).toMatch(/^\d+$/)
  })
})

/**
 * Everything below runs with JavaScript DISABLED.
 *
 * The listing's whole design — a `<form method="get">` rail, a second form for sort, real anchors
 * for pagination — exists so that these pass. If any of them needs a script, the design has been
 * quietly replaced by a client-side one.
 */
test.describe('with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false })

  test('a filter applies, and the canonical points back at the unfiltered category', async ({
    page,
  }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')

    const facet = page.locator('[data-facet-value]').first()
    test.skip((await facet.count()) === 0, 'no facets rendered — nothing to filter by')

    const value = await facet.getAttribute('data-facet-value')
    await facet.check()
    await page.locator('[data-filter-rail] button[type="submit"]').click()

    await expect(page).toHaveURL(new RegExp(`${value}`))
    // Phase 39: a filtered view is one of an unbounded set; the category is the page and the
    // view is noindex. Before Phase 39 the canonical carried the filter.
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).not.toContain(String(value))
    expect(canonical).toMatch(new RegExp(`${PATH}$`))
    const robots = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robots).toMatch(/noindex/)
  })

  test('an unparseable sort is dropped from the canonical URL', async ({ page }) => {
    test.skip(!(await reachable(page, `${PATH}?sort=price`)), 'category page not published')

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).not.toContain('sort=')
  })

  test('the sort control changes the order and survives in the URL', async ({ page }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')
    test.skip(
      (await page.locator('[data-sort-form]').count()) === 0,
      'sort control not rendered — fewer than two labelled options',
    )

    await page.locator('[data-sort-form] select[name="sort"]').selectOption('title')
    await page.locator('[data-sort-form] button[type="submit"]').click()

    await expect(page).toHaveURL(/sort=title/)
    // A sort is a view too: the canonical is the bare category (Phase 39).
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).not.toContain('sort=')
  })

  test('pagination is real links with rel prev/next and a canonical per page', async ({ page }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')
    test.skip(
      (await page.locator('[data-pagination]').count()) === 0,
      'a single page of results — nothing to paginate',
    )

    /*
     * `link[rel=...]`, NOT `head link[rel=...]`.
     *
     * Next streams metadata into the body and relocates it to the head with a script. With
     * JavaScript disabled — which is the whole point of this block — the tag is a real, valid
     * `<link>` that simply has not been moved yet, and every crawler reads it either way.
     * Scoping the selector to `head` would assert the relocation rather than the metadata.
     */
    await expect(page.locator('link[rel="next"]')).toHaveCount(1)
    await expect(page.locator('link[rel="prev"]')).toHaveCount(0)

    await page.locator('[data-pagination] a[rel="next"]').click()

    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('[data-current-page]')).toHaveText('2')
    await expect(page.locator('link[rel="prev"]')).toHaveCount(1)
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toContain('page=2')
  })

  test('a filtered listing that matches nothing says so, and offers the way back', async ({
    page,
  }) => {
    test.skip(!(await hasProducts(page)), 'no published products in this database')

    // Two facets from different dimensions that cannot both be true of one product would be ideal;
    // an impossible material slug is guaranteed to match nothing and is dropped from the canonical
    // URL, so this uses a real dimension with an impossible combination instead.
    await page.goto(
      `${PATH}?price=FIXED&price=STARTING_FROM&availability=READY_STOCK&edition=OPEN_EDITION`,
    )
    const empty = page.locator('[data-catalog-empty="filtered"]')
    if ((await empty.count()) === 0) {
      test.skip(true, 'that combination happens to match something in this database')
    }
    await expect(empty).toBeVisible()
    // TWO of them, and both are wanted: one in the rail beside the filters that produced this,
    // one in the empty state itself. `.first()` rather than a narrower selector, because the
    // assertion is that a way back exists — not which of the two the visitor uses.
    await expect(page.locator('[data-clear-filters]').first()).toBeVisible()
  })
})
