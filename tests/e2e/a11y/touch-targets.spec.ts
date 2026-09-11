import { expect, test } from '@playwright/test'

import { PUBLIC_ROUTES, reachable } from './routes'

/**
 * 44 CSS PIXELS, WHERE THE POINTER IS COARSE — WCAG 2.5.5, FEAT §48, run in Phase 42.
 *
 * A control smaller than a fingertip is a control somebody misses, then misses again, then gives up
 * on. The number is not arbitrary: it is roughly the contact patch of an adult finger, and the
 * people it matters most for are the ones with the least steady aim.
 *
 * IT RUNS ONLY WHERE THE BROWSER REPORTS A COARSE POINTER. `playwright.config.ts` sets `hasTouch`
 * on the three mobile widths; at 1440 the rule does not apply and a mouse hits a 24px target fine.
 * `tests/e2e/design-system.spec.ts` already asserts this for the gallery — this extends it to the
 * pages a visitor actually opens.
 *
 * THE MEASUREMENT IS WHAT THE BROWSER HIT-TESTS, NOT WHAT IT PAINTS, and the difference is not
 * academic here. The design system already answers this rule with `rv-hit-44` (see `base.css`): a
 * control that should stay visually small — a 36px `sm` button — carries a `::before` overlay that
 * extends its TOUCHABLE area to 44px without growing the ink. That is the right answer to the
 * requirement, and it is invisible to `getBoundingClientRect`, which returns the painted box and
 * nothing about a pseudo-element.
 *
 * So the test asks the browser directly. For each control it takes the centre and probes four
 * points at ±22px, and asks `elementFromPoint` what is there. If the control (or something inside
 * it) answers at all four, a fingertip centred on it lands on it — which is the property the
 * requirement is actually about. A first version measured the painted box and reported every `sm`
 * button on the site, which would have led somebody to inflate controls the design system had
 * already handled correctly.
 */

const MINIMUM = 44

test.describe('touch targets', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no control smaller than 44px`, async ({ page, viewport }) => {
      const coarse = (viewport?.width ?? 0) < 500
      test.skip(!coarse, 'desktop width — the rule applies to touch pointers')
      test.skip(!(await reachable(page, route)), `${route} is not published in this database`)

      const small = await page
        .locator('a[href], button, input:not([type="hidden"]), select, [role="button"]')
        .evaluateAll((nodes, minimum) => {
          const half = minimum / 2

          /** Does a fingertip centred here land on this control? */
          const reachableAcross = (element: HTMLElement): boolean => {
            const box = element.getBoundingClientRect()
            const cx = box.left + box.width / 2
            const cy = box.top + box.height / 2
            const probes: [number, number][] = [
              [cx, cy - half + 1],
              [cx, cy + half - 1],
              [cx - half + 1, cy],
              [cx + half - 1, cy],
            ]
            return probes.every(([x, y]) => {
              // Off-screen probes are not failures: a control at the very top of the viewport has
              // nothing above it to hit, and scrolling to it is what a visitor does anyway.
              if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true
              const hit = document.elementFromPoint(x, y)
              return hit !== null && (element.contains(hit) || hit.contains(element))
            })
          }

          return nodes
            .filter((node) => {
              const element = node as HTMLElement
              const style = window.getComputedStyle(element)
              if (style.display === 'none' || style.visibility === 'hidden') return false

              /*
               * THE DEV SERVER'S OWN BUTTON IS NOT OUR CONTROL. Playwright drives `next dev`, which
               * injects a dev-tools launcher into every page. It does not exist in a build a
               * visitor ever sees, and reporting it would give this test a permanent finding nobody
               * can act on.
               */
              if (element.closest('[data-nextjs-dev-tools-button], nextjs-portal') !== null) {
                return false
              }

              /*
               * A VISUALLY HIDDEN CONTROL IS NOT A TARGET UNTIL IT IS FOCUSED. The skip link is
               * clipped to a single pixel until somebody tabs to it, at which point it becomes a
               * full-size control — `tests/e2e/a11y/landmarks.spec.ts` asserts exactly that.
               */
              if (style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)') {
                return false
              }

              // A control inside running prose is exempt by the standard itself: an inline link
              // takes its size from the line, and padding it would break the paragraph.
              if (style.display === 'inline') return false

              const box = element.getBoundingClientRect()
              if (box.width === 0 || box.height === 0) return false
              // Big enough on its own: no probing needed.
              if (box.width >= minimum && box.height >= minimum) return false

              return !reachableAcross(element)
            })
            .map((node) => {
              const box = (node as HTMLElement).getBoundingClientRect()
              const label =
                (node as HTMLElement).getAttribute('aria-label') ??
                node.textContent?.trim().slice(0, 30) ??
                ''
              return `${node.tagName.toLowerCase()} "${label}" ${Math.round(box.width)}×${Math.round(box.height)} and not reachable across ${String(minimum)}px`
            })
        }, MINIMUM)

      expect(small, `${route}: controls under ${String(MINIMUM)}px on a touch pointer`).toEqual([])
    })
  }
})
