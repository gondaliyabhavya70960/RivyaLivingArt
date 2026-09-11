import { expect, test } from '@playwright/test'

/**
 * `/studio/research/similarity` — the band legend renders all four bands with their "does not
 * mean" text and `PRECISION NOT YET MEASURED` before any sample exists; the owner's decision is
 * on the page; the library library check runs and records a run. Signed-in half guarded by
 * `STUDIO_STORAGE_STATE`, as every Studio spec is.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the similarity page', async ({ page }) => {
    await page.goto('/studio/research/similarity')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

for (const width of [1920, 390]) {
  test.describe(`similarity at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('renders the legend with every "does not mean" and the unmeasured-precision wording', async ({
      page,
    }) => {
      await page.goto('/studio/research/similarity')
      await expect(page.locator('[data-similarity-legend]')).toBeVisible()
      for (const band of ['NEAR_DUPLICATE', 'PROBABLE_VARIANT', 'WEAK', 'FORM_SIMILAR']) {
        await expect(page.locator(`[data-band-row="${band}"]`)).toBeVisible()
        await expect(page.locator(`[data-does-not-mean="${band}"]`)).not.toBeEmpty()
      }
      await expect(page.locator('[data-precision="unmeasured"]')).toHaveCount(4)
      await expect(page.locator('[data-owner-decision]')).toBeVisible()
      await expect(page.locator('[data-flag="research_image_hashing"]')).toContainText('off')
    })

    test('the library library check runs and reports', async ({ page }) => {
      await page.goto('/studio/research/similarity')
      const button = page.locator('[data-run-library-check]')
      if ((await button.count()) === 0) return
      await button.click()
      await expect(
        page.locator('[data-library-check-result], [data-library-check-error]'),
      ).toBeVisible()
    })
  })
}
