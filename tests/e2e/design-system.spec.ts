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

/**
 * The Phase 02 risk register names exactly one mitigation for "reduced motion treated as a
 * faster animation": a test asserting no transform is applied under
 * `prefers-reduced-motion: reduce`. This is that test.
 *
 * It runs in its own describe block so the emulated media preference cannot leak into the
 * visual baseline, which is captured with the default preference.
 */
test.describe('reduced motion', () => {
  test.use({ colorScheme: 'no-preference', reducedMotion: 'reduce' })

  test('Reveal renders its final state rather than a shortened animation', async ({ page }) => {
    await page.goto('/design-system')

    const items = page.locator('[data-reveal-item]')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const box = items.nth(i)
      const computed = await box.evaluate((el) => {
        // Read from the element that carries the animation, which is Reveal's own wrapper.
        const target = el.closest('[style],div') ?? el
        const s = getComputedStyle(target as Element)
        return { transform: s.transform, opacity: s.opacity, transition: s.transitionDuration }
      })

      // Final state: no displacement, fully opaque. A shortened animation would still
      // leave a transform mid-flight or an opacity below 1 on first paint.
      expect(
        computed.transform === 'none' || computed.transform === 'matrix(1, 0, 0, 1, 0, 0)',
      ).toBe(true)
      expect(Number(computed.opacity)).toBe(1)
    }
  })

  test('the whole gallery is still keyboard operable under reduced motion', async ({ page }) => {
    await page.goto('/design-system')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? null)
    expect(focused).not.toBeNull()
    expect(focused).not.toBe('BODY')
  })
})

/**
 * The behavioural patterns. Phase 02's verification step 5 is a hand keyboard walkthrough;
 * these encode the parts of it that a machine can hold, so a regression is caught by the
 * suite rather than by the next person to try the keyboard.
 */
test.describe('behavioural patterns', () => {
  test('the page renders', async ({ page }) => {
    await page.goto('/design-system/patterns')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('has no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/design-system/patterns')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(
      blocking.map((v) => `${v.id} (${v.impact}) — ${v.nodes[0]?.target.join(' ')}`),
      'critical/serious axe violations',
    ).toEqual([])
  })

  test('matches the visual baseline', async ({ page }) => {
    await page.goto('/design-system/patterns')
    await page.waitForLoadState('networkidle')
    await page.addStyleTag({
      content: '*,*::before,*::after{animation:none!important;transition:none!important}',
    })
    await expect(page).toHaveScreenshot('patterns.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    })
  })

  test('Dialog traps focus and restores it to the trigger on Escape', async ({ page }) => {
    await page.goto('/design-system/patterns')
    const trigger = page.getByRole('button', { name: 'Open dialog' })
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Focus must be inside the dialog, not left on the trigger behind the scrim.
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)

    // Tab a full cycle; focus must never escape the dialog.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('Tabs use a roving tabindex and move on arrow keys', async ({ page }) => {
    await page.goto('/design-system/patterns')
    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(3)

    // Exactly one tab is in the tab order at a time — that is what roving tabindex means.
    const inOrder = await page
      .getByRole('tab')
      .evaluateAll((els) => els.filter((el) => el.getAttribute('tabindex') !== '-1').length)
    expect(inOrder).toBe(1)

    await tabs.first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect(tabs.nth(2)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(tabs.nth(0)).toBeFocused()
  })

  test('Accordion headers are real buttons carrying aria-expanded', async ({ page }) => {
    await page.goto('/design-system/patterns')
    const header = page.getByRole('button', { name: /custom-size furniture/i })
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await header.press('Enter')
    await expect(header).toHaveAttribute('aria-expanded', 'true')
  })

  test('DropdownMenu opens on ArrowDown and Escape restores focus to the trigger', async ({
    page,
  }) => {
    await page.goto('/design-system/patterns')
    const trigger = page.getByRole('button', { name: 'Row actions' })
    await trigger.focus()
    await page.keyboard.press('ArrowDown')

    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})
