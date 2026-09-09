import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * The catalogue while it is empty — the PRIMARY listing test, not a secondary one.
 *
 * WHY THIS FILE COMES FIRST. `products` ships with zero rows and stays that way: nothing seeds a
 * product, nothing imports one, and no fixture creates one (SEED §32, D10). The empty catalogue is
 * therefore the state this site launches in, and "every category page renders its own copy and an
 * honest empty state" is the behaviour that has to be right on day one. A grid full of demo
 * products would look more finished and would be a lie about what Rivya has made.
 *
 * THE ZERO-CARD ASSERTION IS THE POINT. If a demo product is ever added "just to see the grid",
 * this fails — on every category page at once, by counting `[data-product-card]` elements.
 *
 * IT SKIPS WHEN THE CATALOGUE IS NOT EMPTY, rather than failing: `collection.spec.ts` is the
 * companion that runs in that state, and a developer with three test products in their local
 * database should not have to choose which suite to believe.
 */

/** SEED §56 priority order, which is also `categories.sort_order`. */
const CATEGORIES = [
  'furniture',
  'collectible-design',
  '3d-resin',
  'wall-statement-art',
  'preservation',
  'decor',
  'gifts',
] as const

async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}

async function cardCount(page: Page): Promise<number> {
  return page.locator('[data-product-card]').count()
}

test.describe('/collection while the catalogue is empty', () => {
  test('the landing page renders and shows no products', async ({ page }) => {
    test.skip(!(await reachable(page, '/collection')), 'no published sections on /collection')
    test.skip((await cardCount(page)) > 0, 'this database has published products')

    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('[data-catalog-empty="collection"]')).toBeVisible()
  })

  for (const slug of CATEGORIES) {
    test(`/collection/${slug} renders its own copy and its empty state`, async ({ page }) => {
      const path = `/collection/${slug}`
      test.skip(!(await reachable(page, path)), `no published sections on ${path}`)
      test.skip((await cardCount(page)) > 0, 'this database has published products')

      // Its OWN copy: the seeded hero, not a shared placeholder. One h1, and it is not empty.
      const heading = page.locator('h1')
      await expect(heading).toHaveCount(1)
      expect((await heading.innerText()).trim().length).toBeGreaterThan(0)

      // SEED §27's empty state, and not the filtered one — nothing is filtering.
      await expect(page.locator('[data-catalog-empty="collection"]')).toBeVisible()
      await expect(page.locator('[data-catalog-empty="filtered"]')).toHaveCount(0)

      expect(await cardCount(page)).toBe(0)
    })
  }

  test('an unknown category is a 404, not an empty grid', async ({ page }) => {
    const response = await page.goto('/collection/not-a-category')
    expect(response?.status()).toBe(404)
  })

  test('a page past the end is a 404 rather than a 500', async ({ page }) => {
    test.skip(!(await reachable(page, '/collection')), 'no published sections on /collection')
    const response = await page.goto('/collection?page=99')
    expect(response?.status()).toBe(404)
  })

  test('no cart, checkout or wishlist affordance exists anywhere on the listing', async ({
    page,
  }) => {
    test.skip(!(await reachable(page, '/collection/furniture')), 'no published sections')

    // D1 and FEAT §39: conversion ends in an inquiry and a WhatsApp handoff. There is no basket.
    const forbidden = /\b(add to (cart|bag|basket)|checkout|wishlist|buy now|place order)\b/i
    const body = await page.locator('main').innerText()
    expect(body).not.toMatch(forbidden)
    await expect(page.locator('[data-cart], [data-checkout], [data-wishlist]')).toHaveCount(0)
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    test.skip(!(await reachable(page, '/collection/furniture')), 'no published sections')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(serious.map((violation) => violation.id)).toEqual([])
  })

  test('the document never scrolls sideways', async ({ page }) => {
    test.skip(!(await reachable(page, '/collection/furniture')), 'no published sections')

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }))
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1)
  })
})
