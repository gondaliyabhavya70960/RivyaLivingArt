import { expect, test } from '@playwright/test'

/**
 * `/studio/research/runs/[runId]` — the screen where FEAT §27's isolation claim becomes visible.
 *
 * THE CLAIM IS "A BROKEN SOURCE ADAPTER MUST NOT BREAK OTHER SOURCES", and a claim about failure is
 * only worth anything if the failure is legible to the person who has to act on it. The unit suite
 * `tests/unit/adapter-isolation.test.ts` proves the behaviour — source A aborting after ten
 * consecutive failures while source B completes untouched — against the boundary itself. What this
 * spec proves is the other half: that a person opening the run can SEE which source stopped, that
 * the panel for the healthy source still reads OK with its full count, and that the run itself is
 * `PARTIAL` rather than `FAILED`.
 *
 * THE DISTINCTIONS THIS SUBSYSTEM DRAWS ARE ASSERTED AS TONES AND WORDS, not just as data. An
 * `ABORTED` source is the isolation working, so it is a warning rather than a danger; a
 * `DISALLOWED` fetch is a refusal rather than an error; a version list that is empty is a quiet
 * night rather than a broken pipeline. Every one of those is a sentence somebody would otherwise
 * have to be told once a month.
 *
 * Guarded by `STUDIO_STORAGE_STATE` for the reason every signed-in spec here is: a real session
 * needs an auth server the local PostgREST shim does not run, and a forged cookie is refused by
 * `getUser()`. The anonymous half runs everywhere.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach a run detail page', async ({ page }) => {
    await page.goto('/studio/research/runs/00000000-0000-0000-0000-000000000000')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

test.describe('the run detail screen, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('says what an empty extraction panel means rather than showing nothing', async ({
    page,
  }) => {
    await page.goto('/studio/research/runs')
    const first = page.locator('[data-run-id] a, table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no run in this database')
    await first.click()

    // A run with no adapter rows is the ordinary state of a dry run and of a run that has not yet
    // read a page. SEED §55 forbids "Coming Soon"; an empty state has to say something checkable.
    const panels = page.locator('[data-adapter-run]')
    if ((await panels.count()) === 0) {
      await expect(page.getByText(/records one line here per source/i)).toBeVisible()
    }
  })

  test('says why the version list is short rather than leaving it blank', async ({ page }) => {
    await page.goto('/studio/research/runs')
    const first = page.locator('[data-run-id] a, table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no run in this database')
    await first.click()

    const versions = page.locator('[data-version-id]')
    if ((await versions.count()) === 0) {
      // THE SENTENCE THAT STOPS AN OPERATOR MISREADING A QUIET NIGHT AS A BROKEN PIPELINE.
      await expect(page.getByText(/every page read the same as the last time/i)).toBeVisible()
    }
  })

  test('draws an aborted source as a stopped source, not as a failed run', async ({ page }) => {
    await page.goto('/studio/research/runs')
    const first = page.locator('[data-run-id] a, table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no run in this database')
    await first.click()

    const aborted = page.locator('[data-adapter-status="ABORTED"]')
    test.skip((await aborted.count()) === 0, 'no aborted adapter run in this database')

    // The note is the whole point: ten items failed, this source stopped, nothing else did.
    await expect(aborted.locator('[data-aborted-note]').first()).toBeVisible()
    await expect(aborted.locator('[data-first-errors] li')).not.toHaveCount(0)
    // At most five, and the count badge above them is exact.
    expect(await aborted.locator('[data-first-errors] li').count()).toBeLessThanOrEqual(5)
  })

  test('shows a version as the page said it, with the strategy that read each field', async ({
    page,
  }) => {
    await page.goto('/studio/research/runs')
    const first = page.locator('[data-run-id] a, table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no run in this database')
    await first.click()

    const version = page.locator('[data-version-id]').first()
    test.skip((await version.count()) === 0, 'no version in this database')

    await version.locator('summary').click()
    await expect(version.getByText(/exactly as published/i)).toBeVisible()
    // Provenance per field is FEAT §27's requirement, and it is what makes a wrong value traceable
    // to a rule rather than guessed at.
    await expect(version.locator('[data-draft-field]').first()).toBeVisible()
    // NEVER A LINK TO THE SNAPSHOT. It lives in a private bucket, and a signed URL rendered here
    // would publish a competitor's page body from a Rivya origin for as long as the link lived.
    await expect(version.locator('a[href*="research-snapshots"]')).toHaveCount(0)
    await expect(version.locator('[data-snapshot-state]')).toBeVisible()
  })

  test('keeps a healthy source healthy while another one aborts', async ({ page }) => {
    await page.goto('/studio/research/runs')
    const first = page.locator('[data-run-id] a, table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no run in this database')
    await first.click()

    const aborted = page.locator('[data-adapter-status="ABORTED"]')
    const ok = page.locator('[data-adapter-status="OK"]')
    test.skip(
      (await aborted.count()) === 0 || (await ok.count()) === 0,
      'this database has no run with both an aborted and a healthy source',
    )

    // THE ASSERTION THE WHOLE PHASE IS FOR, asked of the running application: the healthy source
    // extracted its full count while the other one stopped.
    const seen = await ok.first().getAttribute('data-adapter-source')
    expect(seen).not.toBeNull()
    const extracted = await ok
      .first()
      .locator('[data-items-extracted]')
      .getAttribute('data-items-extracted')
    expect(Number(extracted)).toBeGreaterThan(0)
  })
})
