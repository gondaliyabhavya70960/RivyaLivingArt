import { expect, test } from '@playwright/test'

/**
 * WHAT WORKS WITH A FINGER — Phase 42.
 *
 * `tests/e2e/a11y/touch-targets.spec.ts` asks whether controls are big enough. This asks the other
 * half: whether they work at all without a mouse.
 *
 * THE FAILURE THIS EXISTS FOR IS HOVER. A submenu that opens on `:hover`, a caption that appears on
 * hover, a control whose only affordance is a hover colour — all of it is invisible and unusable on
 * a phone, and all of it looks perfect to whoever built it on a laptop. A touch browser fakes a
 * hover on tap to paper over the worst of it, which makes the bug intermittent rather than absent.
 *
 * IT RUNS ONLY WHERE THE POINTER IS COARSE. `playwright.config.ts` sets `hasTouch` below 500px, so
 * the browser reports `(pointer: coarse)` and the CSS that matters is the CSS that applies.
 */

test.describe('with a finger', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 500, 'desktop width — there is a mouse')

  test('the navigation opens by tap and closes again', async ({ page }) => {
    const response = await page.goto('/')
    test.skip(response?.status() !== 200, 'the home page is not published in this database')

    /*
     * THE DISCLOSURE MUST BE A BUTTON. A `<div>` with a click handler cannot be reached by a
     * keyboard and is announced as nothing; on a phone it usually works, which is why it survives.
     */
    /*
     * THE FIRST VISIBLE ONE, NOT THE FIRST ONE. The header renders both a desktop menu and a mobile
     * disclosure and hides whichever does not apply, so `.first()` on its own picks a control that
     * is in the DOM and not on the screen — and tapping it waits thirty seconds for an element CSS
     * has deliberately hidden.
     */
    /*
     * THE FIRST VISIBLE ONE, NOT THE FIRST ONE. The header renders both a desktop menu and a mobile
     * disclosure and hides whichever does not apply, so `.first()` on its own picks a control that
     * is in the DOM and not on the screen — and tapping it waits thirty seconds for an element CSS
     * has deliberately hidden.
     *
     * MATCHED ON `aria-expanded` ALONE. `MobileNav` opens a Drawer that it renders in a portal, so
     * the trigger carries no `aria-controls` — there is no id in the document to point at until the
     * drawer exists. Requiring both attributes found nothing and skipped the test, which is the
     * quiet way a suite stops covering the thing it was written for.
     */
    const candidates = page.locator('[aria-expanded]')
    let toggle = candidates.first()
    let found = false
    for (let index = 0; index < (await candidates.count()); index += 1) {
      if (await candidates.nth(index).isVisible()) {
        toggle = candidates.nth(index)
        found = true
        break
      }
    }
    test.skip(!found, 'no visible disclosure at this width')

    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.tap()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // What it opened has to be on the screen, and it has to be reachable — a drawer that traps
    // focus outside itself is a drawer somebody cannot use.
    const drawer = page.getByRole('dialog').first()
    await expect(drawer).toBeVisible()

    /*
     * ESCAPE CLOSES IT. A drawer with no keyboard exit is a trap for somebody on a phone with a
     * keyboard attached, and `Drawer` (RC-xxx, Phase 10) owns that behaviour — this is the
     * assertion that it is still wired at the width it matters on.
     */
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('no content is revealed only by hover', async ({ page }) => {
    /*
     * THE ASSERTION IS OVER THE STYLESHEET, NOT THE PAGE, because the page cannot be asked "what
     * would you look like if somebody hovered". Every rule the document actually loaded is read,
     * and any `:hover` rule that changes VISIBILITY — rather than colour, shadow or transform — is
     * a disclosure a finger can never open.
     *
     * `@media (hover: hover)` RULES ARE EXEMPT AND THAT IS THE CORRECT PATTERN: a hover affordance
     * declared inside that query does not apply on a touch device at all, so the design has already
     * said "this is for pointers" and provided for the rest.
     */
    const response = await page.goto('/')
    test.skip(response?.status() !== 200, 'the home page is not published in this database')

    const offenders = await page.evaluate(() => {
      const found: string[] = []
      const hidesThings = /(?:^|[;{\s])(?:display|visibility|opacity|content-visibility)\s*:/

      const walk = (rules: CSSRuleList, insideHoverQuery: boolean): void => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSMediaRule) {
            const guarded = insideHoverQuery || /hover\s*:\s*hover/.test(rule.conditionText)
            walk(rule.cssRules, guarded)
            continue
          }
          if (rule instanceof CSSSupportsRule) {
            walk(rule.cssRules, insideHoverQuery)
            continue
          }
          if (insideHoverQuery) continue
          if (!(rule instanceof CSSStyleRule)) continue
          if (!rule.selectorText.includes(':hover')) continue
          if (!hidesThings.test(rule.style.cssText)) continue
          // `opacity: 1` on hover is a fade-IN of something already in the layout, which a touch
          // browser triggers on tap. A rule that hides is the one that traps content.
          if (/opacity\s*:\s*1(?:\s|;|$)/.test(rule.style.cssText)) continue
          found.push(`${rule.selectorText} { ${rule.style.cssText.slice(0, 80)} }`)
        }
      }

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walk(sheet.cssRules, false)
        } catch {
          // A cross-origin stylesheet cannot be read. There are none in this product — the CSP
          // forbids them — so nothing is being skipped silently.
        }
      }
      return found.slice(0, 10)
    })

    expect(offenders, 'content revealed only on hover, outside a (hover: hover) query').toEqual([])
  })

  test('a tap on a card reaches the page it promises', async ({ page }) => {
    /*
     * A CARD IS A LINK, and the usual mistake is a click handler on the wrapper with the anchor
     * somewhere inside: a tap in the padding does nothing, and the visitor taps again harder.
     */
    const response = await page.goto('/collection')
    test.skip(response?.status() !== 200, 'the catalogue is not published in this database')

    /*
     * `article a[href]`, NOT `[role="listitem"] a[href]`. The grid only takes `role="list"` when the
     * CMS has given it a name, so keying on the role skipped this test on a database where that
     * string is unseeded — and a card is an `<article>` either way.
     */
    const card = page.locator('article a[href]').first()
    test.skip((await card.count()) === 0, 'no cards in the catalogue in this database')

    const href = await card.getAttribute('href')
    await card.tap()
    await page.waitForURL((url) => url.pathname === href, { timeout: 10_000 })
    expect(new URL(page.url()).pathname).toBe(href)
  })

  test('nothing needs a long press, a double tap or a drag', async ({ page }) => {
    /*
     * WCAG 2.5.1. A gesture that needs two fingers, a path, or precise timing excludes somebody
     * using a head pointer, a switch, or one hand while holding a child. The check is structural:
     * no element declares a touch-action that takes over panning, which is what a custom drag
     * gesture requires in order to work.
     */
    const response = await page.goto('/')
    test.skip(response?.status() !== 200, 'the home page is not published in this database')

    const gestural = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .filter((node) => {
          const touchAction = window.getComputedStyle(node as HTMLElement).touchAction
          return touchAction === 'none'
        })
        .slice(0, 5)
        .map((node) => node.tagName.toLowerCase()),
    )
    expect(gestural, 'elements that take over panning, which a custom gesture needs').toEqual([])
  })

  test('the page can be pinch-zoomed', async ({ page }) => {
    /*
     * `user-scalable=no` AND `maximum-scale=1` ARE THE SAME REFUSAL WRITTEN TWO WAYS, and both stop
     * somebody with low vision from enlarging the page. Browsers increasingly ignore them, which
     * is not a reason to ship one: the ones that obey are the older devices most likely to be
     * somebody's only phone.
     */
    const response = await page.goto('/')
    test.skip(response?.status() !== 200, 'the home page is not published in this database')

    const viewport =
      (await page.locator('meta[name="viewport"]').first().getAttribute('content')) ?? ''
    expect(viewport, 'the viewport refuses zoom').not.toMatch(/user-scalable\s*=\s*(no|0)/)
    expect(viewport, 'the viewport caps zoom').not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/)
  })
})
