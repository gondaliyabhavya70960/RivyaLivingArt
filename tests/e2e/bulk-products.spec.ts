import { expect, test } from '@playwright/test'

/**
 * `/studio/catalog/bulk` — Select → Preview, the first two of the four steps.
 *
 * WHAT THIS FILE CAN PROVE AND WHAT IT CANNOT, stated up front for the same reason
 * `studio-access.spec.ts` states it. The unauthenticated half needs nothing but the proxy, so it
 * runs everywhere and is the assertion that matters most on this page: a surface that can archive
 * five hundred products must not render for a visitor. The signed-in half needs a real Supabase
 * session — a forged cookie is refused by `getUser()`, which is the point of using it — so it is
 * guarded by `STUDIO_STORAGE_STATE` rather than omitted, and shows as skipped in the report
 * instead of being invisible.
 *
 * IT ASSERTS THE FLOW AND THE SHAPE, NOT A PARTICULAR PRODUCT. The seed creates no products
 * (SEED §32, D10 — this repository may not invent inventory), so on a freshly seeded database the
 * workspace correctly renders an empty state rather than a table. Every assertion below therefore
 * reads what is on the page and branches, rather than requiring rows that a compliant seed must
 * not contain.
 */

const BULK_PATH = '/studio/catalog/bulk'

test.describe('an anonymous visitor', () => {
  test('cannot reach the bulk workspace', async ({ page }) => {
    await page.goto(BULK_PATH)
    await expect(page).toHaveURL(/\/studio\/login/)
  })

  test('carries the bulk path through as ?next=', async ({ page }) => {
    await page.goto(BULK_PATH)
    expect(new URL(page.url()).searchParams.get('next')).toBe(BULK_PATH)
  })

  test('cannot reach an operation audit page either', async ({ page }) => {
    // The audit page holds the before/after snapshots. It gates on `bulk.execute`, the same
    // permission `bulk_operation_items` requires in RLS, so both layers refuse the same request.
    await page.goto('/studio/operations/audit/00000000-0000-0000-0000-000000000000')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

test.describe('the bulk workspace, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('offers an operation to choose before anything is selected', async ({ page }) => {
    await page.goto(BULK_PATH)

    const rows = page.locator('[data-bulk-rows]')
    if ((await rows.count()) === 0) {
      // An empty catalogue is the honest state of a seeded database. The page says so rather
      // than rendering a table with no rows in it, and offers no action to take on nothing.
      await expect(page.getByText('Select rows to act on')).toBeVisible()
      await expect(page.locator('[data-operation-select]')).toHaveCount(0)
      return
    }

    await expect(page.locator('[data-operation-select]')).toBeVisible()
    // The selection bar is absent until something is selected, not present and empty.
    await expect(page.locator('[data-selection-bar]')).toHaveCount(0)
  })

  test('counts the selection and only then offers a preview', async ({ page }) => {
    await page.goto(BULK_PATH)
    const boxes = page.locator('[data-bulk-rows] input[type="checkbox"]')
    test.skip((await boxes.count()) === 0, 'no products in this database to select')

    await boxes.first().check()
    const bar = page.locator('[data-selection-bar]')
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('1')
    await expect(page.locator('[data-bulk-preview]')).toBeVisible()
  })

  test('a preview says what would happen and does not do it', async ({ page }) => {
    await page.goto(BULK_PATH)
    const boxes = page.locator('[data-bulk-rows] input[type="checkbox"]')
    test.skip((await boxes.count()) === 0, 'no products in this database to select')

    await page.locator('[data-operation-select]').selectOption('product.publish')
    await boxes.first().check()
    await page.locator('[data-bulk-preview]').click()

    // THE PREVIEW LIVES AT ITS OWN URL, reached by a redirect, and the confirmation token is NOT
    // in it: a preview link pasted to a colleague opens the preview and cannot apply it.
    await expect(page).toHaveURL(/\/studio\/catalog\/bulk\?operation=/)
    expect(page.url()).not.toContain('confirmation_token')

    await expect(page.locator('[data-preview-counts]')).toBeVisible()
    const previewRows = page.locator('[data-preview-row]')
    expect(await previewRows.count()).toBeGreaterThan(0)

    // EVERY ROW DECLARES AN OUTCOME. A row with no outcome would mean the preview reported a
    // product it had not actually reasoned about.
    const count = await previewRows.count()
    for (let index = 0; index < count; index += 1) {
      const outcome = await previewRows.nth(index).getAttribute('data-preview-outcome')
      expect(['APPLY', 'SKIP', 'INVALID']).toContain(outcome)
    }
  })

  test('a product that is not ready to publish is excluded with a reason, not applied', async ({
    page,
  }) => {
    await page.goto(BULK_PATH)
    const boxes = page.locator('[data-bulk-rows] input[type="checkbox"]')
    test.skip((await boxes.count()) === 0, 'no products in this database to select')

    await page.locator('[data-operation-select]').selectOption('product.publish')
    const total = await boxes.count()
    for (let index = 0; index < total; index += 1) await boxes.nth(index).check()
    await page.locator('[data-bulk-preview]').click()

    const excluded = page.locator('[data-preview-row][data-preview-outcome="SKIP"]')
    if ((await excluded.count()) === 0) return // every product happened to be ready

    // THE REASON NAMES WHAT IS MISSING. "Not ready" alone sends the operator hunting; the
    // readiness checklist already knows which items are unmet, so the preview says them.
    await expect(excluded.first()).not.toHaveText(/^\s*$/)
  })
})
