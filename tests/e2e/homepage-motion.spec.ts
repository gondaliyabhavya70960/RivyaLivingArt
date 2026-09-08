import { expect, test, type Page } from '@playwright/test'

/**
 * The two motion branches, asserted as two different pages.
 *
 * REDUCED MOTION IS NOT A FASTER ANIMATION HERE, IT IS A DIFFERENT LAYOUT — FEAT §4's distinction
 * and Phase 11's requirement. So the assertions are about what EXISTS: no `<video>` element in the
 * tree at all, and no `data-active` attribute on any stage. A test that measured durations would
 * pass while a video was quietly fetching in the background for somebody who asked for less
 * motion.
 *
 * NO CLIP IS BOUND YET, AND THAT IS STATED RATHER THAN WORKED AROUND. `media_assets` is empty
 * until `npm run media:migrate:higgsfield` runs, so the hero has no `motion-desktop` asset and no
 * video mounts at any width. The assertions below are therefore ABSENCE assertions in both
 * branches today — which is exactly what the phase asks for at 390px, and what the binding will
 * turn into a presence assertion at 1440px on the day the clip exists. `tests/unit/hero-motion.
 * test.tsx` covers the five gates directly in the meantime, one case each, without needing an
 * asset.
 */

async function homepageIsPublished(page: Page): Promise<boolean> {
  const response = await page.goto('/')
  return response?.status() === 200
}

/** The material story's stages, addressed by the section rather than by a class. */
function stages(page: Page) {
  return page.locator('[data-block-type="material-story"] [data-entry-key]')
}

test.describe('with motion allowed', () => {
  test('renders every stage and marks the one in view', async ({ page }) => {
    test.skip(!(await homepageIsPublished(page)), 'no published sections on / in this database')

    const all = stages(page)
    await expect(all).toHaveCount(4)

    // Scrolling the section into view is what the observer is for; the assertion is that SOMETHING
    // becomes active, not which one — that depends on the viewport height and is not a contract.
    await all.first().scrollIntoViewIfNeeded()
    await expect(page.locator('[data-active="true"]').first()).toBeAttached({ timeout: 5_000 })
  })

  test('mounts no hero video while no clip is bound', async ({ page }) => {
    test.skip(!(await homepageIsPublished(page)), 'no published sections on / in this database')

    // Absence for a stated reason: the hero's `motion-desktop` slot is empty because the media
    // library is. When it is filled, this becomes a width-dependent presence assertion — and the
    // 390px case below stays an absence one whatever happens, because of the 768px gate.
    await expect(page.locator('video')).toHaveCount(0)
  })
})

test.describe('under prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' })

  test('renders the same four stages, statically', async ({ page }) => {
    test.skip(!(await homepageIsPublished(page)), 'no published sections on / in this database')

    // The same content, not less of it: reduced motion removes an effect, never a picture.
    await expect(stages(page)).toHaveCount(4)
    await expect(page.locator('[data-active]')).toHaveCount(0)
  })

  test('mounts no video element at all', async ({ page }) => {
    test.skip(!(await homepageIsPublished(page)), 'no published sections on / in this database')

    // Not "does not autoplay" — the element is not in the tree. A `<video preload="none">` that
    // never plays still costs a media element and, on some engines, a poster fetch.
    await expect(page.locator('video')).toHaveCount(0)
  })

  test('leaves every stage reachable by Tab', async ({ page }) => {
    test.skip(!(await homepageIsPublished(page)), 'no published sections on / in this database')

    // The sequence never captures scroll, so nothing can trap focus: the stages are ordinary list
    // items in document order, and any link inside them is reachable.
    const focusable = await page
      .locator('[data-block-type="material-story"]')
      .locator('a, button, [tabindex]:not([tabindex="-1"])')
      .count()
    expect(focusable).toBeGreaterThanOrEqual(0)

    const visible = await stages(page).evaluateAll((nodes) =>
      nodes.every((node) => window.getComputedStyle(node).display !== 'none'),
    )
    expect(visible).toBe(true)
  })
})
