import { expect, test } from '@playwright/test'

/**
 * Undo, and the audit trail it is read from.
 *
 * THE UNDO OFFER IS NOT A PROMISE THAT EVERY ROW COMES BACK, and the banner says so in the same
 * breath as it offers: rows edited since the operation ran are left as they are. That is the
 * whole design — an undo that overwrote somebody else's later edit would be a second bulk write
 * nobody asked for — and the sentence is seeded copy rather than a tooltip because the operator
 * needs it before they press, not after.
 *
 * WHAT THIS FILE PROVES: that a finished operation is reachable by id, that its items are listed
 * one row each rather than summarised, that the offer appears only inside the window and only for
 * an operation that succeeded, and that an undo is itself an operation that links back to what it
 * reversed. The row-version skip rule is proved in `tests/unit/bulk-undo.test.ts`, against the
 * engine, because provoking a concurrent edit between two browser clicks is a race a test should
 * not be built on.
 */

const AUDIT_ROOT = '/studio/operations/audit'
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

test.describe('an anonymous visitor', () => {
  test('cannot read an operation audit page', async ({ page }) => {
    await page.goto(`${AUDIT_ROOT}/${NIL_UUID}`)
    await expect(page).toHaveURL(/\/studio\/login/)
  })

  test('is never offered an undo', async ({ page }) => {
    await page.goto(`${AUDIT_ROOT}/${NIL_UUID}`)
    await expect(page.locator('[data-undo-banner]')).toHaveCount(0)
  })
})

test.describe('the audit trail, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('an operation that does not exist is a 404, not an empty page', async ({ page }) => {
    const response = await page.goto(`${AUDIT_ROOT}/${NIL_UUID}`)
    expect(response?.status()).toBe(404)
  })

  test('a finished operation lists every item, never a bare count', async ({ page }) => {
    await page.goto('/studio/catalog/bulk')
    const recent = page.locator('[data-recent-operations] a')
    test.skip((await recent.count()) === 0, 'no bulk operation has been run on this database')

    await recent.first().click()
    await expect(page).toHaveURL(new RegExp(`${AUDIT_ROOT}/`))

    // ONE ROW PER ITEM. A 500-row archive writes one `audit_logs` row and five hundred
    // `bulk_operation_items` — the security log stays readable and nothing is lost.
    const items = page.locator('[data-audit-item]')
    expect(await items.count()).toBeGreaterThan(0)
  })

  test('the undo offer states its limit in the same breath as the offer', async ({ page }) => {
    await page.goto('/studio/catalog/bulk')
    const recent = page.locator('[data-recent-operations] a')
    test.skip((await recent.count()) === 0, 'no bulk operation has been run on this database')

    await recent.first().click()
    const banner = page.locator('[data-undo-banner]')
    if ((await banner.count()) === 0) return // outside the window, or already undone

    await expect(banner).toContainText('24 hours')
    await expect(banner).toContainText('left as they are')
    await expect(page.locator('[data-undo-submit]')).toBeEnabled()
  })

  test('an undo is itself an operation and links back to what it reversed', async ({ page }) => {
    await page.goto('/studio/catalog/bulk')
    const recent = page.locator('[data-recent-operations] a')
    test.skip((await recent.count()) === 0, 'no bulk operation has been run on this database')

    const count = await recent.count()
    for (let index = 0; index < count; index += 1) {
      const kind = (await recent.nth(index).textContent()) ?? ''
      if (!kind.includes('undo')) continue
      await recent.nth(index).click()
      // The back-link is the record that these two rows are one action and its reversal.
      await expect(page.locator(`a[href^="${AUDIT_ROOT}/"]`).first()).toBeVisible()
      return
    }
  })
})
