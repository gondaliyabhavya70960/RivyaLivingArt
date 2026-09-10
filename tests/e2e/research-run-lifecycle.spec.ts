import { expect, test } from '@playwright/test'

/**
 * Starting a run, and the controls around it.
 *
 * WHAT THIS FILE CAN PROVE WITHOUT A SESSION is that no run can be started without one — which is
 * the assertion that matters, because starting a run makes requests to a third party's website.
 * Everything else needs an authenticated Studio session, which the local PostgREST shim cannot
 * provide, and is guarded rather than omitted.
 *
 * THE POLITENESS BEHAVIOUR IS PROVED ELSEWHERE, AGAINST A REAL FIXTURE SERVER, because it is not a
 * browser-shaped fact: the assertions that matter are "no HTTP request was made for a disallowed
 * URL" and "the gap between two requests honoured the host's Crawl-delay", and both are read from
 * the fixture server's own log rather than from anything a page renders.
 */

test.describe('an anonymous visitor', () => {
  test('cannot open the form that starts a run', async ({ page }) => {
    await page.goto('/studio/research/scrape')
    await expect(page).toHaveURL(/\/studio\/login/)
    await expect(page.locator('[data-start-run]')).toHaveCount(0)
  })

  test('carries the path through as ?next=', async ({ page }) => {
    await page.goto('/studio/research/scrape')
    expect(new URL(page.url()).searchParams.get('next')).toBe('/studio/research/scrape')
  })
})

test.describe('the run lifecycle, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('offers no form at all when no source is approved', async ({ page }) => {
    await page.goto('/studio/research/scrape')
    const select = page.locator('[data-source-select]')
    if ((await select.count()) > 0) return
    // A FORM THAT LETS AN OPERATOR CHOOSE NOTHING AND PRESS A BUTTON teaches them the feature is
    // broken. The page says why instead.
    await expect(page.getByText('No source has been approved yet')).toBeVisible()
    await expect(page.locator('[data-start-run]')).toHaveCount(0)
  })

  test('defaults the dry-run toggle ON', async ({ page }) => {
    await page.goto('/studio/research/scrape')
    const dryRun = page.locator('[data-dry-run]')
    test.skip((await dryRun.count()) === 0, 'no approved source on this database')
    // THE SAFE DEFAULT. A dry run fetches, honours robots and the delay, records the fetch — and
    // creates no rows anybody then has to triage.
    await expect(dryRun).toBeChecked()
  })

  test('says what cancelling actually does, beside the button', async ({ page }) => {
    await page.goto('/studio/research/runs')
    const runs = page.locator('[data-run-id]')
    test.skip((await runs.count()) === 0, 'no run on this database')

    await runs.first().locator('a').click()
    const cancel = page.locator('[data-cancel-run]')
    if ((await cancel.count()) === 0) return // the run has already finished

    // BEFORE THEY PRESS, NOT AFTER. A message in the response arrives after the decision it was
    // supposed to inform.
    await expect(page.getByText('Cancelling stops the next page')).toBeVisible()
  })

  test('every fetch row declares a robots decision', async ({ page }) => {
    await page.goto('/studio/research/runs')
    const runs = page.locator('[data-run-id]')
    test.skip((await runs.count()) === 0, 'no run on this database')

    await runs.first().locator('a').click()
    const rows = page.locator('[data-fetch-id]')
    const count = await rows.count()
    for (let index = 0; index < count; index += 1) {
      const decision = await rows.nth(index).getAttribute('data-robots-decision')
      // A row with no decision would mean a request was made without asking robots first.
      expect(['ALLOWED', 'DISALLOWED', 'NO_ROBOTS', 'ERROR']).toContain(decision)
    }
  })
})
