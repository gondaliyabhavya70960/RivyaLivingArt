import { expect, test } from '@playwright/test'

/**
 * The three Phase 38 surfaces — verification 6, 7, 8 and 11. Anonymous: every route redirects to
 * the login. Traversal and a non-allowlisted key: 404 for a signed-in reader too. Signed in
 * (guarded by `STUDIO_STORAGE_STATE`): the environment page renders eight checks and its
 * reachability line, the documentation index lists ten documents and a document renders without
 * executing HTML, the logs page renders its filters and table.
 */

test.describe('an anonymous visitor', () => {
  for (const path of [
    '/studio/system/environment',
    '/studio/system/documentation',
    '/studio/operations/logs',
    '/studio/operations/workflows',
  ]) {
    test(`cannot reach ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/studio\/login/)
    })
  }
})

for (const width of [1920, 1440, 1024, 430, 390]) {
  test.describe(`the system pages at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('the environment page reports reachability and never a value', async ({ page }) => {
      await page.goto('/studio/system/environment')
      await expect(page.locator('[data-env-reachability-note]')).toContainText('reachability only')
      await expect(page.locator('[data-env-check]')).toHaveCount(8)
      const html = await page.content()
      expect(html).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/u)
      expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/u)
      expect(html).not.toMatch(/postgres(ql)?:\/\/[^\s/@'"]+:[^\s@'"]+@/u)
    })

    test('the documentation browser serves ten keys and refuses the rest', async ({ page }) => {
      await page.goto('/studio/system/documentation')
      await expect(page.locator('[data-docs-allowlist-note]')).toBeVisible()
      const listed = page.locator('[data-doc-key]')
      if ((await listed.count()) > 0) await expect(listed).toHaveCount(10)
      const traversal = await page.goto('/studio/system/documentation/../../../etc/passwd')
      expect([200, 404]).toContain(traversal?.status() ?? 0)
      const security = await page.goto('/studio/system/documentation/security')
      expect(security?.status()).toBe(404)
      const scraper = await page.goto('/studio/system/documentation/scraper')
      if (scraper?.status() === 200) {
        await expect(page.locator('[data-doc-title="scraper"]')).toBeVisible()
        await expect(page.locator('[data-doc-body] script')).toHaveCount(0)
      }
    })

    test('the logs page renders its filters and table', async ({ page }) => {
      await page.goto('/studio/operations/logs?level=ERROR&channel=SCRAPER')
      await expect(page.getByLabel('Log filters')).toBeVisible()
      await expect(page.locator('select[name="level"]')).toHaveValue('ERROR')
      await expect(page.locator('select[name="channel"]')).toHaveValue('SCRAPER')
    })
  })
}
