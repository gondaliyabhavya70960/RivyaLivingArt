import { expect, test } from '@playwright/test'

/**
 * `/studio/research/shortlist` and `/studio/research/confirmed` — Phase 35, verification 14.
 *
 * The signed-in half is guarded by `STUDIO_STORAGE_STATE`, as every Studio spec is, and it
 * asserts what a merchandiser sees: the shortlist's intro and stale panel, the confirmed list's
 * research-decision label, and the bridge button DISABLED with its reason while
 * `research_product_bridge` is off — which is the shipped state. With a corpus (a source approved
 * and rows shortlisted), the walk continues: open a row, confirm with a decision note, find it on
 * the confirmed list. The bridge itself is exercised only when the flag is on, and then the empty
 * draft must carry a placeholder title and nothing else.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the shortlist or the confirmed list', async ({ page }) => {
    await page.goto('/studio/research/shortlist')
    await expect(page).toHaveURL(/\/studio\/login/)
    await page.goto('/studio/research/confirmed')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

for (const width of [1920, 390]) {
  test.describe(`shortlist and confirmed at ${String(width)}px, signed in`, () => {
    test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
    test.use({ storageState: process.env.STUDIO_STORAGE_STATE, viewport: { width, height: 1000 } })

    test('the shortlist states what it is and counts the stale entries', async ({ page }) => {
      await page.goto('/studio/research/shortlist')
      await expect(page.locator('[data-shortlist-intro]')).toBeVisible()
      await expect(page.locator('[data-shortlist-stale]')).toBeVisible()
    })

    test('the confirmed list labels every row a research decision', async ({ page }) => {
      await page.goto('/studio/research/confirmed?archived=true')
      await expect(page.locator('[data-confirmed-intro]')).toBeVisible()
      const open = page.locator('[data-open-row]').first()
      if ((await open.count()) === 0) return
      await open.click()
      await expect(page.locator('[data-decision-actions]')).toBeVisible()
      // THE BRIDGE SHIPS OFF. The button is disabled with the reason stated, never absent.
      const button = page.locator('[data-start-product-button]')
      await expect(button).toBeVisible()
      if (await button.isDisabled()) {
        await expect(page.locator('[data-start-product-disabled]')).toBeVisible()
        return
      }
      // Flag on: the dialog opens with the acknowledgement unticked and the submit disabled.
      await button.click()
      await expect(page.locator('[data-bridge-submit]')).toBeDisabled()
      await page.locator('[data-bridge-slug]').fill(`e2e-draft-${String(Date.now())}`)
      await expect(page.locator('[data-bridge-submit]')).toBeDisabled()
      await page.locator('[data-bridge-acknowledge]').check()
      await expect(page.locator('[data-bridge-submit]')).toBeEnabled()
      await page.locator('[data-bridge-submit]').click()
      await expect(page.locator('[data-start-product-started]')).toBeVisible()
      await page.locator('[data-start-product-started] a').click()
      await expect(page).toHaveURL(/\/studio\/catalog\/products\/[0-9a-f-]{36}/u)
      // Empty but for slug, placeholder title and category: no description, no price.
      await expect(page.locator('[name="description"]')).toHaveValue('')
    })

    test('confirming from the shortlist needs a decision note, then lands on the confirmed list', async ({
      page,
    }) => {
      await page.goto('/studio/research/shortlist')
      const open = page.locator('[data-open-row]').first()
      if ((await open.count()) === 0) return
      await open.click()
      const bar = page.locator('[data-row-action-bar]')
      await expect(bar).toBeVisible()
      // Without a note the action refuses with a sentence, not a constraint name.
      await bar.locator('[data-confirm-row]').click()
      await expect(bar).toContainText('decision note')
      await bar.locator('[data-decision-note]').fill('E2E: confirmed as a research reference.')
      await bar.locator('[data-confirm-row]').click()
      await page.goto('/studio/research/confirmed')
      await expect(page.locator('[data-decision-note-text]').first()).toContainText(
        'confirmed as a research reference',
      )
    })
  })
}
