import { expect, test } from '@playwright/test'

import { PUBLIC_ROUTES, reachable } from './routes'

/**
 * THE HEADING OUTLINE — Phase 41, run in Phase 42.
 *
 * Headings are how a screen-reader user reads a page they have not seen: they jump the outline
 * rather than the prose. Two things break that, and neither is visible on screen.
 *
 *   MORE THAN ONE `h1`, OR NONE. The page either has no title in the outline or claims several.
 *
 *   A SKIPPED LEVEL — an `h2` followed by an `h4`. It reads as a missing section, and the usual
 *   cause is somebody choosing a heading for its size. The design system has `size` for that
 *   precisely so the level can stay honest.
 *
 * The CMS decides what these say; the code decides the level. So this is a structural test, and it
 * asserts no words.
 */

test.describe('heading outline', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'the outline does not vary by width')

  for (const route of PUBLIC_ROUTES) {
    test(`${route} has one h1 and skips no level`, async ({ page }) => {
      test.skip(!(await reachable(page, route)), `${route} is not published in this database`)

      const levels = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => {
              // A heading inside a closed disclosure is still in the outline; one that is
              // `display: none` is not, and asserting over it would fail on a correct page.
              const style = window.getComputedStyle(node)
              return style.display !== 'none' && style.visibility !== 'hidden'
            })
            .map((node) => Number(node.tagName.slice(1))),
        )

      expect(levels.filter((level) => level === 1), `${route}: h1 count`).toHaveLength(1)
      expect(levels[0], `${route}: the outline does not start at h1`).toBe(1)

      for (let index = 1; index < levels.length; index += 1) {
        const previous = levels[index - 1] as number
        const current = levels[index] as number
        expect(
          current - previous,
          `${route}: h${String(previous)} is followed by h${String(current)}`,
        ).toBeLessThanOrEqual(1)
      }
    })
  }
})
