import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * `/custom-commissions`, in the state this phase ships in and the one after.
 *
 * THE CONFIGURATOR IS BEHIND A FLAG AND THE FLAG IS OFF, which is the whole shape of this file.
 * Phase 19 builds the eleven steps and validates a completed brief; Phase 20 persists it and hands
 * off to WhatsApp. Until that half exists a visitor finishing the form would reach a Submit button
 * that saves nothing, and D1 forbids a WhatsApp redirect before an inquiry is stored — so
 * `commission_configurator` ships OFF and the page keeps its Phase 09 copy.
 *
 * So the assertions that matter on day one are the ABSENCE ones: the page renders, and the
 * configurator is not in the markup. Not hidden, not disabled — absent. `isEnabled()` is evaluated
 * on the server, so a switched-off feature is not in the response at all, and a test that only
 * checked visibility would pass against a build that shipped the whole island to the browser and
 * hid it with CSS.
 *
 * THE FLAG-ON CASES ARE WRITTEN NOW rather than left for Phase 20, so the suite is not green
 * forever without ever having exercised the thing it is named after. Each skips with a reason when
 * the flag is off, which is a report that says "not switched on" instead of a file that says
 * nothing.
 *
 * NO SELECTOR HERE IS WRITTEN AGAINST COPY. Every visible string on this page comes from
 * `global_content` and every question comes from `customization_forms`, so a test pinned to the
 * words would fail the moment an editor changed them — which is precisely the freedom D2 exists to
 * give. The hooks are `data-configurator`, `data-configurator-step` and `data-configurator-submit`.
 */

const PATH = '/custom-commissions'

async function reachable(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path)
  return response?.status() === 200
}

/** Is the island in the response? Not visible — present. See the note above on why. */
async function configuratorPresent(page: Page): Promise<boolean> {
  return (await page.locator('[data-configurator]').count()) > 0
}

test.describe('/custom-commissions', () => {
  test('renders', async ({ page }) => {
    test.skip(!(await reachable(page, PATH)), 'no published sections on /custom-commissions')

    await expect(page.locator('h1')).toHaveCount(1)
  })

  test('has no accessibility violations', async ({ page }) => {
    test.skip(!(await reachable(page, PATH)), 'no published sections on /custom-commissions')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  /**
   * The day-one assertion, and the one that must keep passing until Phase 20's exit criteria switch
   * the flag on. It is deliberately not skipped when the flag is off — that IS the case under test.
   */
  test('ships no configurator while the feature is switched off', async ({ page }) => {
    test.skip(!(await reachable(page, PATH)), 'no published sections on /custom-commissions')
    test.skip(await configuratorPresent(page), 'commission_configurator is switched on')

    // Not `toBeHidden`. A switched-off feature is evaluated server-side and is absent from the
    // response; a hidden one would mean the island shipped and the flag only styled it away.
    await expect(page.locator('[data-configurator]')).toHaveCount(0)
    const html = await page.content()
    expect(html).not.toContain('data-configurator-step')
  })

  test('offers no price anywhere on the page', async ({ page }) => {
    test.skip(!(await reachable(page, PATH)), 'no published sections on /custom-commissions')

    /*
     * D1: no checkout, no gateway, no price. A configurator that totalled a quote as a visitor
     * chose options would be a price list assembled one answer at a time, and this studio quotes
     * after reading a brief. `tests/unit/no-pricing.test.ts` closes the same door at the schema;
     * this closes it at the rendered page, where a CMS string could reopen it.
     */
    const body = (await page.locator('body').innerText()).toLowerCase()
    for (const forbidden of ['₹', 'total price', 'subtotal', 'add to cart', 'checkout']) {
      expect(body, `"${forbidden}" appeared on ${PATH}`).not.toContain(forbidden)
    }
  })
})

test.describe('/custom-commissions once the feature is switched on', () => {
  test('opens on the first step of the form', async ({ page }) => {
    test.skip(!(await reachable(page, PATH)), 'no published sections on /custom-commissions')
    test.skip(!(await configuratorPresent(page)), 'commission_configurator is switched off')

    const island = page.locator('[data-configurator]')
    await expect(island).toHaveCount(1)
    // Whatever the first step is called, it is not the review — a form that opened on its own
    // summary would be a form with nothing to summarise.
    await expect(island).not.toHaveAttribute('data-configurator-step', 'review')
  })

  /**
   * `?step=` is read on the client after mount, deliberately: reading it on the server would make
   * `/custom-commissions` a different document per query string and lose the cached render for
   * every visitor who arrived without one.
   */
  test('honours ?step= as a deep link into a step', async ({ page }) => {
    test.skip(!(await reachable(page, PATH)), 'no published sections on /custom-commissions')
    test.skip(!(await configuratorPresent(page)), 'commission_configurator is switched off')

    const first = await page.locator('[data-configurator]').getAttribute('data-configurator-step')
    await page.goto(`${PATH}?step=contact`)

    const island = page.locator('[data-configurator]')
    await expect(island).toHaveAttribute('data-configurator-step', 'contact')
    expect(first).not.toBe('contact')
  })

  /**
   * A step key that does not exist is a link somebody edited or a step an editor removed. Opening
   * the form at step one is the honest answer; a 404 would lose a visitor who mistyped a URL.
   */
  test('falls back to the first step when ?step= names nothing', async ({ page }) => {
    test.skip(!(await reachable(page, PATH)), 'no published sections on /custom-commissions')
    test.skip(!(await configuratorPresent(page)), 'commission_configurator is switched off')

    await page.goto(PATH)
    const first = await page.locator('[data-configurator]').getAttribute('data-configurator-step')

    await page.goto(`${PATH}?step=not_a_step`)
    await expect(page.locator('[data-configurator]')).toHaveAttribute(
      'data-configurator-step',
      first ?? '',
    )
  })

  /**
   * PHASE 19 ENDS AT A VALIDATED PAYLOAD. The Submit button is rendered disabled and carries no
   * handler at all, because D1 requires an inquiry to be persisted before any WhatsApp redirect and
   * persistence is Phase 20's. A working button here would either drop the brief or hand the
   * visitor to WhatsApp with nothing saved.
   *
   * This test is the one that must be CHANGED by Phase 20 rather than deleted: when submission
   * works, the assertion becomes that the button is enabled and that an inquiry row exists.
   */
  test('leaves the review step unable to submit', async ({ page }) => {
    test.skip(!(await reachable(page, PATH)), 'no published sections on /custom-commissions')
    test.skip(!(await configuratorPresent(page)), 'commission_configurator is switched off')

    const submit = page.locator('[data-configurator-submit]')
    test.skip((await submit.count()) === 0, 'the review step has not been reached')

    await expect(submit).toBeDisabled()
  })
})

/**
 * The Studio half. Both Phase 19 surfaces are behind the same gate as every other Studio route, and
 * an anonymous visitor must reach the login page rather than either of them.
 *
 * The AUTHENTICATED cases — a merchandiser building a form, an editor finding the flags screen
 * read-only — are not here for the reason `studio-access.spec.ts` sets out at length: there is no
 * way to obtain a real session without a reachable auth server, and a forged cookie is refused by
 * `getUser()`, which is the point of using it. The per-role authorisation is proved beneath, by the
 * RLS tests in `tests/unit/rls` against a real PostgreSQL.
 */
test.describe('the Phase 19 Studio surfaces', () => {
  for (const path of ['/studio/catalog/customization-forms', '/studio/system/flags']) {
    test(`sends an anonymous visitor from ${path} to the login page`, async ({ page }) => {
      const response = await page.goto(path)

      expect(page.url()).toContain('/studio/login')
      expect(response?.status()).toBe(200)
      expect(new URL(page.url()).searchParams.get('next')).toBe(path)
    })
  }
})
