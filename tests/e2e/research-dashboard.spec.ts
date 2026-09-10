import { expect, test } from '@playwright/test'

/**
 * `/studio/research/**` — the boundary, from a browser.
 *
 * THE ASSERTIONS THAT MATTER ARE ALL REFUSALS, and they are the browser-level statement of
 * isolation invariant I3: there is no route a visitor can reach that renders anything research-
 * shaped. `scripts/research/check-research-isolation.mjs` proves that by reading the source of
 * every public tree; this proves it by asking the running application, which is the layer a static
 * check cannot reach — a route added later, a redirect misconfigured, a middleware matcher with a
 * gap in it.
 *
 * THE SIGNED-IN HALF NEEDS AN AUTH SERVER THE LOCAL SHIM DOES NOT RUN, so it is guarded by
 * `STUDIO_STORAGE_STATE` and shows as skipped rather than being omitted. A forged cookie is
 * refused by `getUser()`, which is the point of using it.
 */

const RESEARCH_PAGES = [
  '/studio/research/dashboard',
  '/studio/research/sources',
  '/studio/research/jobs',
  '/studio/research/runs',
  '/studio/research/scrape',
]

test.describe('an anonymous visitor', () => {
  for (const path of RESEARCH_PAGES) {
    test(`is redirected away from ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/studio\/login/)
    })
  }

  test('cannot reach a run detail page', async ({ page }) => {
    await page.goto('/studio/research/runs/00000000-0000-0000-0000-000000000000')
    await expect(page).toHaveURL(/\/studio\/login/)
  })

  test('cannot run the research cron without the secret', async ({ request }) => {
    // NOT 404. `app/api/cron/content-schedule` established 401 for this repository, and two cron
    // endpoints answering differently to the same mistake is worse than either answer alone.
    // 503 means the deployment has no CRON_SECRET configured, which is also a refusal.
    const response = await request.get('/api/cron/research')
    expect([401, 503]).toContain(response.status())
  })

  test('finds no research route in the sitemap', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    if (response.status() !== 200) return
    const body = await response.text()
    // I3, asked of the running application rather than of the source tree.
    expect(body).not.toContain('research')
    expect(body).not.toContain('scraper')
  })
})

test.describe('the research dashboard, signed in', () => {
  test.skip(!process.env.STUDIO_STORAGE_STATE, 'no authenticated storage state configured')
  test.use({ storageState: process.env.STUDIO_STORAGE_STATE })

  test('renders all seven stages, including the empty ones', async ({ page }) => {
    await page.goto('/studio/research/dashboard')
    const counts = page.locator('[data-stage-counts] [data-stage]')
    // ALWAYS ALL SEVEN. A pipeline that renders only the stages it has rows for is a pipeline
    // whose shape changes as it fills, and the shape is what an operator is learning.
    await expect(counts).toHaveCount(7)
  })

  test('says why every number is zero rather than just showing zeroes', async ({ page }) => {
    await page.goto('/studio/research/dashboard')
    const sources = page.locator('[data-source-list] [data-source-id]')
    if ((await sources.count()) > 0) return
    await expect(page.getByText('No source has been approved yet')).toBeVisible()
  })

  test('shows no approved source, because this repository seeds none', async ({ page }) => {
    await page.goto('/studio/research/sources')
    const approved = page.locator('[data-source-id][data-policy-status="APPROVED"]')
    // THE ASSERTION WORTH THE MOST ON A FRESH DATABASE. A seeded, approved source would mean this
    // repository had asserted on somebody's behalf that Rivya may read a third party's website.
    await expect(approved).toHaveCount(0)
  })

  test('states that approval is the owner’s decision, on the page where it is made', async ({
    page,
  }) => {
    await page.goto('/studio/research/sources')
    await expect(page.getByText('Approval is the owner')).toBeVisible()
  })
})
