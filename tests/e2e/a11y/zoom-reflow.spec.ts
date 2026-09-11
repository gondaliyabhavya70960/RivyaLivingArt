import { expect, test } from '@playwright/test'

import { PUBLIC_ROUTES, reachable } from './routes'

/**
 * 400% ZOOM WITHOUT A SIDEWAYS SCROLLBAR — WCAG 1.4.10 Reflow, run in Phase 42.
 *
 * Somebody with low vision zooms to 400%. The standard says the page must then work in a viewport
 * equivalent to 320 CSS pixels wide without requiring horizontal scrolling to read — because having
 * to scroll left and right for every single line is not reading, it is decoding.
 *
 * 320px IS THE WHOLE TEST, and it is narrower than the narrowest QA width. `playwright.config.ts`
 * stops at 360 because that is the narrowest real phone; 320 is not a device, it is what 1280 looks
 * like at 400%. So this file sets its own viewport rather than using the width projects.
 *
 * THREE THINGS MAY SCROLL SIDEWAYS AND NOTHING ELSE: a table, a diagram and a code block, each
 * inside its own scroll container. The assertion is on the DOCUMENT, so a contained scroller passes
 * and a layout that pushed the body wide does not.
 */

/** 1280 CSS pixels at 400% zoom. The height is the other half of the same equivalence. */
const REFLOW_VIEWPORT = { width: 320, height: 512 }

test.describe('reflow at 400% zoom', () => {
  test.use({ viewport: REFLOW_VIEWPORT })
  test.skip(
    ({ viewport }) => viewport?.width !== REFLOW_VIEWPORT.width,
    'this file sets its own viewport',
  )

  for (const route of PUBLIC_ROUTES) {
    test(`${route} does not scroll sideways at 320px`, async ({ page }) => {
      test.skip(!(await reachable(page, route)), `${route} is not published in this database`)

      const overflow = await page.evaluate(() => {
        const root = document.documentElement
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
      })
      /*
       * A ONE-PIXEL TOLERANCE, for sub-pixel rounding in the layout engine. Anything a person could
       * notice is many pixels, so this costs nothing and avoids a test that fails on a fractional
       * width nobody can see.
       */
      expect(
        overflow.scrollWidth - overflow.clientWidth,
        `${route}: the document is ${String(overflow.scrollWidth)}px wide in a ${String(overflow.clientWidth)}px viewport`,
      ).toBeLessThanOrEqual(1)
    })
  }

  test('names what is overflowing when something does', async ({ page }) => {
    /*
     * A DIAGNOSTIC, NOT A RULE. "The page scrolls sideways" is true and useless; the next question
     * is always "because of what". This runs on the home page and reports the widest offenders, so a
     * failure above has somewhere to send the reader.
     */
    test.skip(!(await reachable(page, '/')), 'the home page is not published in this database')

    const widest = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth
      return Array.from(document.querySelectorAll('*'))
        .map((node) => {
          const box = (node as HTMLElement).getBoundingClientRect()
          return { tag: node.tagName.toLowerCase(), right: Math.round(box.right) }
        })
        .filter((entry) => entry.right > limit + 1)
        .slice(0, 5)
        .map((entry) => `${entry.tag} extends to ${String(entry.right)}px`)
    })
    expect(widest, 'elements extending past the viewport at 320px').toEqual([])
  })
})
