import { expect, test } from '@playwright/test'

/**
 * `/studio/research/compare` — a set is created, given members, recomputed, and every panel it
 * renders is headed by its coverage badge.
 *
 * Guarded by `STUDIO_STORAGE_STATE` for the reason every signed-in spec here is: a real session
 * needs an auth server the local PostgREST shim does not run. The anonymous half runs everywhere.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the compare list', async ({ page }) => {
    await page.goto('/studio/research/compare')
    await expect(page).toHaveURL(/\/studio\/login/)
  })

  test('cannot reach a set either', async ({ page }) => {
    await page.goto('/studio/research/compare/00000000-0000-4000-8000-000000003103')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

for (const width of [1920, 390]) {
  test.describe(`the compare workbench at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('creates a set, adds a source, recomputes, reads the badges, deletes', async ({
      page,
    }) => {
      await page.goto('/studio/research/compare')
      const slug = `e2e-${Date.now().toString(36)}`
      await page.fill('input[name="name"]', `E2E ${slug}`)
      await page.fill('input[name="slug"]', slug)
      await page.click('[data-create-set-submit]')
      await expect(page).toHaveURL(/\/studio\/research\/compare\/[0-9a-f-]{36}/)

      const sources = page.locator('select[name="source_id"] option')
      if ((await sources.count()) > 1) {
        await page.selectOption('select[name="source_id"]', { index: 1 })
        await page.click('[data-add-member]')
        await expect(page.locator('[data-member]')).toHaveCount(1)
      }

      await page.click('[data-recompute]')
      await expect(page.locator('[data-computed-from]')).toBeVisible()
      const panels = page.locator('[data-analysis-panel]')
      const count = await panels.count()
      for (let i = 0; i < count; i += 1) {
        await expect(panels.nth(i).locator('[data-coverage-badge]')).toBeVisible()
      }
      // No combined total anywhere: every price panel names one currency.
      const pricePanels = page.locator('[data-analysis-panel^="price-"]')
      for (let i = 0; i < (await pricePanels.count()); i += 1) {
        await expect(pricePanels.nth(i)).toHaveAttribute('data-analysis-panel', /^price-[A-Z]{3}$/)
      }

      await page.click('[data-delete-set]')
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /delete/i })
        .click()
      await expect(page).toHaveURL(/\/studio\/research\/compare$/)
    })
  })
}
