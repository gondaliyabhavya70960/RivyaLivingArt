import { expect, test } from '@playwright/test'

import { PUBLIC_ROUTES, reachable } from './routes'

/**
 * ONE OF EACH LANDMARK, AND A NAME WHERE THERE ARE TWO — Phase 41, run in Phase 42.
 *
 * A screen-reader user navigates by landmark before they read anything. That works when there is
 * exactly one `main`, one `banner` and one `contentinfo`, and when two regions of the same kind can
 * be told apart by name. It stops working silently: the page looks identical, and the landmark
 * list becomes "navigation, navigation, navigation".
 *
 * AXE DOES NOT CATCH MOST OF THIS. `landmark-unique` is not in the WCAG tag set the sweep runs, and
 * duplicate landmarks are a best practice rather than a violation — which is exactly why it needs
 * its own assertions rather than a wider axe configuration that would drag in twenty other opinions.
 */

test.describe('landmarks', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'landmark structure does not vary by width')

  for (const route of PUBLIC_ROUTES) {
    test(`${route} has exactly one main, banner and contentinfo`, async ({ page }) => {
      test.skip(!(await reachable(page, route)), `${route} is not published in this database`)

      await expect(page.locator('main'), 'main').toHaveCount(1)
      await expect(page.getByRole('banner'), 'banner').toHaveCount(1)
      await expect(page.getByRole('contentinfo'), 'contentinfo').toHaveCount(1)
    })
  }

  test('every navigation region is named, and no two share a name', async ({ page }) => {
    test.skip(!(await reachable(page, '/')), 'the home page is not published in this database')

    const navs = page.getByRole('navigation')
    const count = await navs.count()
    expect(count, 'a page with no navigation at all').toBeGreaterThan(0)

    const names: string[] = []
    for (let index = 0; index < count; index += 1) {
      const nav = navs.nth(index)
      const label =
        (await nav.getAttribute('aria-label')) ??
        (await nav
          .getAttribute('aria-labelledby')
          .then(async (id) =>
            id === null ? null : page.locator(`#${id}`).first().textContent(),
          ))
      expect(label, `navigation ${String(index)} has no accessible name`).toBeTruthy()
      names.push((label ?? '').trim())
    }
    expect(new Set(names).size, `two navigation regions share a name: ${names.join(', ')}`).toBe(
      names.length,
    )
  })

  test('the skip link is the first thing a keyboard reaches, and it works', async ({ page }) => {
    /*
     * THE SKIP LINK IS FOR SOMEBODY WHO TABS. It has to be first, it has to become visible when
     * focused — a skip link that stays hidden is one nobody can use — and it has to land on
     * something focusable, or the next Tab starts from the top again and the link did nothing.
     */
    test.skip(!(await reachable(page, '/')), 'the home page is not published in this database')

    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
    const href = await focused.getAttribute('href')
    expect(href, 'the first focusable element is not a skip link').toMatch(/^#/)

    await focused.press('Enter')
    const target = page.locator(href ?? '#main')
    await expect(target).toHaveCount(1)
  })
})
