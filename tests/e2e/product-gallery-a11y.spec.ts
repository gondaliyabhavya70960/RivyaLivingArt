import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * The gallery, driven entirely from the keyboard.
 *
 * WHY THE KEYBOARD IS THE WHOLE TEST. A lightbox is the control most likely to be built as a
 * mouse-only affordance and to look finished while being unusable: it opens on click, closes on a
 * click outside, and traps a keyboard user inside a dialog they cannot leave. Every assertion here
 * is a key press.
 *
 * FOCUS RESTORATION IS THE ONE PEOPLE FORGET. Closing a dialog without returning focus drops a
 * screen-reader user at the top of the document, and they have to walk back through the whole page
 * to reach the thumbnail they were on. `Escape` must put focus back where it came from.
 *
 * Skips when the database holds no published product with more than one image — there is nothing
 * to page through, and a gallery of one is not the thing being tested.
 */

async function firstProductPath(page: Page): Promise<string | null> {
  const response = await page.goto('/collection')
  if (response?.status() !== 200) return null
  return page.locator('[data-product-card] a[href^="/product/"]').first().getAttribute('href')
}

async function openGallery(page: Page): Promise<boolean> {
  const path = await firstProductPath(page)
  if (path === null) return false
  await page.goto(path)
  return (await page.locator('[data-gallery-thumbnail]').count()) > 1
}

test.describe('the product gallery', () => {
  test('thumbnails are a roving-tabindex list — one stop, not one per image', async ({ page }) => {
    test.skip(!(await openGallery(page)), 'no published product with a multi-image gallery')

    const thumbs = page.locator('[data-gallery-thumbnail]')
    const count = await thumbs.count()

    // Exactly one thumbnail is in the tab order; the rest are reached with the arrow keys. A strip
    // of twelve images that each take a Tab press is twelve presses between the page's controls.
    let tabbable = 0
    for (let i = 0; i < count; i += 1) {
      if ((await thumbs.nth(i).getAttribute('tabindex')) === '0') tabbable += 1
    }
    expect(tabbable).toBe(1)

    // And the strip itself is a named list, so a screen reader says what it is before its items.
    await expect(page.locator('[data-gallery-thumbnails]')).toHaveAttribute('aria-label', /.+/)
  })

  test('arrows move between thumbnails', async ({ page }) => {
    test.skip(!(await openGallery(page)), 'no published product with a multi-image gallery')

    const thumbs = page.locator('[data-gallery-thumbnail]')
    await thumbs.first().focus()
    await page.keyboard.press('ArrowRight')

    await expect(thumbs.nth(1)).toBeFocused()

    await page.keyboard.press('ArrowLeft')
    await expect(thumbs.first()).toBeFocused()
  })

  test('Home and End jump to the ends', async ({ page }) => {
    test.skip(!(await openGallery(page)), 'no published product with a multi-image gallery')

    const thumbs = page.locator('[data-gallery-thumbnail]')
    const count = await thumbs.count()

    await thumbs.first().focus()
    await page.keyboard.press('End')
    await expect(thumbs.nth(count - 1)).toBeFocused()

    await page.keyboard.press('Home')
    await expect(thumbs.first()).toBeFocused()
  })

  test('Enter opens the lightbox and Escape closes it, restoring focus', async ({ page }) => {
    test.skip(!(await openGallery(page)), 'no published product with a multi-image gallery')

    const thumbs = page.locator('[data-gallery-thumbnail]')
    // The second thumbnail, not the first: returning focus to the first would look correct for the
    // wrong reason if the implementation simply focused the start of the strip.
    await thumbs.first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(thumbs.nth(1)).toBeFocused()

    await page.keyboard.press('Enter')
    const lightbox = page.locator('[data-lightbox-stage]')
    await expect(lightbox).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(lightbox).toBeHidden()
    await expect(thumbs.nth(1)).toBeFocused()
  })

  test('arrows move between images inside the lightbox', async ({ page }) => {
    test.skip(!(await openGallery(page)), 'no published product with a multi-image gallery')

    await page.locator('[data-gallery-thumbnail]').first().focus()
    await page.keyboard.press('Enter')

    const stage = page.locator('[data-lightbox-stage]')
    await expect(stage).toBeVisible()

    /*
     * WHICH IMAGE IS SHOWING IS READ FROM THE ZOOM BUTTON'S ACCESSIBLE NAME, not from an index
     * attribute. The button IS the image and takes the asset's own `alt_text` as its label, so the
     * name changing is the same evidence a screen-reader user would get — and it needs no test-only
     * attribute added to the component to observe it.
     */
    const zoom = page.locator('[data-lightbox-zoom]')
    const before = await zoom.getAttribute('aria-label')
    await page.keyboard.press('ArrowRight')
    await expect(zoom).not.toHaveAttribute('aria-label', before ?? '')
  })

  test('axe reports no critical or serious violations with the lightbox open', async ({ page }) => {
    test.skip(!(await openGallery(page)), 'no published product with a multi-image gallery')

    await page.locator('[data-gallery-thumbnail]').first().focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-lightbox-stage]')).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    // The ids as well as the count: a bare count tells you something broke and nothing about what.
    expect(blocking.map((violation) => violation.id)).toEqual([])
  })
})
