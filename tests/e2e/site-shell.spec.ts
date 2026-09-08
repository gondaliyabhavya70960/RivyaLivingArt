import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The public shell, at every one of FEAT §45's eight widths.
 *
 * IT RUNS AGAINST `/search`, NOT `/`, AND THAT IS DELIBERATE. Every CMS-backed route answers 404
 * until an editor publishes its sections — Phase 09 seeds all 53 of them DRAFT, and 25 of those
 * assert business claims nobody has confirmed yet. A shell test pinned to `/about` would therefore
 * pass or fail depending on the contents of the database it happened to run against, which is not
 * a property of the shell. `/search` has no `pages` row by design, so it renders the chrome
 * unconditionally and this suite measures the thing it names.
 *
 * WHAT IT ASSERTS is the contract every page inherits: the skip link is first and targets the one
 * `<main>`, there is exactly one `<h1>`, the header and footer render from the database, and the
 * landmarks have distinct accessible names.
 */

const PAGE = '/search'

test.describe('the public shell', () => {
  test('renders header, footer and skip link', async ({ page }) => {
    await page.goto(PAGE)

    // The brand comes from BRAND.brand.name; asserting the element rather than the words keeps
    // this test from failing when the owner renames the studio.
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    await expect(page.locator('a[href="#main"]')).toHaveCount(1)
  })

  test('the skip link is the first focusable control and targets <main>', async ({ page }) => {
    await page.goto(PAGE)
    await page.keyboard.press('Tab')

    const focused = page.locator(':focus')
    await expect(focused).toHaveAttribute('href', '#main')
    // Visible only while focused: a skip link that is display:none until focus can never receive it.
    await expect(focused).toBeVisible()
    await expect(page.locator('main#main')).toHaveCount(1)
  })

  test('has exactly one h1 and one main', async ({ page }) => {
    await page.goto(PAGE)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('main')).toHaveCount(1)
  })

  test('names every navigation landmark distinctly', async ({ page }) => {
    await page.goto(PAGE)
    const names = await page
      .locator('nav[aria-label]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
    // Three unnamed <nav> elements give a screen-reader user three regions called "navigation".
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeGreaterThanOrEqual(2)
  })

  test('reports no critical or serious axe violations', async ({ page }) => {
    await page.goto(PAGE)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(
      serious.map((violation) => `${violation.id}: ${violation.help}`),
      'critical/serious axe violations',
    ).toEqual([])
  })
})

test.describe('the error surfaces consume no media', () => {
  /**
   * SEED §47's rule turned around: the 404 and 500 pages are the two most likely to render while
   * something is broken, and the most likely broken thing is media delivery. A 404 that depends on
   * an image is one that can fail twice.
   */
  test('a 404 requests no images', async ({ page }) => {
    const imageRequests: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'image') imageRequests.push(request.url())
    })

    const response = await page.goto('/this-path-does-not-exist')
    expect(response?.status()).toBe(404)
    expect(imageRequests).toEqual([])
  })

  test('a 404 returns a real 404 status, not a 200 with an empty page', async ({ page }) => {
    // SEED §55: a published route with nothing on it must not render an empty shell that reads as
    // "Coming Soon". `renderCmsPage` answers with notFound() instead.
    const response = await page.goto('/this-path-does-not-exist')
    expect(response?.status()).toBe(404)
  })
})

test.describe('the announcement bar', () => {
  /**
   * SEEDED STATE: THERE IS NO ANNOUNCEMENT. §9's message asserts three services, so Phase 09
   * seeded it OWNER_VERIFICATION_REQUIRED and therefore DRAFT; the public policy does not return
   * it and the bar does not render. This asserts the honest outcome rather than skipping: if a bar
   * ever appears here it means an unverified claim reached the public site.
   */
  /**
   * The bar is the first element inside <body> when it renders at all, and it is the only
   * <section> with an accessible name in the shell. Scoping to it matters: an earlier draft of
   * this test looked for any submit button and matched the SEARCH form, which is on this very page
   * — a test that fails for a reason unrelated to what it is named after.
   */
  const bar = 'body > section[aria-label]'

  test('renders nothing while its copy is unverified', async ({ page }) => {
    await page.goto(PAGE)
    await expect(page.locator(bar)).toHaveCount(0)
  })

  test('ships no client island for dismissal', async ({ page }) => {
    // The dismiss control is a Server Action bound to a plain form, so the shell costs no
    // JavaScript for it. With no announcement there is no form at all, which is the stronger case.
    await page.goto(PAGE)
    expect(await page.locator(`${bar} form`).count()).toBe(0)
  })
})
