import { expect, test } from '@playwright/test'

/**
 * `/studio/research/opportunities` — the header states the model and the last run; the drawer's
 * arithmetic sums to the displayed total; the INSUFFICIENT_DATA tab is visible.
 * Signed-in half guarded by `STUDIO_STORAGE_STATE`, as every Studio spec is.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the opportunities page', async ({ page }) => {
    await page.goto('/studio/research/opportunities')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

for (const width of [1920, 390]) {
  test.describe(`opportunities at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('states provenance in the header and keeps both state tabs visible', async ({ page }) => {
      await page.goto('/studio/research/opportunities')
      await expect(page.locator('[data-opp-header]')).toBeVisible()
      await expect(page.locator('[data-last-run]')).toBeVisible()
      await expect(page.locator('[data-tab="SCORED"]')).toBeVisible()
      await expect(page.locator('[data-tab="INSUFFICIENT_DATA"]')).toBeVisible()
      const explain = page.locator('[data-explain-link]').first()
      if ((await explain.count()) > 0) {
        await explain.click()
        const table = page.locator('[data-explain-table]')
        await expect(table).toBeVisible()
        const total = await page.locator('[data-explain-total]').getAttribute('data-explain-total')
        const reproduced = await page
          .locator('[data-explain-reproduced]')
          .getAttribute('data-explain-reproduced')
        expect(reproduced).toBe(total)
      }
    })
  })
}
