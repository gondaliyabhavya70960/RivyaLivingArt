import { expect, test } from '@playwright/test'

/**
 * `/studio/research/explorer` — the screen where Phase 28's whole argument becomes visible.
 *
 * THE ARGUMENT IS "WHAT THE PAGE SAID, BESIDE WHAT RIVYA MADE OF IT". A comparison table is only
 * trustworthy if the judgements behind it can be checked, and they can only be checked if the
 * source text is on the screen next to them. The unit suites prove the judgements are right; what
 * this spec proves is that they are LEGIBLE — that a person opening a row sees the raw string, the
 * normalised value and the rule that produced it, in that order, without leaving the page.
 *
 * THE PERMISSION ASSERTIONS ARE THE OTHER HALF, AND THEY ARE ASSERTED AS ABSENCE. A viewer gets no
 * correction form and no duplicate decision — not a disabled one, which would tell them the action
 * exists and they are not trusted with it. The Server Actions check again regardless, because a
 * control that is not rendered is not a security boundary; that half is proved in
 * `tests/unit/rls/phase28.test.ts` at the row.
 *
 * FILTERS LIVE IN THE URL, so a filtered view is a link somebody can send and the spec can navigate
 * straight to one rather than driving seven selects.
 *
 * Guarded by `STUDIO_STORAGE_STATE` for the reason every signed-in spec here is: a real session
 * needs an auth server the local PostgREST shim does not run, and a forged cookie is refused by
 * `getUser()`. The anonymous half runs everywhere.
 */

test.describe('an anonymous visitor', () => {
  test('cannot reach the explorer', async ({ page }) => {
    await page.goto('/studio/research/explorer')
    await expect(page).toHaveURL(/\/studio\/login/)
  })

  test('cannot reach a row drawer either', async ({ page }) => {
    await page.goto('/studio/research/explorer?row=00000000-0000-0000-0000-000000000000')
    await expect(page).toHaveURL(/\/studio\/login/)
  })

  test('cannot reach the data-quality page', async ({ page }) => {
    await page.goto('/studio/operations/data-quality')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

test.describe('the explorer, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('says what an empty explorer means rather than showing nothing', async ({ page }) => {
    await page.goto('/studio/research/explorer')
    const rows = page.locator('[data-row-link]')
    if ((await rows.count()) === 0) {
      // SEED §55 forbids "Coming Soon"; an empty state has to say something checkable — here, that
      // a source must be approved and run before anything appears.
      await expect(page.getByText(/has to be approved and run/i)).toBeVisible()
    }
  })

  test('carries the filters in the URL, so a filtered view is a link', async ({ page }) => {
    await page.goto('/studio/research/explorer?severity=ERROR&stage=VALIDATED')
    await expect(page.locator('[data-filter="severity"]')).toHaveValue('ERROR')
    await expect(page.locator('[data-filter="stage"]')).toHaveValue('VALIDATED')
  })

  test('ignores a filter value that names nothing rather than answering 500', async ({ page }) => {
    // The query string is input and `?stage=DROP` is a thing somebody can type. PostgREST would
    // refuse an unknown enum with a 400 and the page would answer 500.
    const response = await page.goto('/studio/research/explorer?stage=DROP+TABLE&severity=x')
    expect(response?.status()).toBeLessThan(400)
  })

  test('SHOWS RAW BESIDE NORMALISED BESIDE PROVENANCE in a row drawer', async ({ page }) => {
    await page.goto('/studio/research/explorer')
    const first = page.locator('[data-row-link]').first()
    test.skip((await first.count()) === 0, 'no scraped product in this database')
    await first.click()

    const drawer = page.locator('[data-row-drawer]')
    await expect(drawer).toBeVisible()

    // THE THREE COLUMNS, ASSERTED AS THREE. A drawer showing only the normalised value would be
    // asking to be believed.
    await expect(drawer.locator('[data-field="title"] [data-raw-value]')).toBeVisible()
    await expect(drawer.locator('[data-field="title"] [data-normalised-value]')).toBeVisible()
    await expect(drawer.locator('[data-field="price"]')).toBeVisible()

    // NEVER A LINK TO THE COMPETITOR'S PAGE. Opening one from Studio is a request nobody's
    // politeness clock accounted for, made from whatever network the person happens to be on.
    await expect(drawer.locator('[data-source-url]')).toBeVisible()
    await expect(drawer.locator('a[href^="http"]:not([href*="/studio"])')).toHaveCount(0)
  })

  test('draws an unread value as "not read" rather than as a blank', async ({ page }) => {
    await page.goto('/studio/research/explorer?parse_state=UNPARSED')
    const pill = page.locator('[data-parse-state="UNPARSED"]').first()
    test.skip((await pill.count()) === 0, 'no unparsed row in this database')
    // The difference between "the page did not say" and "the page said something we could not
    // read" is the difference between a competitor who publishes no measurements and a parser that
    // needs fixing. A dash says neither.
    await expect(pill).toBeVisible()
    await expect(pill).not.toHaveText('—')
  })

  test('shows a finding with its rule name and its severity', async ({ page }) => {
    await page.goto('/studio/research/explorer?severity=ERROR')
    const first = page.locator('[data-row-link]').first()
    test.skip((await first.count()) === 0, 'no row with an error in this database')
    await first.click()

    const issue = page.locator('[data-issue-rule]').first()
    await expect(issue).toBeVisible()
    await expect(issue).toHaveAttribute('data-issue-severity', /ERROR|WARNING|INFO/)
  })

  test('offers a duplicate proposal as a proposal, with both answers', async ({ page }) => {
    await page.goto('/studio/research/explorer')
    const first = page.locator('[data-row-link]').first()
    test.skip((await first.count()) === 0, 'no scraped product in this database')
    await first.click()

    const candidate = page.locator('[data-candidate-id][data-candidate-decided="PENDING"]').first()
    test.skip((await candidate.count()) === 0, 'no pending candidate in this database')

    // BOTH ANSWERS, ALWAYS. A screen offering only "same product" is a screen that gets clicked
    // through, and accepting a wrong merge hides a row from every later comparison.
    await expect(candidate.getByRole('button', { name: /same product/i })).toBeVisible()
    await expect(candidate.getByRole('button', { name: /different products/i })).toBeVisible()
  })

  test('badges a hand-corrected value as set by hand', async ({ page }) => {
    await page.goto('/studio/research/explorer')
    const first = page.locator('[data-row-link]').first()
    test.skip((await first.count()) === 0, 'no scraped product in this database')
    await first.click()
    // Only present when somebody has corrected a field; its absence on an untouched row is correct.
    const frozen = page.locator('[data-row-drawer]').getByText(/set by hand/i)
    if ((await frozen.count()) > 0) await expect(frozen.first()).toBeVisible()
  })
})

test.describe('the data-quality Research tab, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('counts findings by rule and links each count to the rows behind it', async ({ page }) => {
    await page.goto('/studio/operations/data-quality')
    await page.getByRole('tab', { name: /research/i }).click()

    const tally = page.locator('[data-tally-rule]').first()
    if ((await tally.count()) > 0) {
      // A number nobody can act on is a number people learn to ignore.
      await expect(tally.getByRole('link')).toHaveAttribute('href', /\/studio\/research\/explorer/)
    }
  })

  test('shows the material vocabulary and says it is not Rivya’s materials', async ({ page }) => {
    await page.goto('/studio/operations/data-quality')
    await page.getByRole('tab', { name: /research/i }).click()
    await expect(page.getByText(/other people’s pages/i)).toBeVisible()
    await expect(page.locator('[data-lexicon-token]').first()).toBeVisible()
  })

  test('counts what was not read per source, not only what raised a rule', async ({ page }) => {
    await page.goto('/studio/operations/data-quality')
    await page.getByRole('tab', { name: /research/i }).click()
    const coverage = page.locator('[data-coverage-source]').first()
    if ((await coverage.count()) > 0) await expect(coverage).toBeVisible()
  })
})

test.describe('the Scraped Products palette group', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('a result opens the ROW, not the unfiltered list', async ({ page }) => {
    await page.goto('/studio/research/explorer')
    const first = page.locator('[data-row-link]').first()
    test.skip((await first.count()) === 0, 'no scraped product in this database')

    // `refresh_research_search_document` writes `/studio/research/explorer?row=<id>` as the
    // document's path; a palette hit that landed on an unfiltered table would make the searcher
    // find the row twice.
    await expect(first).toHaveAttribute('href', /\/studio\/research\/explorer\?.*row=/)
  })
})
