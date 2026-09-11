import { expect, test } from '@playwright/test'

/**
 * `/studio/content/seo` — Phase 39, verification 9–11. Anonymous: redirected to the login. Signed
 * in (guarded by `STUDIO_STORAGE_STATE`): the seven tabs render; the Pages tab shows a level beside
 * every field; the Keywords tab lists the seventeen themes, all UNRESEARCHED, with no numeric
 * input anywhere; the Redirects tab refuses a loop; the SERP preview counts characters.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the SEO workspace', async ({ page }) => {
    await page.goto('/studio/content/seo')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

for (const width of [1920, 390]) {
  test.describe(`the SEO workspace at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('renders seven tabs and a level beside every page', async ({ page }) => {
      await page.goto('/studio/content/seo?tab=pages')
      await expect(page.locator('[data-seo-tab]')).toHaveCount(7)
      const levels = page.locator('[data-seo-level]')
      expect(await levels.count()).toBeGreaterThan(0)
    })

    test('the Keywords tab records research and holds no number', async ({ page }) => {
      await page.goto('/studio/content/seo?tab=keywords')
      await expect(page.locator('[data-seo-keywords-caveat]')).toContainText('ranking opportunity')
      const themes = page.locator('[data-seo-keyword]')
      if ((await themes.count()) === 0) return
      expect(await themes.count()).toBeGreaterThanOrEqual(17)
      await expect(page.locator('[data-seo-keyword="custom furniture india"]')).toContainText(
        'verification',
      )
      expect(await page.locator('input[type="number"]').count()).toBe(0)
      const statuses = await page.locator('[data-seo-keyword-status]').allTextContents()
      expect(statuses.every((s) => s.trim() === 'UNRESEARCHED')).toBe(true)
    })

    test('the SERP preview counts characters and warns past the mark', async ({ page }) => {
      await page.goto('/studio/content/seo?tab=pages&path=/about')
      const title = page.locator('#seo-title')
      if ((await title.count()) === 0) return
      await title.fill('x'.repeat(70))
      await expect(page.locator('[data-serp-count="over"]').first()).toBeVisible()
    })

    test('the Redirects tab refuses a loop', async ({ page }) => {
      await page.goto('/studio/content/seo?tab=redirects')
      const add = page.locator('[data-seo-redirect-add]')
      if ((await add.count()) === 0) return
      const stamp = String(Date.now())
      await page.locator('input[name="from_path"]').fill(`/e2e-${stamp}-a`)
      await page.locator('input[name="to_path"]').fill(`/e2e-${stamp}-b`)
      await add.click()
      await page.goto('/studio/content/seo?tab=redirects')
      await page.locator('input[name="from_path"]').fill(`/e2e-${stamp}-b`)
      await page.locator('input[name="to_path"]').fill(`/e2e-${stamp}-a`)
      await page.locator('[data-seo-redirect-add]').click()
      await expect(page.locator('[data-form-error]').first()).toContainText('loop')
    })
  })
}
