import { expect, test } from '@playwright/test'

/**
 * `/studio/research/opportunities/direction` — create a brief, write a section, see the banner,
 * the evidence rail and the observed-figures panel with its label, open the print view.
 * Signed-in half guarded by `STUDIO_STORAGE_STATE`, as every Studio spec is.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the direction briefs', async ({ page }) => {
    await page.goto('/studio/research/opportunities/direction')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

for (const width of [1920, 390]) {
  test.describe(`direction briefs at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('creates a brief, writes prose, and the internal-document banner is everywhere', async ({
      page,
    }) => {
      await page.goto('/studio/research/opportunities/direction')
      await expect(page.locator('[data-direction-banner]')).toBeVisible()
      const input = page.locator('[data-brief-title-input]')
      if ((await input.count()) === 0) return
      await input.fill(`E2E brief ${String(Date.now())}`)
      await page.locator('[data-create-brief]').click()
      await expect(page).toHaveURL(/\/direction\/[0-9a-f-]{36}$/u)
      await expect(page.locator('[data-direction-banner]')).toBeVisible()
      await expect(page.locator('[data-evidence-rail]')).toBeVisible()
      await expect(page.locator('[data-observed-figures]')).toBeVisible()
      await page.locator('[data-brief-section="intent"] textarea').fill('Why now, in prose.')
      await page.locator('[data-save-brief]').click()
      await expect(page.locator('[data-brief-revision="2"]')).toBeVisible()
      await page.locator('[data-brief-print-link]').click()
      await expect(page.locator('[data-brief-print]')).toContainText('Internal research document')
      await expect(page.locator('[data-brief-print]')).toContainText('Why now, in prose.')
    })
  })
}
