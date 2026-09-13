import { expect, test, type Page } from '@playwright/test'

/**
 * THE PAGE-SECTION INDEX (RC-245), ASSERTED AT THE WIDTH IT IS DECIDED BY.
 *
 * `tests/unit/section-rail.test.ts` covers the SELECTION rule — which bands appear and how they are
 * numbered — because that is the part a later edit can get wrong silently. It cannot cover the part
 * this file exists for: the rail is `position: fixed`, so it reserves no space, and whether it sits
 * beside the reading column or ON it is a fact about the viewport that only a browser knows.
 *
 * THE THRESHOLD IS ARITHMETIC AND THE ARITHMETIC IS ASSERTED HERE. `Container` at `default` is 75rem
 * centred inside `--rv-gutter`, so free space before the content is `max(0, (vw − 1200) ÷ 2) + gutter`
 * — 47px at 1024, which is less than the rail's 56, and 97px at 1280. DESIGN_SYSTEM §7.15 records
 * those numbers; without this file they are a claim in a document rather than a property of the
 * build. An earlier version of the component showed the rail at `lg` and bought the space with
 * container padding, which double-inset the copy to 240px at 1440 — a regression that looked
 * correct in the diff and only existed on screen.
 *
 * THE OVERFLOW ASSERTION IS NOT DECORATION. The amendment that added this rail also had to fix a
 * footer email address that pushed `scrollWidth` to 1053 against a 1024 viewport on EVERY route,
 * and nothing caught it because nothing was looking. A fixed column at the inline start is the most
 * likely thing on the page to reintroduce that, so it is checked wherever the rail is drawn.
 */

/** The one CMS route that reliably composes enough labelled bands to draw a rail. */
const ROUTE = '/'

/** `xl` in this build's Tailwind scale. The rail is drawn at this width and above, never below. */
const XL = 1280

async function pageIsPublished(page: Page): Promise<boolean> {
  const response = await page.goto(ROUTE)
  return response?.status() === 200
}

function rail(page: Page) {
  return page.locator('[data-rv-section-rail]')
}

test.describe('the page-section index', () => {
  test('is drawn at xl and above, and never below it', async ({ page }, testInfo) => {
    test.skip(!(await pageIsPublished(page)), `no published sections on ${ROUTE} in this database`)

    const width = page.viewportSize()?.width ?? 0
    expect(width).toBeGreaterThan(0)

    const locator = rail(page)

    if (width >= XL) {
      /*
       * `toBeVisible` rather than a count: the element is in the DOM at every width — it is hidden
       * by a `hidden xl:block` utility pair, not by a conditional render — so counting it would
       * pass at 360px and assert nothing at all.
       */
      await expect(locator).toBeVisible()

      // Two entries is the component's own floor, so a rail that is drawn has at least two links.
      expect(await locator.locator('a').count()).toBeGreaterThanOrEqual(2)
    } else {
      await expect(locator).toBeHidden()
    }

    testInfo.annotations.push({ type: 'width', description: `${width}px` })
  })

  test('never overlaps the reading column it indexes', async ({ page }) => {
    test.skip(!(await pageIsPublished(page)), `no published sections on ${ROUTE} in this database`)

    const width = page.viewportSize()?.width ?? 0
    test.skip(width < XL, 'the rail is not drawn below xl')

    const railBox = await rail(page).boundingBox()
    expect(railBox).not.toBeNull()

    /*
     * THE CONTENT EDGE IS TAKEN FROM A HEADING, not from the container element. A container is
     * full-width with padding, so its own box would start at 0 and prove nothing; where the TEXT
     * starts is the thing the reverted `lg` version got wrong.
     */
    const heading = page.locator('main h2').first()
    await expect(heading).toBeAttached()
    const headingBox = await heading.boundingBox()
    expect(headingBox).not.toBeNull()

    if (railBox === null || headingBox === null) return

    expect(railBox.x + railBox.width).toBeLessThanOrEqual(headingBox.x)
  })

  test('adds no horizontal scroll to the page it sits beside', async ({ page }) => {
    test.skip(!(await pageIsPublished(page)), `no published sections on ${ROUTE} in this database`)

    const width = page.viewportSize()?.width ?? 0
    test.skip(width < XL, 'the rail is not drawn below xl')

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))

    // One pixel of slack for sub-pixel layout rounding; anything more is a real overflow.
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('gives every entry an accessible name, and the landmark one of its own', async ({ page }) => {
    test.skip(!(await pageIsPublished(page)), `no published sections on ${ROUTE} in this database`)

    const width = page.viewportSize()?.width ?? 0
    test.skip(width < XL, 'the rail is not drawn below xl')

    /*
     * A SECOND NAVIGATION LANDMARK WITHOUT A NAME is worse than none: a screen-reader user moving
     * between landmarks hears "navigation" twice and must enter one to tell them apart. The name is
     * a `UI_LABEL` row, and the component returns null when it is missing — so a rail that is drawn
     * at all has been named.
     */
    const name = await rail(page).getAttribute('aria-label')
    expect(name).not.toBeNull()
    expect((name ?? '').trim()).not.toBe('')

    /*
     * The visible mark is a number; the eyebrow is `sr-only`. So the link's accessible name must be
     * longer than its digits — if the `sr-only` span were ever dropped, the whole index would
     * announce as "01 02 03", which is navigable by nothing.
     */
    const links = rail(page).locator('a')
    const count = await links.count()
    expect(count).toBeGreaterThanOrEqual(2)

    for (let i = 0; i < count; i += 1) {
      const text = (await links.nth(i).textContent()) ?? ''
      expect(text.replace(/\d/g, '').trim()).not.toBe('')
    }
  })

  test('points every entry at a band that exists on the page', async ({ page }) => {
    test.skip(!(await pageIsPublished(page)), `no published sections on ${ROUTE} in this database`)

    const width = page.viewportSize()?.width ?? 0
    test.skip(width < XL, 'the rail is not drawn below xl')

    /*
     * An index whose links go nowhere is worse than no index. The ids come from `page_sections.id`
     * and the anchors from `SectionShell`, which are two different components agreeing on a format
     * — exactly the kind of agreement that breaks without anything failing.
     */
    const hrefs = await rail(page).locator('a').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
    expect(hrefs.length).toBeGreaterThanOrEqual(2)

    for (const href of hrefs) {
      expect(href.startsWith('#')).toBe(true)
      await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1)
    }
  })
})
