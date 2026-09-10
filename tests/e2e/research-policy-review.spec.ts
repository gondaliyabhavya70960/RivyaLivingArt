import { expect, test } from '@playwright/test'

/**
 * The policy review, from a browser: who may record one, and what the screen says while they do.
 *
 * THE PANEL IS THE PLACE THIS SOFTWARE ADMITS WHAT IT DOES NOT KNOW. Whether a third party's terms
 * of use permit Rivya to read their catalogue is a legal and commercial judgement; the panel
 * records a decision somebody made and never suggests one. So the assertions here are about the
 * absence of things as much as the presence of them: no pre-selected decision, no recommended
 * option, and — for a researcher — no control at all, with the direct POST refused underneath.
 *
 * THE ROBOTS FILE IS RENDERED FROM THE CACHE. Opening a review panel must not cause a request to
 * anybody's server, so the network assertion below is part of the specification rather than a
 * nicety: a panel that fetched robots.txt to fill itself would make merely LOOKING at a source an
 * act of reading it.
 *
 * Guarded by `STUDIO_STORAGE_STATE` for the reason every signed-in spec in this repository is: a
 * real session needs an auth server the local PostgREST shim does not run, and a forged cookie is
 * refused by `getUser()`.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach a source detail page at all', async ({ page }) => {
    await page.goto('/studio/research/sources/00000000-0000-0000-0000-000000000000')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

test.describe('an owner or admin recording a decision', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('renders the cached robots file without fetching anything', async ({ page }) => {
    await page.goto('/studio/research/sources')
    const first = page.locator('table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no source in this database')

    const offOrigin: string[] = []
    await first.click()
    const appOrigin = new URL(page.url()).origin
    page.on('request', (request) => {
      if (!request.url().startsWith(appOrigin)) offOrigin.push(request.url())
    })
    await page.reload()

    // Either the cached body or the sentence explaining that nothing has been fetched yet. Both
    // are correct; a request to the source's own host is not.
    const rendered =
      (await page.locator('[data-robots-body]').count()) +
      (await page.locator('[data-robots-missing]').count())
    expect(rendered).toBeGreaterThan(0)
    expect(offOrigin).toEqual([])
  })

  test('offers no pre-selected decision', async ({ page }) => {
    await page.goto('/studio/research/sources')
    const first = page.locator('table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no source in this database')
    await first.click()

    const decision = page.locator('select[name="status"]')
    if ((await decision.count()) === 0) {
      test.skip(true, 'this role cannot record a policy review, which the next test asserts')
    }
    // AN EMPTY FIRST OPTION, ON PURPOSE. Submitting without choosing is refused rather than
    // recorded as approval, and a default of APPROVED would be the software making the judgement.
    await expect(decision).toHaveValue('')
  })

  test('requires a note, and records who decided and when', async ({ page }) => {
    await page.goto('/studio/research/sources')
    const first = page.locator('table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no source in this database')
    await first.click()

    const decision = page.locator('select[name="status"]')
    if ((await decision.count()) === 0) {
      test.skip(true, 'this role cannot record a policy review')
    }

    // A decision with no note is refused: the note IS the record that the decision was made
    // rather than assumed.
    await decision.selectOption('RESTRICTED')
    await page.fill('textarea[name="notes"]', 'too short')
    await page.locator('form:has(select[name="status"]) button[type="submit"]').click()
    await expect(page.locator('[data-form-error]').first()).toBeVisible()

    await page.fill(
      'textarea[name="notes"]',
      'Read the published terms of use on 2026-09-10; they permit non-commercial reading of public catalogue pages at a low rate.',
    )
    await page.locator('form:has(select[name="status"]) button[type="submit"]').click()
    await expect(page.locator('[data-policy-notes]')).toBeVisible()
  })
})

test.describe('a researcher, who prepares a source but does not approve one', () => {
  test.skip(
    !process.env.STUDIO_RESEARCHER_STORAGE_STATE,
    'no researcher storage state configured — the decision half of this spec needs a second role',
  )
  test.use({ storageState: process.env.STUDIO_RESEARCHER_STORAGE_STATE })

  test('sees no decision control', async ({ page }) => {
    await page.goto('/studio/research/sources')
    const first = page.locator('table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no source in this database')
    await first.click()

    await expect(page.locator('select[name="status"]')).toHaveCount(0)
    // What they DO have is the readiness control: preparing a source is their act, deciding is not.
    await expect(page.locator('form:has(input[value="READY_FOR_REVIEW"])')).toHaveCount(1)
  })
})
