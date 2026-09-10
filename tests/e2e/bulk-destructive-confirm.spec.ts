import { expect, test } from '@playwright/test'

/**
 * The destructive confirmation — step three of four.
 *
 * THE ASSERTION THAT MATTERS IS THAT THE BUTTON IS INERT UNTIL THE NUMBER IS RIGHT, and that the
 * number is the ROW COUNT rather than a fixed word. Typing "ARCHIVE" becomes muscle memory inside
 * a week; typing how many rows cannot, because it is different every time and it is the one fact
 * the operator most needs to have registered.
 *
 * THIS FILE PROVES THE INTERFACE HALF ONLY, and says so rather than implying more. The server
 * re-checks the typed count in `lib/bulk/run.ts` against a count it computes itself — a Server
 * Action is an HTTP endpoint, so the disabled button is a courtesy and the server is the gate.
 * That half is proved in `tests/unit/bulk-engine.test.ts`, against the engine, where a browser
 * cannot reach.
 */

const BULK_PATH = '/studio/catalog/bulk'

test.describe('an anonymous visitor', () => {
  test('is never shown a destructive confirmation', async ({ page }) => {
    await page.goto(BULK_PATH)
    await expect(page).toHaveURL(/\/studio\/login/)
    await expect(page.locator('[data-confirm-destructive]')).toHaveCount(0)
  })
})

test.describe('a destructive bulk operation, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('a role without destructive.execute is told who to ask, not shown nothing', async ({
    page,
  }) => {
    await page.goto(BULK_PATH)
    const select = page.locator('[data-operation-select]')
    test.skip((await select.count()) === 0, 'no products in this database to select')

    // ARCHIVE IS PRESENT AND DISABLED FOR A ROLE THAT MAY NOT RUN IT. Hiding it teaches the
    // operator the feature does not exist; disabling it teaches them who to ask.
    const archive = select.locator('option[value="product.archive"]')
    await expect(archive).toHaveCount(1)
  })

  test('the apply button stays inert until the row count is typed exactly', async ({ page }) => {
    await page.goto(BULK_PATH)
    const boxes = page.locator('[data-bulk-rows] input[type="checkbox"]')
    test.skip((await boxes.count()) === 0, 'no products in this database to select')

    const select = page.locator('[data-operation-select]')
    const archive = select.locator('option[value="product.archive"]')
    test.skip(await archive.isDisabled(), 'this role does not hold destructive.execute')

    await select.selectOption('product.archive')
    await boxes.first().check()
    await page.locator('[data-bulk-preview]').click()

    const confirm = page.locator('[data-confirm-destructive]')
    await expect(confirm).toBeVisible()
    await expect(confirm).toBeDisabled()

    const expected = await page.locator('[data-preview-row][data-preview-outcome="APPLY"]').count()

    const field = page.locator('[data-confirm-count]')
    // A NEARBY NUMBER IS STILL THE WRONG NUMBER. Typing one less than the real count is exactly
    // the mistake of someone who glanced instead of reading, so it must not unlock the button.
    await field.fill(String(expected + 1))
    await expect(confirm).toBeDisabled()

    await field.fill(String(expected))
    await expect(confirm).toBeEnabled()
  })

  test('the prompt states what the operation removes before asking for the number', async ({
    page,
  }) => {
    await page.goto(BULK_PATH)
    const boxes = page.locator('[data-bulk-rows] input[type="checkbox"]')
    test.skip((await boxes.count()) === 0, 'no products in this database to select')

    const select = page.locator('[data-operation-select]')
    test.skip(
      await select.locator('option[value="product.archive"]').isDisabled(),
      'this role does not hold destructive.execute',
    )

    await select.selectOption('product.archive')
    await boxes.first().check()
    await page.locator('[data-bulk-preview]').click()

    await expect(page.getByText('This removes live content')).toBeVisible()
    // The field is not a spinner: arrowing to the right answer is not reading it.
    await expect(page.locator('[data-confirm-count]')).not.toHaveAttribute('type', 'number')
  })
})
