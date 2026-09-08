import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * The mega menu and the mobile drawer, driven by the keyboard alone.
 *
 * WHY THE KEYBOARD MODEL IS TESTED AND NOT JUST THE MARKUP. Every one of these behaviours is
 * invisible to a screenshot and to axe: a panel that opens but never moves focus, an `Escape` that
 * closes without returning focus to the trigger, a drawer that traps focus and then loses it — all
 * of them render identically to a working menu. They are also the behaviours most likely to be
 * broken by a refactor that "only changed the styling".
 *
 * THE TRIGGER IS A BUTTON, NOT A LINK, and these tests are what hold that decision in place. A
 * control that both navigates and expands has no correct `Enter` behaviour, and `aria-expanded`
 * means nothing on a link.
 */

const PAGE = '/search'

/** The mega menu is desktop-only chrome; below `lg` the drawer replaces it. */
const DESKTOP = ['w1920', 'w1440', 'w1280']
const MOBILE = ['w430', 'w390', 'w360']

test.describe('the mega menu', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!DESKTOP.includes(testInfo.project.name), 'desktop widths only')
    await page.goto(PAGE)
  })

  test('the trigger is a button with aria-expanded', async ({ page }) => {
    const trigger = page.locator('header button[aria-expanded]:visible').first()
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toHaveAttribute('aria-controls', /.+/u)
  })

  test('Enter opens the panel', async ({ page }) => {
    const trigger = page.locator('header button[aria-expanded]:visible').first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const panelId = await trigger.getAttribute('aria-controls')
    await expect(page.locator(`#${panelId}`)).toBeVisible()
  })

  test('ArrowDown opens the panel and moves focus into it', async ({ page }) => {
    const trigger = page.locator('header button[aria-expanded]:visible').first()
    await trigger.focus()
    await page.keyboard.press('ArrowDown')

    const panelId = await trigger.getAttribute('aria-controls')
    const focusedInPanel = await page.evaluate((id) => {
      const panel = document.getElementById(id ?? '')
      return (
        panel !== null && document.activeElement !== null && panel.contains(document.activeElement)
      )
    }, panelId)
    expect(focusedInPanel).toBe(true)
  })

  test('Escape closes the panel and returns focus to the trigger', async ({ page }) => {
    const trigger = page.locator('header button[aria-expanded]:visible').first()
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')

    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // Without the focus restore a keyboard user is dropped at the top of the document and has to
    // Tab from the beginning again.
    await expect(trigger).toBeFocused()
  })

  test('the panel reaches every category without a network request', async ({ page }) => {
    /*
     * The risk this closes: the mega menu becomes a client-side fetch and the header waterfalls.
     * `getSiteChrome()` is called once in the layout and the panel receives its contents as
     * server-rendered children, so opening it must cost nothing.
     */
    const trigger = page.locator('header button[aria-expanded]:visible').first()
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
        requests.push(request.url())
      }
    })

    await trigger.click()
    const panelId = await trigger.getAttribute('aria-controls')
    const links = page.locator(`#${panelId} a[href^="/collection/"]`)
    await expect(links).toHaveCount(7)
    expect(requests).toEqual([])
  })

  test('the panel is a named landmark', async ({ page }) => {
    const trigger = page.locator('header button[aria-expanded]:visible').first()
    const panelId = await trigger.getAttribute('aria-controls')
    // `aria-label` on a plain div does nothing; the panel is a <nav> so the name is real.
    await expect(page.locator(`nav#${panelId}`)).toHaveCount(1)
  })
})

test.describe('the mobile drawer', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!MOBILE.includes(testInfo.project.name), 'mobile widths only')
    await page.goto(PAGE)
  })

  test('opens from a named trigger and traps focus', async ({ page }) => {
    const trigger = page.locator('header button[aria-label]:visible').first()
    await expect(trigger).toBeVisible()
    await trigger.click()

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Tab repeatedly; focus must never leave the dialog.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() => {
        const panel = document.querySelector('[role="dialog"]')
        return (
          panel !== null &&
          document.activeElement !== null &&
          panel.contains(document.activeElement)
        )
      })
      expect(inside).toBe(true)
    }
  })

  test('Escape closes it and restores focus to the trigger', async ({ page }) => {
    const trigger = page.locator('header button[aria-label]:visible').first()
    await trigger.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})

test.describe('axe', () => {
  test('no critical or serious violations with the menu open', async ({ page }, testInfo) => {
    test.skip(
      !['w1440', 'w390'].includes(testInfo.project.name),
      'one desktop and one mobile width',
    )
    await page.goto(PAGE)

    /*
     * `:visible` matters here and nowhere else in this file. Both triggers are in the DOM at every
     * width — the desktop nav is `hidden lg:block`, the drawer trigger is `lg:hidden` — so a plain
     * `.first()` picks the desktop one in DOM order and then waits five seconds for an element CSS
     * has hidden. The visible one is the one this width actually offers.
     */
    const trigger = page.locator('header button[aria-expanded]:visible').first()
    await trigger.click()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(
      serious.map((violation) => `${violation.id}: ${violation.help}`),
      'critical/serious axe violations',
    ).toEqual([])
  })
})
