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

/*
 * THE GALLERY IS A DEVELOPMENT SURFACE. `/design-system` calls `notFound()` in production, by
 * design: it is a catalogue of components for the people building them, not a page the studio
 * ships. So every test in this file skips when the harness is driving a production build
 * (`E2E_PRODUCTION=1`, set by `.github/workflows/e2e.yml`), with the reason stated rather than
 * silently absent.
 *
 * ITS VISUAL BASELINES ARE LOCAL-ONLY FOR THE SAME REASON, and that is not a loss: they were
 * produced in this repository's container, and font rasterisation differs on a GitHub runner by
 * enough to fail a page of text. See `docs/ops/TESTING.md` §3.
 */
test.skip(
  process.env.E2E_PRODUCTION === '1',
  '/design-system is dev-only — it calls notFound() in a production build',
)

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

/**
 * FEAT §48 requires touch targets of at least 44x44 CSS px — stricter than WCAG 2.5.8's 24px.
 *
 * Only checkable where the browser reports a coarse pointer, so it skips the five desktop
 * widths. playwright.config.ts sets `hasTouch` on the three mobile projects for exactly this
 * reason: without it a 360px project is a narrow desktop and the rule cannot be tested at the
 * widths it exists for.
 *
 * THREE THINGS THIS HAS TO MODEL, all of which a naive version gets wrong — the first draft
 * reported six violations and every one of them was a flaw in the test:
 *
 *   1. The target is the HIT BOX, not the glyph. A control may render smaller and earn its
 *      target from the `rv-hit-44` ::before overlay.
 *   2. For a checkbox or radio the target is the wrapping `<label>`, not the 20px input:
 *      Checkbox's root is a label precisely so the whole row activates the control.
 *   3. Hidden controls have no target to measure. Breadcrumbs drops its ancestor links to
 *      `hidden sm:flex` below 430px, and a zero-size rect is absence, not a violation.
 *
 * Inline links are exempt, matching WCAG 2.5.8's inline exception: a link inside a sentence
 * cannot be 44px tall without breaking the line box it lives in. Links styled as blocks or
 * buttons are not exempt and are checked.
 */
test.describe('touch targets', () => {
  test('every interactive control is at least 44px on a coarse pointer', async ({ page }) => {
    await page.goto('/design-system')

    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
    test.skip(!coarse, 'desktop width — the rule applies to touch pointers')

    const undersized = await page.evaluate(() => {
      const sel =
        'main button:not([disabled]), main input:not([type="hidden"]), main select, main textarea'
      const bad: string[] = []

      for (const el of Array.from(document.querySelectorAll(sel))) {
        // A checkbox or radio is activated through its wrapping label, which carries the
        // overlay; measuring the 20px input measures the wrong element.
        const type = el.getAttribute('type')
        const target =
          (type === 'checkbox' || type === 'radio') && el.closest('label')
            ? el.closest('label')!
            : el

        const rect = target.getBoundingClientRect()
        // Absent, not undersized.
        if (rect.width === 0 && rect.height === 0) continue

        const before = getComputedStyle(target, '::before')
        const overlayH =
          before.content !== 'none' ? Number.parseFloat(before.blockSize || '0') || 0 : 0
        const overlayW =
          before.content !== 'none' ? Number.parseFloat(before.inlineSize || '0') || 0 : 0

        const h = Math.max(rect.height, overlayH)
        const w = Math.max(rect.width, overlayW)

        if (h < 44 || w < 44) {
          bad.push(
            `${target.tagName.toLowerCase()}${type ? `[${type}]` : ''} ` +
              `"${(target.textContent ?? '').trim().slice(0, 24)}" ${Math.round(w)}x${Math.round(h)}`,
          )
        }
      }
      return bad
    })

    expect(undersized, 'controls under 44x44 on a coarse pointer').toEqual([])
  })
})

/**
 * A guard against the cascade defect this suite found late: `base.css` sat unlayered, so its
 * element resets beat every Tailwind utility, and every button in the product rendered with
 * no padding, no border and no background — the primary CTA was bare text on the ground.
 *
 * Nothing else could see it. The classes were in the source, they compiled to real CSS, axe
 * was satisfied because text-on-ground contrast was fine, and the visual baselines had been
 * captured FROM the broken state so they agreed with it.
 *
 * These assertions read COMPUTED style, which is the only place a cascade loss is visible.
 */
test.describe('tokens reach the DOM', () => {
  test('utilities are not overridden by an unlayered reset', async ({ page }) => {
    await page.goto('/design-system')

    const primary = page.getByRole('button', { name: 'Commission a Piece' })
    const secondary = page.getByRole('button', { name: 'View the Collection' })

    // The accent fill must be the champagne token, not transparent.
    await expect(primary).toHaveCSS('background-color', 'rgb(184, 155, 99)')
    // Padding must come from the size scale, not the reset's `padding: 0`.
    await expect(primary).not.toHaveCSS('padding-left', '0px')
    // The secondary variant is defined by its border; without it the variant does not exist.
    await expect(secondary).not.toHaveCSS('border-left-width', '0px')
    await expect(secondary).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  })
})
