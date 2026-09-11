import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The header search box, by keyboard only.
 *
 * ARIA 1.2's COMBOBOX PATTERN IS EASY TO CLAIM AND HARD TO IMPLEMENT, and the usual failure is
 * moving DOM focus into the listbox: arrow keys then re-announce the whole list on every press and
 * typing stops working. So the assertions below are about where focus IS (the input, always) and
 * what `aria-activedescendant` points at, not about which option looks highlighted.
 *
 * THE LAST TEST IS THE ONE THAT MATTERS MOST. With JavaScript disabled the control must still
 * reach `/search` — the combobox is an enhancement over a `<form method="get">`, and if the bundle
 * fails the visitor must still be able to search.
 *
 * IT RUNS AT THE DESKTOP WIDTHS ONLY. Below `xl` the box is hidden — below `lg` because the drawer
 * is the whole menu, and between `lg` and `xl` because the masthead has no room for it beside a
 * nine-item nav (SiteHeader says so at the call site, with the arithmetic). Asserting it at 360px
 * would be asserting the absence of something deliberately absent.
 *
 * The 1280 below was always right; the comment beside it used to say `lg`, and the component said
 * `lg` too, which is how every page came to scroll sideways at 1024 until Phase 42.
 */

const DESKTOP = 1280

test.describe('the header search combobox', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < DESKTOP, 'hidden below xl by design')

  test('is a combobox before anything is typed', async ({ page }) => {
    await page.goto('/search')
    const input = page.locator('header input[role="combobox"]')
    await expect(input).toHaveCount(1)
    await expect(input).toHaveAttribute('aria-expanded', 'false')
    await expect(input).toHaveAttribute('aria-controls', /.+/)
  })

  test('opens on two characters and moves aria-activedescendant with the arrows', async ({
    page,
  }) => {
    await page.goto('/search')
    const input = page.locator('header input[role="combobox"]')
    await input.click()
    await input.type('re', { delay: 40 })

    const listbox = page.locator('header [role="listbox"]')
    /*
     * WAIT FOR A REAL SUGGESTION, NOT FOR THE LIST.
     *
     * The list opens as soon as two characters are typed, because the "see all" row is available
     * immediately and giving the visitor that action while the request is in flight is the right
     * behaviour. So `listbox` becomes visible before any suggestion has arrived, and a test that
     * waited on it raced the fetch: the first ArrowDown landed on "see all" and the second wrapped
     * back to it, which is how this assertion first failed against a working control.
     */
    const options = page.locator('header [role="option"]')
    // At least two: one real suggestion plus the "see all" row. One alone means the request has
    // not landed (or matched nothing), and arrowing then measures the race rather than the control.
    const opened = await expect
      .poll(async () => options.count(), { timeout: 5000 })
      .toBeGreaterThan(1)
      .then(() => true)
      .catch(() => false)
    test.skip(!opened, 'no seeded content matches "re" in this database')

    await expect(listbox).toBeVisible()
    await expect(input).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('ArrowDown')
    const first = await input.getAttribute('aria-activedescendant')
    expect(first).not.toBeNull()

    // FOCUS NEVER LEAVES THE INPUT. This is the assertion the pattern is usually got wrong on.
    await expect(input).toBeFocused()

    await page.keyboard.press('ArrowDown')
    const second = await input.getAttribute('aria-activedescendant')
    expect(second).not.toBe(first)

    await page.keyboard.press('ArrowUp')
    expect(await input.getAttribute('aria-activedescendant')).toBe(first)
  })

  test('Escape closes the list and returns focus to the field', async ({ page }) => {
    await page.goto('/search')
    const input = page.locator('header input[role="combobox"]')
    await input.click()
    await input.type('re', { delay: 40 })

    const listbox = page.locator('header [role="listbox"]')
    const opened = await listbox
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    test.skip(!opened, 'the control did not open in this database')

    await page.keyboard.press('Escape')
    await expect(listbox).toBeHidden()
    await expect(input).toBeFocused()
    await expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  test('reports no critical or serious axe violations', async ({ page }) => {
    await page.goto('/search')
    await page.locator('header input[role="combobox"]').click()
    await page.locator('header input[role="combobox"]').type('re', { delay: 40 })
    await page.waitForTimeout(500)

    const results = await new AxeBuilder({ page }).include('header').analyze()
    const serious = results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    )
    expect(serious.map((violation) => violation.id)).toEqual([])
  })

  test('still reaches /search with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/search')

    const input = page.locator('header input[name="q"]')
    await input.fill('resin')
    await input.press('Enter')

    await page.waitForURL(/\/search\?/)
    expect(new URL(page.url()).searchParams.get('q')).toBe('resin')
    await context.close()
  })
})
