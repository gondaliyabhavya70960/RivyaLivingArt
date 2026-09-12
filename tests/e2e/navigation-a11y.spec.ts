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
  /*
   * THE PANEL EXISTS ONLY WHILE A CATEGORY IS LIVE — Phase 45.
   *
   * `SiteHeader` renders a nav item with no children as a plain link rather than a mega-menu
   * trigger, and Phase 45 made the chrome omit a destination that does not resolve. Every
   * `categories` row is DRAFT today, so Collection has no children and there is no panel to drive.
   * That is the correct rendering — a signpost to nowhere is worse than no signpost — and the
   * honest thing for this block is to skip with the reason stated rather than to find some other
   * control carrying `aria-expanded` and assert the keyboard model against that.
   */
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!DESKTOP.includes(testInfo.project.name), 'desktop widths only')
    await page.goto(PAGE)
    test.skip(
      (await page.locator('[data-megamenu] button[aria-expanded]').count()) === 0,
      'no category is live, so the header renders Collection as a plain link and no panel exists',
    )
  })

  test('the trigger is a button with aria-expanded', async ({ page }) => {
    const trigger = page.locator('[data-megamenu] button[aria-expanded]:visible').first()
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toHaveAttribute('aria-controls', /.+/u)
  })

  test('Enter opens the panel', async ({ page }) => {
    const trigger = page.locator('[data-megamenu] button[aria-expanded]:visible').first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const panelId = await trigger.getAttribute('aria-controls')
    await expect(page.locator(`#${panelId}`)).toBeVisible()
  })

  test('ArrowDown opens the panel and moves focus into it', async ({ page }) => {
    const trigger = page.locator('[data-megamenu] button[aria-expanded]:visible').first()
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
    const trigger = page.locator('[data-megamenu] button[aria-expanded]:visible').first()
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
     *
     * NEXT'S OWN PREFETCHES ARE NOT THAT WATERFALL — Phase 42, the first run of this spec.
     *
     * `next/link` asks for a destination's RSC payload when the link enters the viewport, so
     * opening the panel puts seven category links on screen and the router requests a `?_rsc=`
     * payload per link the page renders — header, panel and footer alike — for THE PAGE BEHIND THE
     * LINK. That is the router making the next navigation instant, and it is the opposite of the
     * regression this test exists to catch. Asserting on an empty list failed on the feature.
     *
     * So the filter is: every fetch/xhr must be an RSC prefetch of a URL THIS PAGE LINKS TO. A
     * panel that fetched its categories would ask for a route handler, an API path or its own
     * page's payload, and none of those is a link on the page.
     */
    const trigger = page.locator('[data-megamenu] button[aria-expanded]:visible').first()
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

    // Read the hrefs AFTER opening: the panel's own links are only in the document once it is open.
    const linked = new Set(
      await page
        .locator('a[href^="/"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => new URL((node as HTMLAnchorElement).href).pathname),
        ),
    )

    const unexplained = requests.filter((url) => {
      const parsed = new URL(url)
      return !parsed.searchParams.has('_rsc') || !linked.has(parsed.pathname)
    })
    expect(unexplained, 'requests no link on the page explains as a prefetch').toEqual([])
  })

  test('the panel is a named landmark', async ({ page }) => {
    const trigger = page.locator('[data-megamenu] button[aria-expanded]:visible').first()
    const panelId = await trigger.getAttribute('aria-controls')
    // `aria-label` on a plain div does nothing; the panel is a <nav> so the name is real.
    await expect(page.locator(`nav#${panelId}`)).toHaveCount(1)
  })
})

test.describe('the chrome offers no dead link', () => {
  /*
   * THE HOLE THIS CLOSES — Phase 45.
   *
   * Ten destinations in the published menus answered 404: the seven `/collection/<slug>` routes,
   * whose `categories` rows are all DRAFT, and `/faq`, `/privacy` and `/terms`, whose `pages` rows
   * are published with no published sections. The header, the mega menu, the mobile drawer and the
   * footer rendered every one of them as an anchor, on every page of the site.
   *
   * Nothing could have caught it. The block above counts seven category links in the panel and
   * asserts nothing about whether they resolve; `resolveInternalTarget` existed to prevent exactly
   * this and the chrome never called it; and `livePaths`, the oracle it consults, was built from
   * `pages` alone and so was wrong about the seven most important destinations on the site.
   *
   * IT ASSERTS ON THE CHROME AND NOT ON A PAGE BODY, because the two have different rules: a card
   * whose destination is not live renders as text and keeps the editor's words, while a navigation
   * item — whose entire payload IS the destination — is omitted. This is the chrome's rule, tested
   * where the chrome is tested, once, rather than on each of a dozen routes that all carry it.
   */
  test('every destination it offers resolves', async ({ page }) => {
    await page.goto(PAGE)

    // Open the panel if there is one: its links are in the document either way, but reading them
    // after opening keeps this correct if the panel ever becomes an unmount rather than `hidden`.
    const trigger = page.locator('[data-megamenu] button[aria-expanded]:visible').first()
    if ((await trigger.count()) > 0) await trigger.click()

    const hrefs = [
      ...new Set(
        await page
          .locator('header a[href^="/"], footer a[href^="/"], [role="dialog"] a[href^="/"]')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? '')),
      ),
    ].filter((href) => href !== '' && !href.startsWith('/#'))

    expect(hrefs.length, 'the chrome offers no internal links at all').toBeGreaterThan(0)

    const dead: string[] = []
    for (const href of hrefs) {
      const response = await page.request.get(href)
      if (response.status() !== 200) dead.push(`${href} → ${String(response.status())}`)
    }
    expect(dead, 'the chrome links to a destination that does not render').toEqual([])
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
     *
     * NOT SCOPED TO `[data-megamenu]`, unlike every other locator in this file, and deliberately:
     * this test wants whichever disclosure the width offers, and at 390 that is the drawer, which
     * is not a mega menu. It skips rather than retargets when the width offers neither — with every
     * category DRAFT the desktop header has no panel at all (Phase 45), and clicking some other
     * control carrying `aria-expanded` would sweep a page this test was never pointed at.
     */
    const trigger = page.locator('header button[aria-expanded]:visible').first()
    test.skip(
      (await trigger.count()) === 0,
      'this width offers no chrome disclosure to open — see the mega menu block',
    )
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
