import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { PUBLIC_ROUTES, STUDIO_ROUTES, reachable } from './routes'

/**
 * AXE, ON EVERY PUBLIC ROUTE — Phase 41's requirement, run in Phase 42.
 *
 * Individual specs already run axe on the pages they cover. What they cannot do is notice a route
 * NOBODY WROTE A SPEC FOR, which is where an accessibility regression actually lands: a new page, a
 * shared component changed for one surface and reused on four.
 *
 * CRITICAL AND SERIOUS ONLY, and the line is drawn deliberately. `moderate` and `minor` include
 * findings that are contested, context-dependent, or true of a pattern the design system uses
 * everywhere on purpose — and a gate that fires on those gets an exceptions file, then the
 * exceptions file gets entries nobody reads, and then the gate means nothing. Critical and serious
 * are the ones that stop somebody using the page.
 *
 * THERE IS NO EXCEPTIONS FILE, and there should not be one. If a rule is wrong for this product,
 * the argument belongs in `docs/ops/ACCESSIBILITY.md` and the disabling belongs beside it, named.
 *
 * IT RUNS AT TWO WIDTHS. A layout can be perfect at 1440 and hide its navigation behind a control
 * with no accessible name at 390 — the disclosure only exists at one of them.
 */

const SWEEP_WIDTHS = [1440, 390]

test.describe('axe sweep', () => {
  test.skip(
    ({ viewport }) => !SWEEP_WIDTHS.includes(viewport?.width ?? 0),
    'swept at 1440 and 390 — a third width repeats the same DOM',
  )

  for (const route of [...PUBLIC_ROUTES, ...STUDIO_ROUTES]) {
    test(`${route} reports no critical or serious violation`, async ({ page }) => {
      test.skip(!(await reachable(page, route)), `${route} is not published in this database`)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      const blocking = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      )

      /*
       * REPORTED AS A LIST OF STRINGS, not as an object. A failed `toEqual` on axe's own result
       * shape prints several screens of nested nodes, and the one thing a reader needs — which rule,
       * on which element — is somewhere in the middle of it.
       */
      expect(
        blocking.map(
          (violation) =>
            `${violation.id} (${violation.impact ?? '?'}) — ${violation.nodes[0]?.target.join(' ') ?? '?'}`,
        ),
        `${route}: critical/serious axe violations`,
      ).toEqual([])
    })
  }
})
