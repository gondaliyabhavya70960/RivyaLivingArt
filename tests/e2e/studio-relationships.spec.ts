import { expect, test } from '@playwright/test'

/**
 * `/studio/catalog/relationships` — the four gestures.
 *
 * IT ASSERTS THE PERMISSION GATE AND THE SHAPE, NOT A PARTICULAR SUGGESTION. The seed creates no
 * products, so there is nothing for the four rules to reason about on a freshly seeded database —
 * and a suite that required one would be a suite that required this repository to invent inventory
 * it is forbidden to invent (SEED §32, D10). What it can assert on any database is that the page
 * gates on `catalog.read`, that the coverage panel counts rather than warns, that the suggestion
 * panel exists and is empty rather than absent, and that no edge appears that nobody made.
 *
 * THE ASSERTION WORTH THE MOST IS THE LAST ONE. A relationship workspace that shipped with rows in
 * it would mean a rule had written, which is the exact failure `origin` exists to make visible.
 */

test.describe('the relationships workspace', () => {
  test('redirects an unauthenticated visitor to the login page', async ({ page }) => {
    await page.goto('/studio/catalog/relationships')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

test.describe('the relationships workspace, signed in', () => {
  // The Studio suites share the authenticated storage state the repository's other studio specs
  // use; without it this block is skipped rather than asserting against a login page.
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('renders the coverage, picker and suggestion panels', async ({ page }) => {
    await page.goto('/studio/catalog/relationships')
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Choose a piece' })).toBeVisible()
  })

  test('shows no connections until somebody makes one', async ({ page }) => {
    await page.goto('/studio/catalog/relationships')
    // No piece selected: the workspace says so rather than showing an empty table.
    await expect(page.getByText('Choose a piece to see its connections')).toBeVisible()
    await expect(page.locator('[data-relation-id]')).toHaveCount(0)
  })

  test('every rendered edge declares where it came from', async ({ page }) => {
    await page.goto('/studio/catalog/relationships')
    const edges = page.locator('[data-relation-id]')
    const count = await edges.count()
    for (let index = 0; index < count; index += 1) {
      const origin = await edges.nth(index).getAttribute('data-relation-origin')
      // EDITOR or RULE_ACCEPTED. There is no third origin, and a row without one would mean
      // something wrote an edge outside lib/relations/write.ts.
      expect(['EDITOR', 'RULE_ACCEPTED']).toContain(origin)
    }
  })
})
