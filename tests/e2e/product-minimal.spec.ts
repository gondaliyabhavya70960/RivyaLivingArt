import { expect, test, type Page } from '@playwright/test'

/**
 * A product with almost nothing filled in must still read as a finished page.
 *
 * THIS IS THE PHASE'S REAL RISK, and it is not a bug that throws. Early real products will have a
 * title, a category, a price state and one photograph — and a page designed around a product with
 * everything filled degrades into a column of empty headings, orphan rails and zero-height bands.
 * Every one of those tells a visitor that something failed to load.
 *
 * SO THE ASSERTIONS ARE ABOUT ABSENCE AGAIN. A band with no content must not be in the DOM at all,
 * because "absent" and "empty" look identical to the person who wrote the component and completely
 * different to the person reading the page.
 *
 * WHAT THIS FILE DOES NOT DO IS CREATE THE PRODUCT. `products` has zero rows by policy (SEED §32),
 * and a fixture inserting one would be the first fabricated inventory in the project. It runs
 * against whatever the database actually holds and skips when there is nothing — which is the
 * honest state at the end of Phase 15.
 */

async function firstProductPath(page: Page): Promise<string | null> {
  const response = await page.goto('/collection')
  if (response?.status() !== 200) return null
  return page.locator('[data-product-card] a[href^="/product/"]').first().getAttribute('href')
}

/**
 * The bands that are allowed to be absent, each with the content that justifies its presence.
 *
 * EVERY SELECTOR HERE IS ONE THE COMPONENTS ACTUALLY EMIT. That is worth stating because a spec
 * built on invented hooks does not fail — it finds nothing, skips every branch, and reports green
 * forever. My first draft of this file asked for `[data-material-story]` and `[data-related-item]`,
 * neither of which exists: the band is `data-material-band` and a related item is the ordinary
 * `data-product-card`, scoped to the section that holds it.
 */
const OPTIONAL_BANDS = [
  {
    band: '[data-product-specifications]',
    content: '[data-product-specifications] [data-spec-row]',
  },
  { band: '[data-material-band]', content: '[data-material-band] [data-material-study]' },
  { band: '[data-related-content]', content: '[data-related-content] [data-product-card]' },
  { band: '[data-gallery-thumbnails]', content: '[data-gallery-thumbnail]' },
] as const

test.describe('a minimally-populated product', () => {
  test('renders exactly one h1', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    await expect(page.locator('h1')).toHaveCount(1)
  })

  test('has no band present but empty', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)

    for (const { band, content } of OPTIONAL_BANDS) {
      const present = await page.locator(band).count()
      if (present === 0) continue
      expect(
        await page.locator(content).count(),
        `${band} is in the DOM with no ${content} inside it`,
      ).toBeGreaterThan(0)
    }
  })

  test('has no heading with nothing under it', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)

    // A heading whose section contains only the heading is the shape an empty band takes once the
    // band itself has been removed but its title has not.
    const empty = await page.evaluate(() => {
      const bad: string[] = []
      for (const section of document.querySelectorAll('section')) {
        const heading = section.querySelector('h1, h2, h3, h4')
        if (heading === null) continue
        const rest = (section.textContent ?? '').replace(heading.textContent ?? '', '').trim()
        if (rest === '') bad.push(heading.textContent ?? '(unnamed)')
      }
      return bad
    })
    expect(empty).toEqual([])
  })

  test('has no zero-height container among the bands it did render', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)

    for (const { band } of OPTIONAL_BANDS) {
      const locator = page.locator(band)
      if ((await locator.count()) === 0) continue
      const box = await locator.first().boundingBox()
      expect(box?.height ?? 0, `${band} renders with zero height`).toBeGreaterThan(0)
    }
  })

  test('renders the inquiry rail with only the allowlisted actions', async ({ page }) => {
    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    const rail = page.locator('[data-inquiry-rail]')
    if ((await rail.count()) === 0) return

    // At most three, never four, and the fourth would be `Place Order`.
    const actions = rail.locator('a')
    const count = await actions.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(3)

    for (let i = 0; i < count; i += 1) {
      const href = await actions.nth(i).getAttribute('href')
      // Both targets carry the product, which is the parameter contract Phase 19 will read.
      expect(href).toMatch(/^\/(contact|custom-commissions)\?product=/)
    }
  })

  test('reads as complete with JavaScript disabled', async ({ browser }) => {
    // The page is server-rendered, so a visitor with JavaScript off must get the same page minus
    // the lightbox. If a band only appears after hydration, it does not really exist.
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const path = await firstProductPath(page)
    test.skip(path === null, 'no published products in this database')

    await page.goto(path as string)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('[data-gallery-stills]')).toHaveCount(1)

    await context.close()
  })
})
