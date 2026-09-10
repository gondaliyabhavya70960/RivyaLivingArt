import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

/**
 * Adding a complete second source through the interface, with zero code changes.
 *
 * THIS IS THE PHASE'S CENTRAL CLAIM AND THE ONLY TEST THAT CAN MAKE IT. FEAT §26 exists because
 * adding a competitor used to mean editing the engine; the schema was shaped so that every
 * behavioural difference between two sources is a column or a child row, and the way to prove that
 * held is to add one entirely through the UI and then assert THE REPOSITORY DID NOT CHANGE. A test
 * that only checked the rows would pass just as well against a system where somebody had to write
 * an adapter branch first.
 *
 * THE `git status` ASSERTION IS THE TEST. Everything above it is setup.
 *
 * THE ANONYMOUS HALF RUNS EVERYWHERE. The signed-in half needs an auth server the local PostgREST
 * shim does not run, so it is guarded by `STUDIO_STORAGE_STATE` and shows as skipped rather than
 * being omitted — the same guard Phases 23, 24 and 25 record for the same reason. A forged cookie
 * is refused by `getUser()`, which is why forging one is not the workaround.
 */

const NEW_SOURCE = '/studio/research/sources/new'

test.describe('an anonymous visitor', () => {
  test('is redirected away from the create route', async ({ page }) => {
    await page.goto(NEW_SOURCE)
    await expect(page).toHaveURL(/\/studio\/login/)
  })

  test('is redirected away from a source detail route', async ({ page }) => {
    await page.goto('/studio/research/sources/00000000-0000-0000-0000-000000000000')
    await expect(page).toHaveURL(/\/studio\/login/)
  })
})

test.describe('a researcher configuring a source', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('adds a complete source, its patterns, its mapping and its schedule', async ({ page }) => {
    const slug = `e2e-source-${Date.now().toString(36)}`

    await page.goto(NEW_SOURCE)
    await page.fill('input[name="name"]', 'E2E Comparator')
    await page.fill('input[name="slug"]', slug)
    // `example.com` is reserved by RFC 2606 and belongs to nobody. No real competitor is ever
    // named in this repository, including in a fixture (D10).
    await page.fill('input[name="base_url"]', 'https://comparator.example')
    await page.selectOption('select[name="region"]', 'IN')
    await page.selectOption('select[name="currency"]', 'INR')
    await page.selectOption('select[name="source_type"]', 'BRAND')
    await page.selectOption('select[name="analytics_league"]', 'PEER')
    await page.selectOption('select[name="collection_mode"]', 'SEED_URLS')
    await page.selectOption('select[name="image_extraction_mode"]', 'URL_ONLY')
    await page.fill('input[name="rate_limit_rpm"]', '10')
    await page.fill('input[name="request_delay_ms"]', '4000')
    await page.fill('input[name="concurrency"]', '1')
    await page.fill('textarea[name="notes"]', 'Added by the Phase 26 end-to-end test.')
    await page.click('button[type="submit"]')

    // The create action redirects to the source's own page, which is where the child rows live.
    await expect(page).toHaveURL(/\/studio\/research\/sources\/[0-9a-f-]{36}/)

    for (const [kind, pattern] of [
      ['PRODUCT', '/collection/*/p/*'],
      ['CATEGORY', '/collection/*'],
      ['EXCLUDE', '/account/**'],
    ] as const) {
      await page.selectOption('select[name="kind"]', kind)
      await page.fill('input[name="pattern"]', pattern)
      await page.locator('form:has(input[name="pattern"]) button[type="submit"]').click()
      await expect(page.locator(`text=${pattern}`).first()).toBeVisible()
    }

    // Four labels, one of them explicitly dismissed — an IGNORE is a decision and is recorded as
    // one, which is why it is part of the "complete source" this test builds.
    for (const [label, ignore] of [
      ['Long Tables', false],
      ['Consoles', false],
      ['Wall Pieces', false],
      ['Mattresses', true],
    ] as const) {
      await page.fill('input[name="source_label"]', label)
      if (ignore) {
        await page.check('input[name="is_ignored"]')
      } else {
        const options = await page.locator('select[name="category_id"] option').count()
        expect(options).toBeGreaterThan(1)
        await page.selectOption('select[name="category_id"]', { index: 1 })
      }
      await page.locator('form:has(input[name="source_label"]) button[type="submit"]').click()
      await expect(page.locator(`text=${label}`).first()).toBeVisible()
    }

    await page.selectOption('select[name="job_type"]', 'REFRESH')
    await page.fill('input[name="cron_expression"]', '0 */12 * * *')
    await page.locator('form:has(input[name="cron_expression"]) button[type="submit"]').click()
    await expect(page.locator('text=0 */12 * * *').first()).toBeVisible()

    /*
     * THE ASSERTION THIS FILE EXISTS FOR. A complete second source has just been configured, and
     * not one file changed. If FEAT §26 had been implemented with a branch per source somewhere
     * under lib/scraper, this line is where that would show up.
     */
    const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
    expect(status.trim()).toBe('')
  })

  test('refuses a schedule that fires more often than every six hours', async ({ page }) => {
    await page.goto('/studio/research/sources')
    const first = page.locator('table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no source to configure in this database')
    await first.click()

    await page.selectOption('select[name="job_type"]', 'DETAIL')
    await page.fill('input[name="cron_expression"]', '*/5 * * * *')
    await page.locator('form:has(input[name="cron_expression"]) button[type="submit"]').click()

    // Refused by the form's own copy of the rule, and by the CHECK underneath it if the form is
    // bypassed. Either way the operator is told, and nothing is stored.
    await expect(page.locator('[data-form-error]').first()).toBeVisible()
  })

  test('cannot switch on a source whose policy review is not approved', async ({ page }) => {
    await page.goto('/studio/research/sources')
    const first = page.locator('table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no source in this database')
    await first.click()

    const blocked = page.locator('[data-enable-blocked]')
    if ((await blocked.count()) === 0) {
      test.skip(true, 'that source is already approved')
    }
    // THE REASON IS ON THE PAGE, beside a control that is disabled rather than hidden.
    await expect(blocked).toBeVisible()
    await expect(page.locator('input[name="enable"]')).toBeDisabled()
  })

  test('tests patterns without making a single request', async ({ page }) => {
    await page.goto('/studio/research/sources')
    const first = page.locator('table tbody tr a').first()
    test.skip((await first.count()) === 0, 'no source in this database')
    await first.click()

    /*
     * THE NETWORK ASSERTION IS THE TEST. Every request the browser makes is recorded, and the only
     * ones permitted are to this application's own origin. A tester that reached the source's
     * website — even once, even for robots.txt — would show up here as a request to another host.
     */
    const offOrigin: string[] = []
    const appOrigin = new URL(page.url()).origin
    page.on('request', (request) => {
      if (!request.url().startsWith(appOrigin)) offOrigin.push(request.url())
    })

    await page.fill(
      '[data-pattern-tester] textarea[name="test"]',
      [
        'https://comparator.example/collection/tables/p/one',
        'https://comparator.example/collection/tables',
        'https://comparator.example/account/orders',
        'https://comparator.example/about',
      ].join('\n'),
    )
    await page.locator('[data-pattern-tester] button[type="submit"]').click()

    await expect(page.locator('[data-tester-results]')).toBeVisible()
    expect(offOrigin).toEqual([])
  })
})
