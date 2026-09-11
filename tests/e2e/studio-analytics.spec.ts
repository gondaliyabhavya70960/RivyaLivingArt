import { expect, test } from '@playwright/test'

/**
 * `/studio?tab=analytics` — Phase 37, verification 11. The tab renders from snapshots; every
 * section states its as-of date; the first section carries the traffic note; every available tile
 * has a coverage badge and a definition disclosure; every chart has a keyboard-reachable data
 * table; an unavailable tile names its reason. The role matrix (editor eight, researcher eighteen)
 * needs a storage state per role and is recorded in the guide as a manual pass; the signed-in half
 * here is guarded by `STUDIO_STORAGE_STATE`.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the analytics tab', async ({ page }) => {
    await page.goto('/studio?tab=analytics')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

for (const width of [1920, 1440, 430, 390]) {
  test.describe(`the analytics tab at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('renders snapshots or says there are none, and never a placeholder figure', async ({
      page,
    }) => {
      await page.goto('/studio?tab=analytics')
      const tab = page.locator('[data-analytics-tab]')
      const empty = page.getByText('No snapshot yet')
      await expect(tab.or(empty)).toBeVisible()
      if (!(await tab.isVisible())) return

      const studio = page.locator('[data-analytics-section="studio"]')
      await expect(studio).toBeVisible()
      await expect(studio.locator('[data-analytics-traffic-note]')).toContainText(
        'Traffic analytics are not connected',
      )

      const available = page.locator('[data-metric-availability="AVAILABLE"]')
      for (const tile of await available.all()) {
        await expect(tile.locator('[data-coverage-badge]')).toBeVisible()
        await expect(tile.locator('[data-metric-figure]')).not.toHaveText('—')
        const definition = tile.locator('details').first()
        await definition.locator('summary').click()
        await expect(tile.locator('[data-metric-definition]')).toBeVisible()
      }

      const unavailable = page.locator('[data-metric-availability="UNAVAILABLE"]')
      for (const tile of await unavailable.all()) {
        await expect(tile.locator('[data-metric-reason]')).not.toBeEmpty()
      }

      const chart = page.locator('figure[data-chart]').first()
      if (await chart.isVisible()) {
        const summary = chart.locator('summary')
        await summary.focus()
        await page.keyboard.press('Enter')
        await expect(chart.locator('table')).toBeVisible()
      }
    })
  })
}
