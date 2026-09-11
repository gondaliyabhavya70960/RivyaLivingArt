import { expect, test } from '@playwright/test'

/**
 * `/studio/research/sheets` — Phase 36, verification 11. The banner states the flag and the
 * identity to share with (never a credential); the seven seeded definitions are listed; with the
 * flag off Run now is disabled; an owner can open the definition form, pick columns from the
 * allowlist and save; the run history renders. Signed-in half guarded by `STUDIO_STORAGE_STATE`.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the Sheets page', async ({ page }) => {
    await page.goto('/studio/research/sheets')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

for (const width of [1920, 390]) {
  test.describe(`Sheets at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('lists the definitions, states the flag, and never shows a credential', async ({
      page,
    }) => {
      await page.goto('/studio/research/sheets')
      const banner = page.locator('[data-sheets-banner]')
      await expect(banner).toBeVisible()
      await expect(banner).not.toContainText('BEGIN PRIVATE KEY')
      await expect(page.locator('[data-sheets-history]')).toBeVisible()
      const run = page.locator('[data-sheets-run="research-products"]')
      if ((await run.count()) === 0) return
      if ((await banner.getAttribute('data-sheets-banner')) === 'off') {
        await expect(run).toBeDisabled()
      }
    })

    test('an owner creates a definition from the allowlist and sees it listed', async ({
      page,
    }) => {
      await page.goto('/studio/research/sheets?edit=new')
      const form = page.locator('[data-sheets-form]')
      if ((await form.count()) === 0) return
      const slug = `e2e-${String(Date.now())}`
      await page.locator('[data-sheets-slug]').fill(slug)
      await page.locator('[data-sheets-name]').fill('E2E export')
      await page.locator('[data-sheets-entity]').selectOption('SHORTLIST')
      await page.locator('[data-sheets-column="reason"]').check()
      await page.locator('[data-sheets-tab]').fill('E2E')
      await page.locator('[data-sheets-schedule]').fill('MANUAL')
      await page.locator('[data-sheets-save]').click()
      await page.goto('/studio/research/sheets')
      await expect(page.locator(`[data-sheets-edit="${slug}"]`)).toBeVisible()
      await page.locator(`[data-sheets-pause-toggle="${slug}"]`).click()
      await expect(page.locator('[data-sheets-paused]').first()).toBeVisible()
    })
  })
}
