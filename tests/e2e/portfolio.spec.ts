import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * `/portfolio` while the archive is empty — which is the state this site launches in.
 *
 * THE EMPTY ARCHIVE IS NOT A TEMPORARY CONDITION. `portfolio_projects` ships with zero rows, no
 * seed can address the table, and a project exists only because the owner entered one, confirmed it
 * happened, and — if it names a client — recorded that client's consent. SEED §17 puts the rule in
 * capitals and D10 names delivered projects and named customers as the first two things that may
 * never be fabricated. So "the page explains its own emptiness, honestly, in the specification's
 * own words" is the behaviour that has to be right on day one.
 *
 * IT SKIPS RATHER THAN FAILS WHEN PROJECTS EXIST. A developer whose database has a real project in
 * it should not have to choose which suite to believe; the project-detail assertions below run in
 * that state instead, and the empty-state ones stand down.
 *
 * THE BASELINE GUARD. Every CMS-backed route answers 404 until an editor publishes its sections, and
 * Phase 09 seeds all of them DRAFT. A test pinned to `/portfolio` would therefore pass or fail on
 * the contents of whichever database it ran against, which is not a property of this phase. Each
 * test below establishes reachability first and skips with a reason, so a red run means something
 * broke rather than something was never published.
 */

async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}

async function projectCount(page: Page): Promise<number> {
  return page.locator('[data-project-card]').count()
}

test.describe('/portfolio while the archive is empty', () => {
  test('renders, and says why there is nothing here', async ({ page }) => {
    test.skip(!(await reachable(page, '/portfolio')), 'no published sections on /portfolio')
    test.skip((await projectCount(page)) > 0, 'this database has published projects')

    await expect(page.locator('h1')).toHaveCount(1)

    // SEED §28, both lines. Asserted as text rather than by test id because the words ARE the
    // requirement: an empty state that renders an element with nothing legible in it has failed.
    await expect(page.getByText('The project archive is being prepared.')).toBeVisible()
    await expect(
      page.getByText('Verified Rivya projects will appear here as the portfolio develops.'),
    ).toBeVisible()
  })

  /**
   * SEED §55 forbids "Coming Soon" outright. `tests/unit/portfolio-empty.test.ts` checks the copy
   * this repository ships; this checks what the page actually renders, which is the thing a visitor
   * meets and which includes anything an editor has since typed into the Studio.
   */
  test('says "Coming Soon" nowhere', async ({ page }) => {
    test.skip(!(await reachable(page, '/portfolio')), 'no published sections on /portfolio')
    await expect(page.locator('body')).not.toContainText(/coming\s+soon/i)
  })

  test('reports no critical or serious axe violations', async ({ page }) => {
    test.skip(!(await reachable(page, '/portfolio')), 'no published sections on /portfolio')
    const results = await new AxeBuilder({ page }).analyze()
    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(serious.map((violation) => violation.id)).toEqual([])
  })
})

test.describe('a project URL that nobody has published', () => {
  /**
   * THE EXIT CRITERION, AS A REQUEST. `/portfolio/[slug]` must 404 for every slug while nothing is
   * published — including a slug that exists as a DRAFT, which is the case a stale cache would get
   * wrong and the one an anonymous request is the only way to check.
   */
  test('returns 404 for a slug nothing published', async ({ page }) => {
    const response = await page.goto('/portfolio/a-slug-nobody-published')
    expect(response?.status()).toBe(404)
  })

  test('returns 404 for a slug that is not a slug at all', async ({ page }) => {
    const response = await page.goto('/portfolio/../../etc/passwd')
    expect(response?.status()).toBe(404)
  })
})

test.describe('a published project, when one exists', () => {
  /**
   * These run only once the owner has published something. They are written now rather than later
   * because the phase's exit criteria are about what happens THEN, and a suite that only covers the
   * empty case would go green forever without ever having checked the thing it is named after.
   */
  test('the landing page links to it and the page renders', async ({ page }) => {
    test.skip(!(await reachable(page, '/portfolio')), 'no published sections on /portfolio')
    const cards = await projectCount(page)
    test.skip(cards === 0, 'no published projects in this database')

    const first = page.locator('[data-project-card] a').first()
    const href = await first.getAttribute('href')
    expect(href).toMatch(/^\/portfolio\/[a-z0-9-]+$/)

    const response = await page.goto(href ?? '/portfolio')
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveCount(1)
  })

  /**
   * The evidence note is the owner's private record of why a project is real — an invoice number,
   * where the photographs came from. `0152` revokes the column from `anon` at the grant, so this is
   * a second look at a rule the database already enforces: if the column ever reaches the page, it
   * reaches every visitor and every crawler.
   */
  test('never renders the evidence note', async ({ page }) => {
    test.skip(!(await reachable(page, '/portfolio')), 'no published sections on /portfolio')
    test.skip((await projectCount(page)) === 0, 'no published projects in this database')

    const href = await page.locator('[data-project-card] a').first().getAttribute('href')
    await page.goto(href ?? '/portfolio')
    await expect(page.locator('body')).not.toContainText(/evidence[_ ]note/i)
  })
})
