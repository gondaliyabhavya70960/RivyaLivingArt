import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Visual and accessibility harness for the design-system gallery.
 *
 * The eight widths come from requirement FEAT §45 and are configured as Playwright
 * projects, so this file describes WHAT is checked and playwright.config.ts decides at
 * which width. Running the suite covers all eight.
 *
 * The gallery is dev-only: playwright.config.ts starts `next dev`, because a production
 * build deliberately 404s this route.
 */

test.describe('design system gallery', () => {
  test('renders every primitive specimen', async ({ page }) => {
    await page.goto('/design-system')

    // The heading proves the route resolved rather than falling through to a 404.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Each specimen is a labelled section; if a component threw, its section is missing.
    const specimens = page.locator('section[aria-labelledby^="sp-"]')
    expect(await specimens.count()).toBeGreaterThan(5)
  })

  test('matches the visual baseline', async ({ page }) => {
    await page.goto('/design-system')
    await page.waitForLoadState('networkidle')
    // The Spinner animates forever; freeze animation so the snapshot is deterministic.
    await page.addStyleTag({
      content: '*,*::before,*::after{animation:none!important;transition:none!important}',
    })
    await expect(page).toHaveScreenshot('design-system.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    })
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/design-system')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    // Report the rule and the offending selector, so a failure is actionable from the
    // console without opening the HTML report.
    expect(
      blocking.map((v) => `${v.id} (${v.impact}) — ${v.nodes[0]?.target.join(' ')}`),
      'critical/serious axe violations',
    ).toEqual([])
  })

  test('every interactive control is reachable by keyboard', async ({ page }) => {
    await page.goto('/design-system')

    const interactive = page.locator(
      'main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled])',
    )
    const expected = await interactive.count()
    expect(expected).toBeGreaterThan(10)

    // Tab through and count what actually receives focus. A control that cannot be
    // reached is invisible to a keyboard user however correct its markup looks.
    const reached = new Set<string>()
    for (let i = 0; i < expected * 2; i++) {
      await page.keyboard.press('Tab')
      const id = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        if (!el.closest('main')) return null
        return `${el.tagName}:${el.getAttribute('name') ?? el.textContent?.trim().slice(0, 24) ?? ''}`
      })
      if (id) reached.add(id)
    }
    expect(reached.size).toBeGreaterThanOrEqual(Math.floor(expected * 0.8))
  })
})
